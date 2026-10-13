import React, {useState} from 'react';
import {supabase} from '../services/supabase';
import {User, UserRole} from '../types';

/** Credentials exist only in component memory and the authenticated request. */
export const AdminPasswordEditor:React.FC<{
 user:User;kind:'staff'|'patient';targetId:string;targetName:string;linked:boolean;
}>=({user,kind,targetId,targetName,linked})=>{
 const [currentPassword,setCurrentPassword]=useState('');
 const [password,setPassword]=useState('');
 const [confirmation,setConfirmation]=useState('');
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const clear=()=>{setCurrentPassword('');setPassword('');setConfirmation('');};
 if(user.role!==UserRole.ADMIN)return null;
 return <details className="w-full rounded-xl border border-slate-200 bg-white p-3"
  onToggle={e=>{if(!e.currentTarget.open)clear();}}>
  <summary className="cursor-pointer font-semibold text-sm">Alterar senha diretamente — somente administrador</summary>
  {!linked?<p className="mt-3 text-sm">Este cadastro ainda não tem uma conta autenticada vinculada. Envie o convite primeiro; não é criada uma senha local.</p>:
  <form className="mt-3 grid gap-3" onSubmit={async e=>{
   e.preventDefault();if(busy)return;setMessage('');
   if(password.length<8||password.length>128){setMessage('Use uma nova senha de 8 a 128 caracteres.');return;}
   if(password!==confirmation){setMessage('A confirmação da nova senha não coincide.');return;}
   if(!window.confirm(`Definir uma nova senha de acesso para ${targetName}? A senha anterior deixará de funcionar. Isto não altera a frase de proteção dos backups.`))return;
   setBusy(true);
   try{
    const {data,error}=await supabase.functions.invoke('staff-access',{
     body:{action:'set-password',kind,id:targetId,password,currentPassword}});
    if(error||data?.error){
     const detail=await (error as any)?.context?.json?.().catch(()=>null);
     throw Error(data?.error||detail?.error||'O servidor não confirmou a alteração.');
    }
    if(!data?.changed)throw Error('O servidor não confirmou a alteração.');
    setMessage(data.warning||`Senha alterada no provedor de autenticação.${data.emailConfirmationRequired?' A confirmação do e-mail ainda é necessária; a conta não foi ativada por esta alteração.':''}`);
   }catch(error){setMessage(error instanceof Error?error.message:'Não foi possível alterar a senha.');}
   finally{clear();setBusy(false);}
  }}>
   <p className="text-sm text-slate-600">Confirme sua senha administrativa. A nova senha não será exibida, salva no cadastro ou enviada por e-mail.</p>
   <label className="grid gap-1 text-sm">Sua senha de administrador
    <input required disabled={busy} type="password" autoComplete="current-password" maxLength={128} value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} className="border rounded p-2"/>
   </label>
   <label className="grid gap-1 text-sm">Nova senha do usuário
    <input required disabled={busy} type="password" autoComplete="new-password" minLength={8} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} className="border rounded p-2"/>
   </label>
   <label className="grid gap-1 text-sm">Confirme a nova senha
    <input required disabled={busy} type="password" autoComplete="new-password" minLength={8} maxLength={128} value={confirmation} onChange={e=>setConfirmation(e.target.value)} className="border rounded p-2"/>
   </label>
   <button disabled={busy} type="submit" className="rounded border px-3 py-2 font-semibold">{busy?'Confirmando alteração…':'Salvar nova senha'}</button>
  </form>}
  {message&&<p role="status" className="mt-3 text-sm">{message}</p>}
 </details>;
};
