import { supabase } from './supabase';
import { emptyDatabase, localDatabaseKey } from './freshStart';
import { removeLegacyPatientPassword } from './patientCredentials';
import type { AppDatabase } from './storage';
import type { ConsultationInput } from './clinicalPersistence';
import { draftVault } from './draftVault';

export const financialTables: Record<string,string> = {
 financial_transactions:'transactions',financial_categories:'categories',financial_cost_centers:'costCenters',
 financial_payment_methods:'paymentMethods',financial_bank_accounts:'bankAccounts',financial_insurance_plans:'insurancePlans',
 financial_repasses:'repasses',financial_cash_closures:'cashClosures',financial_reconciliations:'reconciliations',
 financial_billing_records:'billingRecords',financial_settings:'settings',
};
const core: Record<string,string>={patients:'patients',doctors:'doctors',appointments:'appointments',medications:'medications'};
const rowId=(r:any)=>String(r.id||r.clinicId);
const stable=(v:any):string=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)
 ?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
let baseline:Record<string,Map<string,any>>={};
let versions:Record<string,Record<string,string>>={};
let queue:Promise<unknown>=Promise.resolve();
let epoch=0;
let lastDatabase:AppDatabase|null=null;
let pendingScope='pending-edits-doctor';
let pendingHeld=false;
export async function operationalRpc(name:string,args:Record<string,any>={}) {
 const {data,error}=await supabase.rpc(name,args);
 if(error) throw new Error(['40001','PT409'].includes(error.code)
  ? 'Conflito de gravação: outro acesso alterou o registro. Suas alterações não foram enviadas. Recarregue os dados e revise.'
  : error.message||'O servidor não confirmou a operação.');
 return data;
}
function clean(table:string,r:any):any {
 if(table==='patients') {
  const {authUserId,pendingAuthUserId,portalEnrollmentPending,patientPasswordSet,history,...rest}=removeLegacyPatientPassword(r);
  return {...rest,files:rest.files?.map((f:any)=>{const {authorId,restricted,...file}=f;return file;})};
 }
 return r;
}
function tables(db:AppDatabase) {
 return {...Object.fromEntries(Object.entries(core).map(([t,k])=>[t,(db as any)[k]||[]])),
 ...Object.fromEntries(Object.entries(financialTables).map(([t,k])=>[t,(db.financial as any)?.[k]||[]]))} as Record<string,any[]>;
}
function deserialize(s:any):AppDatabase {
 const db=emptyDatabase() as AppDatabase; const t=s.tables;
 Object.entries(core).forEach(([table,key])=>{(db as any)[key]=t[table]||[];});
 db.patients=db.patients.map(p=>({...removeLegacyPatientPassword(p),patientPasswordSet:!!(p as any).authUserId}));
 db.users=(t.users||[]).map((u:any)=>({...u,doctorId:u.doctor_id,password:''}));
 db.sigilousNotes=t.sigilous_notes||[];db.evolutions=t.evolucao_paciente||[];
 Object.entries(financialTables).forEach(([table,key])=>{(db.financial as any)[key]=t[table]||[];});
 return db;
}
function capture(db:AppDatabase,s:any) {
 versions=s.versions; baseline={};
 Object.entries(tables(db)).forEach(([t,rows])=>{baseline[t]=new Map(rows.map(r=>[rowId(r),structuredClone(clean(t,r))]));});
}
function serial<T>(action:()=>Promise<T>):Promise<T> {
 const task=queue.catch(()=>{}).then(action);queue=task;return task;
}
function collectChanges(db:AppDatabase){
 const changes:any[]=[];
 Object.entries(tables(db)).forEach(([table,rows])=>{
  const present=new Set<string>();
  rows.forEach(source=>{
   const row=clean(table,source),id=rowId(row);present.add(id);
   const before=baseline[table]?.get(id);
   const patch=Object.fromEntries(Object.entries(row).filter(([k,v])=>k!=='clinicId'&&v!==undefined&&stable(v)!==stable(before?.[k])));
   if(Object.keys(patch).length)changes.push({table,id,expected:versions[table]?.[id]||null,row:patch});
  });
  baseline[table]?.forEach((_r,id)=>{if(!present.has(id))changes.push({table,id,expected:versions[table]?.[id],row:null});});
 });
 return changes;
}
export const storage={
 initLocal():AppDatabase {return emptyDatabase() as AppDatabase;},
 async save(db:AppDatabase) {
  lastDatabase=db;
  if(!Object.keys(baseline).length||pendingHeld)return;
  const changes=collectChanges(db);
  if(changes.length)await draftVault.write(pendingScope,{changes});
  else await draftVault.remove(pendingScope);
 },
 resetCloudSyncState() {epoch++;baseline={};versions={};lastDatabase=null;pendingHeld=false;draftVault.lock();},
 async getPendingChanges(){return draftVault.read(pendingScope);},
 async discardPendingChanges(){pendingHeld=false;await draftVault.remove(pendingScope);},
 async recoverPendingChanges(){
  const pending=await draftVault.read(pendingScope);
  if(!pending?.changes?.length)return;
  const changes=pending.changes.filter((c:any)=>{
   const current=baseline[c.table]?.get(c.id);
   if(c.row===null)return !!current;
   return !current||!Object.entries(c.row).every(([k,v])=>stable(current[k])===stable(v));
  });
  if(changes.length)await operationalRpc('operational_sync',{p_changes:changes});
  pendingHeld=false;await draftVault.remove(pendingScope);
 },
 async fetchFromCloud(clinic?:string):Promise<Partial<AppDatabase>> {
  if(!clinic)return {};
  epoch++;await queue.catch(()=>{});
  const s=await operationalRpc('operational_snapshot');
  if(s.clinicId!==clinic)throw Error('A clínica da sessão não corresponde ao acesso autorizado.');
  const db=deserialize(s);capture(db,s);return db;
 },
 async syncToCloud(db:AppDatabase,clinic?:string) {
  if(!clinic||!Object.keys(baseline).length)throw Error('Carregue os dados autorizados antes de gravar.');
  if(pendingHeld)throw Error('Há pendências protegidas da sessão anterior. Recupere ou descarte após revisão antes de novas gravações.');
  const generation=epoch;
  const changes:any[]=[];
  Object.entries(tables(db)).forEach(([table,rows])=>{
   const present=new Set<string>();
   rows.forEach(source=>{
    const row=clean(table,source),id=rowId(row);present.add(id);
    const before=baseline[table]?.get(id);
    const patch=Object.fromEntries(Object.entries(row).filter(([key,value])=>key!=='clinicId'&&value!==undefined
     && stable(value)!==stable(before?.[key])));
    if(Object.keys(patch).length)changes.push({table,id,expected:versions[table]?.[id]||null,row:patch});
   });
   baseline[table]?.forEach((_r,id)=>{if(!present.has(id))changes.push({table,id,expected:versions[table]?.[id],row:null});});
  });
  if(!changes.length)return;
  return serial(async()=>{
   if(generation!==epoch)throw Error('Sessão encerrada; a gravação pendente foi cancelada.');
   // Rebase only against acknowledgments received by this browser; the server
   // still compares its actual version and rolls back the entire batch on conflict.
   changes.forEach(c=>{c.expected=versions[c.table]?.[c.id]||null;});
   const ack=await operationalRpc('operational_sync',{p_changes:changes});
   if(generation!==epoch)return;
   if(!Array.isArray(ack)||ack.length!==changes.length)throw Error('Confirmação da gravação incompleta.');
   ack.forEach((x:any)=>{
    if(x.deleted){baseline[x.table].delete(x.id);delete versions[x.table][x.id];}
    else {baseline[x.table].set(x.id,structuredClone(clean(x.table,x.row)));versions[x.table][x.id]=x.version;}
   });
   if(lastDatabase)await storage.save(lastDatabase);
  });
 },
 async finishConsultation(id:string,input:ConsultationInput) {
  return serial(async()=>{
   const s=await operationalRpc('operational_finish_consultation',{p_appointment_id:id,p_expected:versions.appointments?.[id],p_input:input});
   if(s.appointment?.id!==id||s.appointment.status!=='Finalizado'||s.evolution?.appointment_id!==id)throw Error('Confirmação clínica incompleta. Rascunho mantido.');
   baseline.appointments.set(id,structuredClone(s.appointment));versions.appointments[id]=s.version;
   for(const [table,rows,hashes] of [
    ['financial_transactions',s.transactions,s.transactionVersions],
    ['financial_repasses',s.repasses,s.repassVersions],
   ] as const) {
    baseline[table]=new Map((rows||[]).map((r:any)=>[rowId(r),structuredClone(r)]));
    versions[table]=hashes||{};
   }
   return s;
  });
 },
 async saveSigilousNoteToCloud(note:any) {
  return operationalRpc('operational_note',{p_id:note.id,p_patient_id:note.patientId,p_text:note.note});
 },
 async prepareSession(role:string) {
  const isAdmin=role==='admin';pendingScope='pending-edits-'+role;
  await draftVault.unlock(role);
  pendingHeld=!!(await draftVault.read(pendingScope))?.changes?.length;
  localStorage.removeItem(`sb-${(import.meta.env.VITE_FRESH_TARGET_REF||'')}-auth-token`);
  const key=localDatabaseKey(),old=localStorage.getItem(key);
  if(old) {
   if(!isAdmin)throw Error('O administrador precisa proteger as pendências antigas deste navegador antes do acesso da equipe.');
   const legacy=JSON.parse(old);
   legacy.users=(legacy.users||[]).map((u:any)=>{const {password,senhaAcesso,...safe}=u;return safe;});
   legacy.patients=(legacy.patients||[]).map(removeLegacyPatientPassword);
   await draftVault.write('legacy-cache',legacy);
   localStorage.removeItem(key);
  }
  const legacyKeys=Object.keys(localStorage).filter(k=>k.startsWith('medcore_consult_draft_'+import.meta.env.VITE_CLINIC_ID+'_'));
  if(legacyKeys.length){
   if(!isAdmin)throw Error('Há rascunhos antigos não protegidos. O administrador precisa preservar e sanitizar este navegador antes do acesso da equipe.');
   const existing=await draftVault.read('legacy-drafts')||{};
   for(const k of legacyKeys)existing[k]=JSON.parse(localStorage.getItem(k)||'{}');
   await draftVault.write('legacy-drafts',existing);
   legacyKeys.forEach(k=>localStorage.removeItem(k));
  }
 },
};
