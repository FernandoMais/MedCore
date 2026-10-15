import {createClient} from "https://esm.sh/@supabase/supabase-js@2.49.1";
import nodemailer from "npm:nodemailer@7.0.10";

const origins = (Deno.env.get("PATIENT_APP_ORIGINS") || "").split(",");
const escape = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, c =>
  ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
Deno.serve(async req => {
  const origin = req.headers.get("origin") || "";
  const headers = {"Content-Type":"application/json", "Vary":"Origin",
    ...(origins.includes(origin) ? {"Access-Control-Allow-Origin":origin} : {}),
    "Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info",
    "Access-Control-Allow-Methods":"POST,OPTIONS"};
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status,headers});
  if (origin && !origins.includes(origin)) return reply({error:"Origem não autorizada."},403);
  if (req.method === "OPTIONS") return new Response(null,{status:204,headers});
  if (req.method !== "POST") return reply({error:"Método não autorizado."},405);
  try {
    const authorization = req.headers.get("authorization") || "";
    const client = createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,
      {global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
    const verified = await client.auth.getUser();
    if (verified.error || !verified.data.user?.email_confirmed_at) return reply({error:"Entre novamente para enviar o link."},401);
    // Password reset and staff deactivation must invalidate resend permissions too.
    const {data: valid} = await client.rpc("operational_session_valid");
    if (!valid) return reply({error:"Sessão encerrada. Entre novamente."},401);
    const body = await req.json();
    if (typeof body?.appointmentId !== "string" || body.appointmentId.length > 160)
      return reply({error:"Agendamento inválido."},400);
    const service = createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      {auth:{persistSession:false}});
    if (body.action === "verify-smtp") {
      const {data: actor} = await service.from("users").select("role,active").eq("authUserId",verified.data.user.id).maybeSingle();
      if (!actor?.active || actor.role !== "admin") return reply({error:"Administrador necessário."},403);
      const transport = nodemailer.createTransport({host:Deno.env.get("PAYMENT_SMTP_HOST"),
        port:Number(Deno.env.get("PAYMENT_SMTP_PORT")),secure:Deno.env.get("PAYMENT_SMTP_PORT")==="465",
        requireTLS:Deno.env.get("PAYMENT_SMTP_PORT")==="587",
        auth:{user:Deno.env.get("PAYMENT_SMTP_USER"),pass:Deno.env.get("PAYMENT_SMTP_PASSWORD")},
        connectionTimeout:15000,greetingTimeout:15000,socketTimeout:20000,tls:{rejectUnauthorized:true}});
      await transport.verify(); transport.close();
      return reply({smtpVerified:true});
    }
    const {data,error} = await service.rpc("manual_billing_mail_claim",
      {p_uid:verified.data.user.id,p_appointment:body.appointmentId});
    if (error || !data) return reply({sent:false,error:"Envio não autorizado, link indisponível ou reenvio recente. Confira o agendamento e aguarde dois minutos."},400);
    const url = new URL(data.paymentUrl);
    if (url.protocol !== "https:" || url.username || url.password) throw Error("invalid_link");
    const host = Deno.env.get("PAYMENT_SMTP_HOST");
    const port = Number(Deno.env.get("PAYMENT_SMTP_PORT"));
    const user = Deno.env.get("PAYMENT_SMTP_USER");
    const password = Deno.env.get("PAYMENT_SMTP_PASSWORD");
    if (host !== "smtp.titan.email" || ![465,587].includes(port) || !user || !password) throw Error("smtp_configuration");
    const transport = nodemailer.createTransport({host,port,secure:port===465,requireTLS:port===587,
      auth:{user,pass:password},connectionTimeout:15000,greetingTimeout:15000,socketTimeout:20000,
      tls:{rejectUnauthorized:true}});
    const amount = Number(data.amount).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
    const date = String(data.date).split("-").reverse().join("/");
    const text = `Seu agendamento foi registrado para ${date}, às ${data.time}.\nValor: ${amount}.\nLink para pagamento: ${url.href}\n\nO recebimento será conferido pela equipe. Abrir o link não confirma o pagamento.\nReferência do agendamento: ${body.appointmentId}\nSe outra pessoa pagar, informe à equipe para localizar o recebimento.`;
    const result = await transport.sendMail({
      from:{name:"MedCore — agendamentos",address:user},to:data.email,
      subject:"Agendamento e link de pagamento",
      text,html:`<p>Seu agendamento foi registrado para <strong>${escape(date)}</strong>, às ${escape(data.time)}.</p><p>Valor: ${escape(amount)}</p><p><a href="${escape(url.href)}">Pagar consulta</a></p><p>O recebimento será conferido pela equipe. Abrir o link não confirma o pagamento.</p><p>Referência: ${escape(body.appointmentId)}</p><p>Se outra pessoa pagar, informe à equipe.</p>`,
      disableFileAccess:true,disableUrlAccess:true,
    });
    transport.close();
    if (!result.accepted?.length) throw Error("mail_not_accepted");
    await service.from("manual_payment_mail").update({sent_at:new Date().toISOString()}).eq("appointment_id",body.appointmentId);
    return reply({sent:true});
  } catch {
    // No addresses, payment links, SMTP replies or credentials in logs.
    console.error("payment_mail_failed");
    return reply({sent:false,error:"O agendamento permanece salvo, mas não foi possível enviar o e-mail. Use o link disponível na tela ou tente reenviar."},503);
  }
});
