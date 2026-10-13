// Uses only uniquely tagged synthetic records. No clinical content, identities
// or credentials are printed; cleanup removes only these fixtures.
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {validateFreshConfiguration} from './setup-fresh-admin.mjs';
const {ref,clinic}=validateFreshConfiguration(process.env);
assert.equal(ref,'zktvrcaeztmzmsdjcjsa');
const tag=randomUUID(),url=`https://${ref}.supabase.co`;
const ids={p:`ops-p-${tag}`,d:`ops-d-${tag}`,otherD:`ops-d2-${tag}`,a:`ops-a-${tag}`,n:`ops-n-${tag}`};
const authIds=[],userIds=[],report={};let service,stage='setup',extraIds=[];
const checked=r=>{if(r.error)throw Error(`api:${r.error.code||r.status||'unknown'}:${r.error.message?.match(/(?:column "|function )([A-Za-z0-9_.]+)/)?.[1]||''}`);return r.data;};
const rpc=async(c,n,p={})=>checked(await c.rpc(n,p));
async function person(anon,email,role,doctorId,scope=clinic){
 const password=randomBytes(24).toString('base64url')+'Aa!9';
 const u=checked(await service.auth.admin.createUser({email,password,email_confirm:true})).user;
 authIds.push(u.id);const id=randomUUID();userIds.push(id);
 if(role!=='patient')checked(await service.from('users').insert({id,username:email,name:'Pessoa de teste operacional',role,doctor_id:doctorId||null,clinicId:scope,authUserId:u.id,active:true,password:''}));
 const client=createClient(url,anon,{auth:{persistSession:false}});
 const session=checked(await client.auth.signInWithPassword({email,password})).session;
 return {client,id,uid:u.id,token:session.access_token,email,password};
}
try {
 const k=await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys?reveal=true`,{headers:{Authorization:`Bearer ${process.env.SUPABASE_MIGRATION_ACCESS_TOKEN}`}});
 assert.ok(k.ok);const keys=await k.json();
 const anon=keys.find(x=>x.name==='anon')?.api_key;
 service=createClient(url,keys.find(x=>x.name==='service_role')?.api_key,{auth:{persistSession:false}});
 checked(await service.from('doctors').insert([
  {id:ids.d,name:'Clínico fictício',crm:`TEST-${tag}`,specialty:'Psiquiatria',clinicId:clinic,availableTimes:[]},
  {id:ids.otherD,name:'Outro clínico fictício',crm:`TEST2-${tag}`,specialty:'Clínica Geral',clinicId:clinic,availableTimes:[]},
 ]));
 const owner=await person(anon,`ops-owner-${tag}@example.invalid`,'doctor',ids.d);
 const admin=await person(anon,`ops-admin-${tag}@example.invalid`,'admin');
 const other=await person(anon,`ops-other-${tag}@example.invalid`,'doctor',ids.otherD);
 const patient=await person(anon,`ops-patient-${tag}@example.invalid`,'patient');
 const foreignStaff=await person(anon,`ops-foreign-${tag}@example.invalid`,'admin',null,randomUUID());
 checked(await service.from('patients').insert({id:ids.p,name:'Paciente fictício',birthDate:'1990-01-01',gender:'Masculino',cpf:tag.replaceAll('-','').slice(0,11),email:patient.email,clinicId:clinic,primaryDoctorId:ids.d,authUserId:patient.uid,history:'Histórico legado fictício restrito',files:[{id:`file-${tag}`,name:'Anexo fictício.txt',url:'data:text/plain;base64,dGVzdGU='}]}));
 checked(await service.from('appointments').insert({id:ids.a,patientId:ids.p,doctorId:ids.d,date:'2026-10-10',time:'10:00',status:'Agendado',type:'Consulta',clinicId:clinic,serviceValue:100,repassRule:{type:'percentage',value:20}}));
 stage='snapshots';
 const first=await rpc(owner.client,'operational_snapshot');
 assert.equal(first.tables.patients.find(p=>p.id===ids.p).history,'');
 const direct=await owner.client.from('patients').select('*').eq('id',ids.p);
 assert.ok(direct.error||!direct.data?.length);
 report.directUnauditedClinicalReadsBlocked=true;
 stage='concurrency';
 const change={table:'patients',id:ids.p,expected:first.versions.patients[ids.p],row:{phone:'11900000001'}};
 const race=await Promise.all([owner.client.rpc('operational_sync',{p_changes:[change]}),
  other.client.rpc('operational_sync',{p_changes:[{...change,row:{phone:'11900000002'}}]})]);
 assert.equal(race.filter(r=>!r.error).length,1);
 const failure=race.find(r=>r.error);
 if(failure.error.code!=='PT409')throw Error(`concurrency:${failure.status}:${String(failure.error.message).slice(0,180)}`);
 report.concurrentPatientEditsRejectStaleWriter=true;
 const rawWrite=await owner.client.from('patients').update({phone:'11900000003'}).eq('id',ids.p);
 assert.ok(rawWrite.error);
 report.unversionedWritesBlocked=true;
 stage='clinical_financial';
 const before=await rpc(owner.client,'operational_snapshot');
 const input={complaint:'Atendimento fictício para verificação',diagnosis:'',conduct:'',prescription:'',especialidade:'Clínica Geral'};
 const request={p_appointment_id:ids.a,p_expected:before.versions.appointments[ids.a],p_input:input};
 const finals=await Promise.all([rpc(owner.client,'operational_finish_consultation',request),rpc(owner.client,'operational_finish_consultation',request)]);
 assert.equal(finals[0].evolution.id,finals[1].evolution.id);extraIds.push(finals[0].evolution.id,`ft-appt-${ids.a}`,`rp-appt-${ids.a}`);
 const tx=checked(await service.from('financial_transactions').select('id,amount').eq('appointmentId',ids.a));
 const rp=checked(await service.from('financial_repasses').select('id,amount').eq('appointmentId',ids.a));
 assert.equal(tx.length,1);assert.equal(Number(tx[0].amount),100);assert.equal(rp.length,1);assert.equal(Number(rp[0].amount),20);
 const duplicate=await service.from('financial_transactions').insert({id:`duplicate-${tag}`,clinicId:clinic,appointmentId:ids.a,type:'receita',status:'pendente',description:'Teste fictício',amount:100,dueDate:'2026-10-10',createdAt:new Date().toISOString()});
 assert.equal(duplicate.error?.code,'23505');
 report.atomicClinicalBillingAndRepassWithNoDuplicates=true;
 stage='private_history';
 await rpc(owner.client,'operational_note',{p_id:ids.n,p_patient_id:ids.p,p_text:'Nota fictícia restrita'});
 const own=await rpc(owner.client,'operational_history',{p_patient_id:ids.p});
 const denied=await rpc(other.client,'operational_history',{p_patient_id:ids.p});
 assert.equal(own.evolutions.length,1);assert.equal(own.notes.length,1);assert.equal(denied.evolutions.length,0);assert.equal(denied.notes.length,0);
 assert.ok((await patient.client.rpc('operational_history',{p_patient_id:ids.p})).error);
 report.privateHistoryRestrictedAndReadsAudited=true;
 stage='batch_rollback';
 const baseline=await rpc(admin.client,'operational_snapshot');
 const batch=await admin.client.rpc('operational_sync',{p_changes:[
  {table:'financial_transactions',id:tx[0].id,expected:baseline.versions.financial_transactions[tx[0].id],row:{description:'Não deve permanecer'}},
  {table:'patients',id:ids.p,expected:'stale',row:{name:'Não deve permanecer'}},
 ]});
 assert.equal(batch.error?.code,'PT409');
 assert.notEqual(checked(await service.from('financial_transactions').select('description').eq('id',tx[0].id).single()).description,'Não deve permanecer');
 report.entireBatchRollsBackOnConflict=true;
 stage='backup_restore';
 const full=await rpc(admin.client,'operational_snapshot',{p_backup:true});
 const allIds=new Set([...Object.values(ids),...userIds,...extraIds]);
 const subset={...full,tables:Object.fromEntries(Object.entries(full.tables).map(([t,rows])=>[t,rows.filter(r=>allIds.has(r.id)||allIds.has(r.patient_id)||allIds.has(r.record_id))]))};
 stage='typed_backup_validation';
 const proof=await rpc(admin.client,'operational_validate_restore',{p_backup:subset});
 assert.equal(proof.validated,true);assert.equal(proof.productionRowsChanged,false);
 // Recover a complete synthetic clinical chain, including its account binding,
 // embedded attachment, original author and generated financial records.
 for(const table of ['financial_transactions','financial_repasses'])checked(await service.from(table).delete().eq('appointmentId',ids.a));
 checked(await service.from('evolucao_paciente').delete().eq('paciente_id',ids.p));
 checked(await service.from('sigilous_notes').delete().eq('id',ids.n));
 checked(await service.from('appointments').delete().eq('id',ids.a));
 checked(await service.from('patients').delete().eq('id',ids.p));
 stage='complete_synthetic_clinical_restore';
 const restored=await rpc(admin.client,'operational_restore_merge',{p_backup:subset});
 assert.equal(restored.overwritten,0);
 assert.equal(restored.inserted,6);
 for(const table of ['patients','appointments','sigilous_notes','evolucao_paciente','financial_transactions','financial_repasses']){
  const wanted=subset.tables[table][0];
  const actual=checked(await service.from(table).select('*').eq('id',wanted.id).single());
  assert.deepEqual(actual,wanted);
 }
 const again=await rpc(admin.client,'operational_restore_merge',{p_backup:subset});
 assert.equal(again.inserted,0);
 const foreign=await admin.client.rpc('operational_validate_restore',{p_backup:{...subset,clinicId:randomUUID()}});
 assert.ok(foreign.error);
 report.typedIsolatedRestoreAndRealSyntheticRecoveryVerified=true;
 stage='audit';
 const audit=await rpc(admin.client,'operational_audit_list');
 assert.ok(audit.some(a=>a.action==='read_history'&&a.patient_id===ids.p&&a.actor_uid===owner.uid));
 assert.ok((await owner.client.from('operational_audit').delete().eq('patient_id',ids.p)).error);
 report.auditCannotBeEditedOrDeletedByStaff=true;
 stage='admin_password_controls';
 const origin=`https://${process.env.REPLIT_DEV_DOMAIN}`;
 const passwordRequest=async(actor,body)=>{
  const response=await fetch(`${url}/functions/v1/staff-access`,{method:'POST',
   headers:{Origin:origin,apikey:anon,Authorization:`Bearer ${actor.token}`,'Content-Type':'application/json'},
   body:JSON.stringify({action:'set-password',...body})});
  return {status:response.status,body:await response.json()};
 };
 const newPassword=randomBytes(24).toString('base64url')+'Aa!9';
 assert.equal((await passwordRequest(other,{kind:'staff',id:owner.id,password:newPassword,currentPassword:other.password})).status,403);
 assert.equal((await passwordRequest(admin,{kind:'staff',id:owner.id,password:'1234',currentPassword:admin.password})).status,400);
 assert.equal((await passwordRequest(admin,{kind:'staff',id:foreignStaff.id,password:newPassword,currentPassword:admin.password})).status,403);
 assert.equal((await passwordRequest(foreignStaff,{kind:'staff',id:owner.id,password:newPassword,currentPassword:foreignStaff.password})).status,403);
 assert.equal((await passwordRequest(admin,{kind:'staff',id:owner.id,password:newPassword,currentPassword:'Invalid-fixture-password!'})).status,403);
 const unprivileged=await admin.client.rpc('operational_password_authorize',{p_actor_uid:admin.uid,p_kind:'staff',p_id:owner.id});
 assert.ok(unprivileged.error);
 const changed=await passwordRequest(admin,{kind:'staff',id:owner.id,password:newPassword,currentPassword:admin.password});
 assert.equal(changed.status,200);assert.equal(changed.body.changed,true);
 assert.ok((await owner.client.rpc('operational_snapshot')).error);
 const refreshed=await owner.client.auth.refreshSession();
 if(!refreshed.error)assert.ok((await owner.client.rpc('operational_snapshot')).error);
 assert.equal((await passwordRequest(owner,{kind:'staff',id:admin.id,password:newPassword,currentPassword:newPassword})).status!==200,true);
 const loginClient=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 assert.ok((await loginClient.auth.signInWithPassword({email:owner.email,password:owner.password})).error);
 assert.equal(checked(await loginClient.auth.signInWithPassword({email:owner.email,password:newPassword})).user.id,owner.uid);
 assert.equal((await loginClient.rpc('operational_session_valid')).data,true);
 const patientChanged=await passwordRequest(admin,{kind:'patient',id:ids.p,password:newPassword,currentPassword:admin.password});
 assert.equal(patientChanged.status,200);assert.equal(patientChanged.body.changed,true);
 assert.equal((await patient.client.rpc('operational_session_valid')).data,false);
 assert.ok((await loginClient.auth.signInWithPassword({email:patient.email,password:patient.password})).error);
 assert.equal(checked(await loginClient.auth.signInWithPassword({email:patient.email,password:newPassword})).user.id,patient.uid);
 assert.equal((await passwordRequest(admin,{kind:'staff',id:`missing-${tag}`,password:newPassword,currentPassword:admin.password})).status,403);
 const passwordAudit=checked(await service.from('operational_audit').select('action,metadata').eq('actor_uid',admin.uid).in('action',['password_changed','password_change_failed']));
 assert.equal(passwordAudit.filter(a=>a.action==='password_changed').length,2);
 assert.ok(passwordAudit.some(a=>a.action==='password_change_failed'));
 assert.ok(!JSON.stringify(passwordAudit).includes(newPassword));
 assert.equal(checked(await service.from('users').select('password,authUserId').eq('id',owner.id).single()).password,'');
 report.adminPasswordChangeRequiresReauthenticationAndAuditsStaffAndPatient=true;
 report.passwordResetBlocksOldAndRefreshedStaffAndPatientSessions=true;
 stage='deactivation';
 await rpc(admin.client,'operational_staff_change',{p_id:owner.id,p_active:false,p_role:'doctor'});
 assert.ok((await owner.client.rpc('operational_snapshot')).error);
 assert.ok((await owner.client.rpc('operational_history',{p_patient_id:ids.p})).error);
 assert.ok((await owner.client.rpc('operational_vault_key')).error);
 const self=await admin.client.rpc('operational_staff_change',{p_id:admin.id,p_active:false,p_role:'admin'});
 assert.ok(self.error);
 report.deactivationBlocksAlreadyIssuedTokenAndDraftKey=true;
 const edge=await fetch(`${url}/functions/v1/staff-access`,{method:'POST',headers:{Origin:origin,apikey:anon,Authorization:`Bearer ${other.token}`,'Content-Type':'application/json'},body:JSON.stringify({action:'change',id:admin.id,active:false,role:'admin'})});
 assert.equal(edge.status,403);
 report.staffEdgeRejectsNonAdministrator=true;
 console.log(JSON.stringify({operationalChecks:report}));
}catch(e){console.error(JSON.stringify({stage,failed:true,checksPassed:report,error:String(e.message).slice(0,160)}));process.exitCode=1;}
finally{
 if(service){
  try{
   for(const table of ['financial_transactions','financial_repasses'])checked(await service.from(table).delete().eq('appointmentId',ids.a));
   checked(await service.from('sigilous_notes').delete().eq('patientId',ids.p));
   checked(await service.from('evolucao_paciente').delete().eq('paciente_id',ids.p));
   checked(await service.from('appointments').delete().eq('id',ids.a));
   checked(await service.from('patients').delete().eq('id',ids.p));
   if(userIds.length)checked(await service.from('users').delete().in('id',userIds));
   checked(await service.from('doctors').delete().in('id',[ids.d,ids.otherD]));
   if(authIds.length)checked(await service.from('operational_audit').delete().in('actor_uid',authIds));
   checked(await service.from('operational_audit').delete().in('record_id',[...Object.values(ids),...userIds,...extraIds]));
   for(const id of authIds)checked(await service.auth.admin.deleteUser(id));
   console.log(JSON.stringify({syntheticFixturesRemoved:true}));
  }catch{console.error(JSON.stringify({syntheticCleanupFailed:true}));process.exitCode=1;}
 }
}
