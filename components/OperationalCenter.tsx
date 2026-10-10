import React,{useState} from 'react';
import {operationalRpc,storage} from '../services/operationalStorage';
import {encryptBackup,decryptBackup,downloadEncryptedBackup} from '../services/backupVault';
import {supabase} from '../services/supabase';
import type {AppDatabase} from '../services/storage';
import type {User} from '../types';

export const OperationalCenter:React.FC<{db:AppDatabase;user:User;onReload:()=>Promise<void>;team?:boolean}>=({db,user,onReload,team})=>{
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[password,setPassword]=useState('');
 const [loaded,setLoaded]=useState<any>(null),[proof,setProof]=useState<any>(null),[audit,setAudit]=useState<any[]>([]);
 const [form,setForm]=useState({name:'',email:'',role:'doctor',crm:'',specialty:'',profileId:''});
 const run=async(fn:()=>Promise<void>)=>{setBusy(true);setMessage('');try{await fn();}catch(e:any){setMessage(e.message||'Operação não confirmada.');}finally{setBusy(false);}};
 const staff=async(body:any)=>{
  const {data,error}=await supabase.functions.invoke('staff-access',{body});
  if(error||data?.error)throw Error(data?.error||'Servidor não confirmou a solicitação da equipe.');
  return data;
 };
 const exportBackup=()=>run(async()=>{
  await storage.syncToCloud(db,user.clinicId);
  const snapshot=await operationalRpc('operational_snapshot',{p_backup:true});
  const checked=await operationalRpc('operational_validate_restore',{p_backup:snapshot});
  if(!checked.validated)throw Error('A restauração do backup não foi validada.');
  downloadEncryptedBackup(await encryptBackup(snapshot,password));
  setProof(checked);setMessage('Backup do banco do aplicativo baixado, criptografado e restaurado em tabelas isoladas para conferência. Guarde a frase separadamente.');
 });
 const loadFile=(file:File)=>run(async()=>{
  if(file.size>100*1024*1024)throw Error('Arquivo acima de 100 MB. Solicite restauração administrativa assistida.');
  setLoaded(null);setProof(null);
  const snapshot=await decryptBackup(await file.text(),password);
  const checked=await operationalRpc('operational_validate_restore',{p_backup:snapshot});
  setLoaded(snapshot);setProof(checked);setMessage('Integridade e restauração isolada conferidas. O banco em uso não foi alterado.');
 });
 const restore=()=>run(async()=>{
  if(!loaded||!proof?.validated)throw Error('Carregue e teste o backup antes.');
  if(!confirm('Restaurar somente registros ausentes? Dados existentes diferentes interrompem toda a operação. Contas e senhas não são substituídas.'))return;
  await storage.syncToCloud(db,user.clinicId);
  const result=await operationalRpc('operational_restore_merge',{p_backup:loaded});
  await onReload();setMessage(`Restauração confirmada: ${result.inserted} registros recuperados; nenhum registro sobrescrito.`);
 });
 return <section className="space-y-5">
  <h2 className="text-2xl font-bold">{team?'Acesso da equipe':'Segurança, backup e auditoria'}</h2>
  <p className="text-slate-600">Gravações exigem confirmação do servidor. Sessões são encerradas após 10 minutos sem atividade; rascunhos locais são criptografados por usuário.</p>
  {message&&<p role="status" className="rounded-xl border p-4 bg-amber-50 text-slate-800">{message}</p>}
  {team?<><form className="bg-white border rounded-xl p-5 grid gap-3 md:grid-cols-2" onSubmit={e=>{e.preventDefault();void run(async()=>{
   await storage.syncToCloud(db,user.clinicId);await staff({action:'invite',...form});await onReload();
   setMessage('Convite aceito pelo provedor. A pessoa entra com o e-mail e define a própria senha no link; o recebimento precisa ser confirmado por ela.');
  });}}>
   <h3 className="font-semibold md:col-span-2">Convidar por e-mail — sem senha criada pelo administrador</h3>
   <select aria-label="Cadastro legado" value={form.profileId} onChange={e=>{const u=db.users.find(u=>u.id===e.target.value);setForm({...form,profileId:e.target.value,name:u?.name||'',role:u?.role||'doctor'});}}>
    <option value="">Novo acesso</option>{db.users.filter(u=>!(u as any).authUserId).map(u=><option key={u.id} value={u.id}>Vincular cadastro: {u.name}</option>)}
   </select>
   <input required placeholder="Nome completo" aria-label="Nome completo" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
   <input type="email" required placeholder="E-mail de acesso" aria-label="E-mail de acesso" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/>
   <select aria-label="Perfil de acesso" value={form.role} onChange={e=>setForm({...form,role:e.target.value})}><option value="doctor">Médico / profissional clínico</option><option value="collaborator">Colaborador</option><option value="admin">Administrador</option></select>
   {form.role==='doctor'&&!form.profileId&&<><input required placeholder="Registro profissional" value={form.crm} onChange={e=>setForm({...form,crm:e.target.value})}/><input required placeholder="Especialidade" value={form.specialty} onChange={e=>setForm({...form,specialty:e.target.value})}/></>}
   <button disabled={busy} className="bg-teal-700 text-white rounded-lg p-3 md:col-span-2">Enviar convite</button>
  </form>
  <div className="bg-white border rounded-xl divide-y">{db.users.map(u=><div key={u.id} className="p-4 flex flex-wrap gap-3 items-center">
   <div className="flex-1"><strong>{u.name}</strong><p>{u.username} · {u.role} · {(u as any).active===false?'Desativado':'Permissão ativa'}</p></div>
   <button disabled={busy||u.id===user.id} className="border rounded px-3 py-2" onClick={()=>void run(async()=>{
    if(!confirm(`Confirmar ${(u as any).active===false?'reativação':'desativação'} de ${u.name}? A desativação bloqueia o acesso aos dados imediatamente, inclusive com sessão antiga.`))return;
    await storage.syncToCloud(db,user.clinicId);const result=await staff({action:'change',id:u.id,active:(u as any).active===false,role:u.role});await onReload();setMessage(result.warning||'Permissão alterada e confirmada pelo servidor.');
   })}>{(u as any).active===false?'Reativar':'Desativar'}</button>
   <select aria-label={`Perfil de ${u.name}`} disabled={busy} value={u.role} onChange={e=>{const role=e.target.value;void run(async()=>{
    if(!confirm(`Alterar o perfil de ${u.name} para ${role}?`))return;await storage.syncToCloud(db,user.clinicId);await staff({action:'change',id:u.id,active:(u as any).active!==false,role});await onReload();setMessage('Perfil confirmado pelo servidor.');
   });}}><option value="admin">Administrador</option><option value="doctor">Clínico</option><option value="collaborator">Colaborador</option></select>
   {(u as any).authUserId&&<button disabled={busy} className="border rounded px-3 py-2" onClick={()=>void run(async()=>{await staff({action:'recover',email:u.username});setMessage('O provedor aceitou o envio do link para a conta vinculada.');})}>Enviar recuperação</button>}
  </div>)}</div></>:<>
  <div className="bg-white border rounded-xl p-5 space-y-3">
   <h3 className="font-semibold">Backup criptografado e recuperação</h3>
   <p>Inclui pacientes, atendimentos, evoluções, notas restritas, anexos armazenados nos cadastros, cadastros financeiros, perfis e histórico de auditoria, inclusive pacientes arquivados. Não inclui senhas do Supabase Auth nem configurações externas de e-mail. Preserve também o backup do projeto no Supabase.</p>
   <input type="password" autoComplete="new-password" minLength={12} aria-label="Frase de proteção do backup" placeholder="Frase de proteção (mínimo 12 caracteres)" value={password} onChange={e=>{setPassword(e.target.value);setLoaded(null);setProof(null);}} className="border rounded p-3 w-full"/>
   <button disabled={busy||password.length<12} className="bg-teal-700 text-white rounded p-3" onClick={exportBackup}>Testar restauração e baixar backup</button>
   <label className="block">Carregar backup criptografado para testar <input type="file" accept=".json" disabled={busy||password.length<12} onChange={e=>{if(e.target.files?.[0])void loadFile(e.target.files[0]);e.target.value='';}}/></label>
   {proof&&<div className="bg-green-50 p-3"><strong>Restauração isolada validada — banco em uso preservado</strong><ul>{Object.entries(proof.counts||{}).map(([table,count])=><li key={table}>{table}: {String(count)}</li>)}</ul></div>}
   <button disabled={busy||!loaded||!proof?.validated} className="border rounded p-3" onClick={restore}>Recuperar registros ausentes sem sobrescrever os atuais</button>
  </div>
  <div className="bg-white border rounded-xl p-5 space-y-3">
   <h3 className="font-semibold">Registro de acessos e alterações</h3>
   <button disabled={busy} className="border rounded p-3" onClick={()=>void run(async()=>{setAudit(await operationalRpc('operational_audit_list'));})}>Consultar eventos recentes</button>
   <div className="overflow-auto"><table className="w-full text-sm"><thead><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Registro</th></tr></thead><tbody>{audit.map(a=><tr key={a.id} className="border-t"><td>{new Date(a.occurred_at).toLocaleString('pt-BR')}</td><td>{a.actor_name}</td><td>{a.action}</td><td>{a.resource} · {db.patients.find(p=>p.id===a.patient_id)?.name||a.patient_id||a.record_id||'Sistema'}</td></tr>)}</tbody></table></div>
   {audit.length===200&&<button disabled={busy} onClick={()=>void run(async()=>{const next=await operationalRpc('operational_audit_list',{p_before:audit[audit.length-1].occurred_at});setAudit([...audit,...next]);})}>Carregar eventos anteriores</button>}
  </div></>}
 </section>;
};
