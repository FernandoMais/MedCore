import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
const url=Deno.env.get("SUPABASE_URL")!;
const service=createClient(url,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
const clinic=Deno.env.get("PATIENT_CLINIC_ID")!;
const origins=new Set((Deno.env.get("PATIENT_APP_ORIGINS")||"").split(",").map(s=>s.trim()));
Deno.serve(async request=>{
 const origin=request.headers.get("origin")||"";
 const cors=origins.has(origin)?{"access-control-allow-origin":origin,"access-control-allow-headers":"authorization,apikey,content-type,x-client-info","access-control-allow-methods":"POST,OPTIONS",vary:"Origin"}:{};
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"content-type":"application/json","cache-control":"no-store"}});
 if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(request.method!=="POST"||!origins.has(origin))return reply({error:"Origem não autorizada."},403);
 try {
  const token=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
  if(!token)return reply({error:"Autenticação necessária."},401);
  const verified=await service.auth.getUser(token);
  if(verified.error||!verified.data.user)return reply({error:"Sessão inválida."},401);
  const {data:actor}=await service.from("users").select("id,role,active,clinicId,authUserId").eq("authUserId",verified.data.user.id).eq("clinicId",clinic).maybeSingle();
  if(!actor?.active||actor.role!=="admin")return reply({error:"Acesso administrativo não autorizado."},403);
  const raw=await request.text();if(raw.length>32768)return reply({error:"Solicitação muito grande."},413);
  const body=JSON.parse(raw);
  const caller=createClient(url,Deno.env.get("SUPABASE_ANON_KEY")!,{auth:{persistSession:false},global:{headers:{Authorization:`Bearer ${token}`}}});
  const sessionCheck=await caller.rpc("operational_session_valid");
  if(sessionCheck.error||sessionCheck.data!==true)return reply({error:"Sessão encerrada. Entre novamente."},401);
  if(body.action==="set-password"){
   if(!["staff","patient"].includes(body.kind)||typeof body.id!=="string"||body.id.length>200
    ||typeof body.password!=="string"||body.password.length<8||body.password.length>128
    ||typeof body.currentPassword!=="string"||!body.currentPassword||body.currentPassword.length>128){
    return reply({error:"Informe a conta, sua senha administrativa e uma nova senha de 8 a 128 caracteres."},400);
   }
   const authorized=await service.rpc("operational_password_authorize",{
    p_actor_uid:verified.data.user.id,p_kind:body.kind,p_id:body.id});
   if(authorized.error)return reply({error:authorized.error.message},403);
   const operationId=authorized.data.operationId;
   let changed=false;
   const proof=createClient(url,Deno.env.get("SUPABASE_ANON_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
   try{
    const authenticated=await proof.auth.signInWithPassword({
     email:verified.data.user.email!,password:body.currentPassword});
    if(authenticated.error||authenticated.data.user?.id!==verified.data.user.id){
     return reply({error:"Sua senha administrativa não foi confirmada. Nenhuma senha foi alterada."},403);
    }
    const rechecked=await service.rpc("operational_password_authorize",{
     p_actor_uid:verified.data.user.id,p_kind:body.kind,p_id:body.id,p_operation_id:operationId});
    if(rechecked.error)return reply({error:"A permissão ou o vínculo mudou. A alteração foi interrompida."},403);
    const targetUid=rechecked.data.authUserId;
    const account=await service.auth.admin.getUserById(targetUid);
    if(account.error||!account.data.user)return reply({error:"Conta autenticada não encontrada."},409);
    // Updating a password must not confirm e-mail, enable a banned account,
    // replace identity metadata, or change the protected profile binding.
    const updated=await service.auth.admin.updateUserById(targetUid,{password:body.password});
    if(updated.error)return reply({error:"O provedor recusou a nova senha. Use uma senha forte diferente da anterior."},422);
    changed=true;
    const recorded=await service.rpc("operational_password_result",{p_operation_id:operationId,p_success:true});
    return reply({changed:true,emailConfirmationRequired:!account.data.user.email_confirmed_at,
     warning:recorded.error?"Senha alterada; o registro final de auditoria precisa de revisão.":undefined});
   }finally{
    if(!changed)await service.rpc("operational_password_result",{p_operation_id:operationId,p_success:false});
    await proof.auth.signOut({scope:"local"}).catch(()=>{});
   }
  }
  if(body.action==="change"){
   const {data,error}=await caller.rpc("operational_staff_change",{p_id:String(body.id),p_active:body.active===true,p_role:String(body.role)});
   if(error)return reply({error:error.message},400);
   const ban=data.authUserId?await service.auth.admin.updateUserById(data.authUserId,{ban_duration:data.active?"none":"876000h"}):null;
   return reply({user:data,warning:ban?.error?"O banco já bloqueou o acesso, mas o provedor não confirmou a alteração da sessão.":undefined});
  }
  const redirectTo=`${origin}/?staff-auth=recovery`;
  if(body.action==="recover"){
   let lookup=service.from("users").select("id,authUserId,active").eq("clinicId",clinic);
   lookup=body.id?lookup.eq("id",String(body.id)):lookup.eq("username",String(body.email||"").trim().toLowerCase());
   const {data:profile}=await lookup.maybeSingle();
   if(!profile?.authUserId||!profile.active)return reply({error:"Conta ativa não encontrada."},404);
   const target=await service.auth.admin.getUserById(profile.authUserId);
   const email=target.data.user?.email;
   if(target.error||!email)return reply({error:"Vínculo do e-mail precisa ser revisado."},409);
   const sent=await service.auth.resetPasswordForEmail(email,{redirectTo});
   return sent.error?reply(mailFailure(sent.error),mailStatus(sent.error)):reply({sent:true});
  }
  const email=String(body.email||"").trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return reply({error:"Informe um e-mail válido."},400);
  if(body.action!=="invite"||!["admin","doctor","collaborator","secretaria","tesouraria"].includes(body.role))return reply({error:"Operação inválida."},400);
  const name=String(body.name||"").trim();if(!name||name.length>120)return reply({error:"Nome inválido."},400);
  let existing:any=null;
  if(body.profileId){
   const found=await service.from("users").select("id,authUserId,doctor_id,clinicId").eq("id",body.profileId).eq("clinicId",clinic).maybeSingle();
   if(found.error||!found.data||found.data.authUserId)return reply({error:"Este cadastro já tem vínculo ou não pode ser convidado."},409);
   existing=found.data;
  }
  let doctorId=existing?.doctor_id||null,createdDoctor=false;
  if(body.doctorId){
   if(body.role!=="doctor"||(doctorId&&doctorId!==body.doctorId))return reply({error:"O vínculo profissional informado não corresponde a este cadastro."},409);
   const found=await service.from("doctors").select("id").eq("id",String(body.doctorId)).eq("clinicId",clinic).maybeSingle();
   if(found.error||!found.data)return reply({error:"Ficha profissional não encontrada nesta clínica."},404);
   doctorId=found.data.id;
  }
  // Match only unambiguous clinic-owned professional contact information.
  // Never create a second clinical record just because access was not invited yet.
  if(body.role==="doctor"&&!doctorId){
   const found=await service.from("doctors").select("id").eq("clinicId",clinic).ilike("email",email.replace(/[%_]/g,"\\$&")).limit(2);
   if(found.error)return reply({error:"Não foi possível conferir a ficha profissional. Nenhum convite foi enviado."},503);
   if(found.data.length>1)return reply({error:"Há mais de uma ficha com este e-mail. Selecione a ficha profissional correta."},409);
   doctorId=found.data[0]?.id||null;
  }
  if(doctorId){
   if(body.role!=="doctor")return reply({error:"Mantenha o perfil clínico ao vincular uma ficha profissional."},409);
   const linked=await service.from("users").select("id").eq("doctor_id",doctorId).eq("clinicId",clinic).limit(2);
   if(linked.error)return reply({error:"Não foi possível conferir os vínculos. Nenhum convite foi enviado."},503);
   if(linked.data.some(p=>p.id!==existing?.id))return reply({error:"Esta ficha já possui um acesso. Utilize a recuperação ou a alteração de senha da conta existente."},409);
  }
  const duplicate=await service.from("users").select("id").eq("clinicId",clinic).ilike("username",email.replace(/[%_]/g,"\\$&")).limit(2);
  if(duplicate.error)return reply({error:"Não foi possível conferir a conta. Nenhum convite foi enviado."},503);
  if(duplicate.data.some(p=>p.id!==existing?.id))return reply({error:"Este e-mail já possui cadastro de acesso. Utilize a conta existente ou selecione seu cadastro para vincular."},409);
  let newDoctor=false;
  if(body.role==="doctor"&&!doctorId){
   if(!String(body.crm||"").trim()||!String(body.specialty||"").trim())return reply({error:"Informe registro profissional e especialidade."},400);
   const matching=await service.from("doctors").select("id").eq("clinicId",clinic).eq("crm",String(body.crm).trim()).limit(1);
   if(matching.error)return reply({error:"Não foi possível conferir o registro profissional."},503);
   if(matching.data.length)return reply({error:"Já existe uma ficha com este registro profissional. Selecione a ficha existente para não duplicá-la."},409);
   doctorId=crypto.randomUUID();
   newDoctor=true;
  }
  const invited=await service.auth.admin.inviteUserByEmail(email,{redirectTo});
  if(invited.error)return reply(mailFailure(invited.error),mailStatus(invited.error));
  if(!invited.data.user)return reply({error:"O provedor não confirmou o convite. Nenhum vínculo foi criado."},502);
  const uid=invited.data.user.id;
  const bound=await service.from("users").select("id,clinicId").eq("authUserId",uid).limit(2);
  const patientBound=await service.from("patients").select("id").eq("authUserId",uid).limit(1);
  if(bound.error||patientBound.error||bound.data.some(p=>p.id!==existing?.id)||patientBound.data.length){
   return reply({error:"O e-mail foi processado pelo provedor, mas a identidade já tem outro vínculo ou não pôde ser conferida. Nenhum acesso foi substituído; solicite revisão administrativa."},409);
  }
  try {
   const rechecked=await service.from("users").select("id").eq("id",actor.id).eq("authUserId",verified.data.user.id).eq("clinicId",clinic).eq("role","admin").eq("active",true).maybeSingle();
   if(rechecked.error||!rechecked.data)throw Error("authority");
   if(newDoctor){
    const inserted=await service.from("doctors").insert({id:doctorId,name,crm:String(body.crm).trim(),specialty:String(body.specialty).trim(),email,phone:String(body.phone||""),"clinicId":clinic,active:true,availableTimes:[{dayOfWeek:"Segunda",startTime:"08:00",endTime:"18:00"}]});
    if(inserted.error)throw Error("doctor");
    createdDoctor=true;
   }
   const profile={id:existing?.id||crypto.randomUUID(),username:email,name,role:body.role,doctor_id:doctorId,clinicId:clinic,authUserId:uid,active:true,password:""};
   const saved=existing?await service.from("users").update(profile).eq("id",existing.id).eq("clinicId",clinic).is("authUserId",null).select("id"):await service.from("users").insert(profile).select("id");
   if(saved.error||saved.data?.length!==1)throw Error("profile");
   return reply({invited:true,email});
  } catch {
   // inviteUserByEmail may return an already-existing unconfirmed identity.
   // Never delete an account whose creation/ownership cannot be proven.
   if(createdDoctor)await service.from("doctors").delete().eq("id",doctorId).eq("clinicId",clinic);
   return reply({error:"O provedor aceitou o convite, mas o vínculo não foi salvo. O acesso à clínica não foi liberado. Solicite revisão antes de reenviar; nenhuma conta existente foi apagada."},500);
  }
 }catch {return reply({error:"Não foi possível concluir a solicitação."},500);}
});

function mailStatus(error:{code?:string;status?:number}){
 return error.status===429||error.code==="over_email_send_rate_limit"||error.code==="over_email_send_rate_limit_per_user"?429:
  error.code==="email_exists"||error.code==="user_already_exists"?409:502;
}
function mailFailure(error:{code?:string;status?:number}){
 const status=mailStatus(error);
 return {error:status===429?"O limite de envio de e-mails foi atingido. Aguarde antes de tentar novamente; não faça envios repetidos.":
  status===409?"Este e-mail já possui uma conta autenticada. Use a recuperação de senha ou solicite revisão do vínculo, sem criar outra conta.":
  "O provedor de e-mail não confirmou o envio. A administração deve verificar a autenticação SMTP, a senha da caixa postal e a permissão para aplicativos externos. Nenhum acesso foi liberado por esta solicitação."};
}
