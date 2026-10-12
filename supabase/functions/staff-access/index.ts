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
   return sent.error?reply({error:"O provedor não confirmou o envio. Tente novamente mais tarde."},502):reply({sent:true});
  }
  const email=String(body.email||"").trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return reply({error:"Informe um e-mail válido."},400);
  if(body.action!=="invite"||!["admin","doctor","collaborator"].includes(body.role))return reply({error:"Operação inválida."},400);
  const name=String(body.name||"").trim();if(!name||name.length>120)return reply({error:"Nome inválido."},400);
  let existing:any=null;
  if(body.profileId){
   const found=await service.from("users").select("id,authUserId,doctor_id,clinicId").eq("id",body.profileId).eq("clinicId",clinic).maybeSingle();
   if(found.error||!found.data||found.data.authUserId)return reply({error:"Este cadastro já tem vínculo ou não pode ser convidado."},409);
   existing=found.data;
  }
  let doctorId=existing?.doctor_id||null,createdDoctor=false;
  if(body.role==="doctor"&&!doctorId){
   if(!String(body.crm||"").trim()||!String(body.specialty||"").trim())return reply({error:"Informe registro profissional e especialidade."},400);
   doctorId=crypto.randomUUID();
  }
  const invited=await service.auth.admin.inviteUserByEmail(email,{redirectTo});
  if(invited.error||!invited.data.user)return reply({error:"Não foi possível enviar o convite. Verifique o provedor e se este e-mail já possui outra conta."},502);
  const uid=invited.data.user.id;
  try {
   const rechecked=await service.from("users").select("id").eq("id",actor.id).eq("authUserId",verified.data.user.id).eq("clinicId",clinic).eq("role","admin").eq("active",true).maybeSingle();
   if(rechecked.error||!rechecked.data)throw Error("authority");
   if(doctorId&&!existing?.doctor_id){
    const inserted=await service.from("doctors").insert({id:doctorId,name,crm:String(body.crm).trim(),specialty:String(body.specialty).trim(),email,phone:String(body.phone||""),"clinicId":clinic,active:true,availableTimes:[{dayOfWeek:"Segunda",startTime:"08:00",endTime:"18:00"}]});
    if(inserted.error)throw Error("doctor");
    createdDoctor=true;
   }
   const profile={id:existing?.id||crypto.randomUUID(),username:email,name,role:body.role,doctor_id:doctorId,clinicId:clinic,authUserId:uid,active:true,password:""};
   const saved=existing?await service.from("users").update(profile).eq("id",existing.id).eq("clinicId",clinic):await service.from("users").insert(profile);
   if(saved.error)throw Error("profile");
   return reply({invited:true,email});
  } catch {
   await service.auth.admin.deleteUser(uid);
   if(createdDoctor)await service.from("doctors").delete().eq("id",doctorId).eq("clinicId",clinic);
   return reply({error:"O vínculo não foi salvo. O convite foi invalidado; revise o cadastro antes de reenviar."},500);
  }
 }catch {return reply({error:"Não foi possível concluir a solicitação."},500);}
});
