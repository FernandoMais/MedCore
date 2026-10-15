// Native integration checks use only tagged synthetic people/appointments.
// No provider API requests, money movements, patient emails or data are printed.
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {validateFreshConfiguration} from './setup-fresh-admin.mjs';
const {ref,clinic}=validateFreshConfiguration(process.env);
const url=`https://${ref}.supabase.co`,tag=randomUUID(),report={};
const ids={d:`bill-d-${tag}`,d2:`bill-d2-${tag}`,p:`bill-p-${tag}`,a:randomUUID(),b:randomUUID()};
const authIds=[],userIds=[];let service,stage='setup';
const checked=result=>{if(result.error)throw Error(`API ${result.error.code||result.status}: ${result.error.message}`);return result.data;};
const rpc=async(client,name,args={})=>checked(await client.rpc(name,args));
async function person(anon,role,doctorId) {
 const email=`billing-${role}-${randomUUID()}@example.invalid`,password=randomBytes(24).toString('base64url')+'Aa9!';
 const u=checked(await service.auth.admin.createUser({email,password,email_confirm:true})).user;authIds.push(u.id);
 if(role!=='patient') {
  const id=randomUUID();userIds.push(id);
  checked(await service.from('users').insert({id,username:email,name:'Pessoa fictícia de teste financeiro',role,doctor_id:doctorId||null,clinicId:clinic,authUserId:u.id,active:true,password:''}));
 }
 const client=createClient(url,anon,{auth:{persistSession:false}});
 const session=checked(await client.auth.signInWithPassword({email,password})).session;
 return {client,uid:u.id,email,token:session.access_token};
}
try {
 const r=await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys?reveal=true`,{headers:{Authorization:`Bearer ${process.env.SUPABASE_MIGRATION_ACCESS_TOKEN}`}});
 assert.ok(r.ok);const keys=await r.json(),anon=keys.find(k=>k.name==='anon').api_key;
 service=createClient(url,keys.find(k=>k.name==='service_role').api_key,{auth:{persistSession:false}});
 checked(await service.from('doctors').insert([
  {id:ids.d,name:'Médico fictício financeiro',crm:`TEST-${tag}`,specialty:'Clínica Geral',clinicId:clinic,availableTimes:[]},
  {id:ids.d2,name:'Outro médico fictício',crm:`TEST2-${tag}`,specialty:'Clínica Geral',clinicId:clinic,availableTimes:[]},
 ]));
 const admin=await person(anon,'admin'),doctor=await person(anon,'doctor',ids.d),
 other=await person(anon,'doctor',ids.d2),patient=await person(anon,'patient'),
 secretary=await person(anon,'secretaria'),treasury=await person(anon,'tesouraria');
 checked(await service.from('patients').insert({id:ids.p,name:'Paciente fictício financeiro',birthDate:'1990-01-01',
  gender:'Masculino',cpf:tag.replaceAll('-','').slice(0,11),email:patient.email,clinicId:clinic,primaryDoctorId:ids.d,authUserId:patient.uid,files:[]}));
 const profile={doctorId:ids.d,price:200,doctorPercent:40,paymentUrl:'https://payments.example.invalid/consulta',
  bank:'Banco fictício',agency:'0000',account:'00000',pixKey:'pix-ficticio'};
 stage='profile';
 await rpc(admin.client,'manual_billing_save_profile',{p_profile:profile});
 assert.ok((await doctor.client.rpc('manual_billing_save_profile',{p_profile:profile})).error);
 assert.ok((await patient.client.from('manual_fee_profiles').select('*')).error);
 const directory=checked(await patient.client.from('patient_portal_doctors').select('*'));
 assert.equal(directory.find(d=>d.id===ids.d).consultationPrice,200);
 assert.ok(!directory.some(d=>'pix_key' in d || 'bank' in d));
 report.privateBankingAndTrustedPublicPrice=true;
 stage='booking';
 const date=new Date().toISOString().slice(0,10);
 const booked=checked(await patient.client.from('appointments').insert({id:ids.a,patientId:ids.p,doctorId:ids.d,clinicId:clinic,
  date,time:'10:00',type:'Consulta',status:'Agendado',serviceValue:1,repassRule:{type:'percentage',value:99},paymentUrl:'https://wrong.example.invalid'}).select('*').single());
 assert.equal(Number(booked.serviceValue),200);assert.equal(booked.repassRule.value,40);
 assert.equal(booked.paymentUrl,profile.paymentUrl);
 assert.equal(checked(await service.from('financial_transactions').select('id').eq('appointmentId',ids.a)).length,1);
 const early=await rpc(doctor.client,'manual_billing_snapshot');
 assert.ok(!early.rows.some(r=>r.appointmentId===ids.a));
 const legacyEarly=await rpc(doctor.client,'operational_snapshot');
 assert.ok(!legacyEarly.tables.financial_transactions.some(t=>t.appointmentId===ids.a));
 assert.ok((await patient.client.rpc('manual_billing_snapshot')).error);
 report.trustedBookingSnapshotsAndNoPrematureDoctorEarnings=true;
 stage='snapshot_immutability';
 let adminView=await rpc(admin.client,'manual_billing_snapshot');
 const savedProfile=adminView.profiles.find(p=>p.doctorId===ids.d);
 await rpc(treasury.client,'manual_billing_save_profile',{p_profile:{...savedProfile,price:250,paymentUrl:'https://payments.example.invalid/consulta-250'},p_expected:savedProfile.version});
 const unchanged=checked(await service.from('appointments').select('serviceValue').eq('id',ids.a).single());
 assert.equal(Number(unchanged.serviceValue),200);
 assert.ok((await admin.client.rpc('manual_billing_save_profile',{p_profile:{...savedProfile,price:300},p_expected:savedProfile.version})).error);
 report.historicalPriceAndConcurrentProfileEditsProtected=true;
 stage='receipt';
 let row=adminView.rows.find(r=>r.appointmentId===ids.a);
 const params={p_appointment:ids.a,p_amount:200,p_date:date,p_reference:`test-${tag}`,p_expected:row.version};
 assert.ok((await doctor.client.rpc('manual_billing_confirm',params)).error);
 assert.ok((await admin.client.rpc('manual_billing_confirm',{...params,p_amount:1})).error);
 const confirmations=await Promise.all([secretary.client.rpc('manual_billing_confirm',params),treasury.client.rpc('manual_billing_confirm',params)]);
 assert.equal(confirmations.filter(r=>!r.error).length,1);
 assert.equal(checked(await service.from('manual_receipts').select('appointment_id').eq('appointment_id',ids.a)).length,1);
 adminView=await rpc(admin.client,'manual_billing_snapshot');row=adminView.rows.find(r=>r.appointmentId===ids.a);
 assert.equal(row.paymentStatus,'pago');assert.equal(row.repassAmount,80);
 assert.ok((await admin.client.rpc('manual_billing_payout',{p_appointment:ids.a,p_date:date,p_expected:row.version})).error);
 assert.ok(!(await rpc(doctor.client,'manual_billing_snapshot')).rows.some(r=>r.appointmentId===ids.a));
 report.singleManualReceiptAndNoPayoutBeforeClinicalCompletion=true;
 stage='clinical_finish';
 const before=await rpc(doctor.client,'operational_snapshot');
 await rpc(doctor.client,'operational_finish_consultation',{p_appointment_id:ids.a,p_expected:before.versions.appointments[ids.a],
  p_input:{complaint:'Atendimento exclusivamente fictício de teste financeiro',diagnosis:'',conduct:'',prescription:'',especialidade:'Clínica Geral'}});
 const own=await rpc(doctor.client,'manual_billing_snapshot'),foreign=await rpc(other.client,'manual_billing_snapshot');
 row=own.rows.find(r=>r.appointmentId===ids.a);
 assert.equal(row.status,'Finalizado');assert.equal(row.repassAmount,80);
 assert.ok(!foreign.rows.some(r=>r.appointmentId===ids.a));
 assert.ok(!foreign.profiles.some(p=>p.doctorId===ids.d));
 await rpc(treasury.client,'manual_billing_payout',{p_appointment:ids.a,p_date:date,p_expected:row.version});
 assert.ok((await treasury.client.rpc('manual_billing_payout',{p_appointment:ids.a,p_date:date,p_expected:row.version})).error);
 assert.equal((await rpc(doctor.client,'manual_billing_snapshot')).rows.find(r=>r.appointmentId===ids.a).repassStatus,'pago');
 report.finishedOwnConsultationsOnlyAndSinglePayout=true;
 stage='email_authorization';
 const unauth=await fetch(`${url}/functions/v1/appointment-payment-mail`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({appointmentId:ids.a})});
 assert.equal(unauth.status,401);
 assert.ok((await patient.client.rpc('manual_billing_mail_claim',{p_uid:patient.uid,p_appointment:ids.a})).error);
 checked(await patient.client.from('appointments').insert({id:ids.b,patientId:ids.p,doctorId:ids.d,clinicId:clinic,date,time:'11:00',type:'Consulta',status:'Agendado'}));
 const claim=await rpc(service,'manual_billing_mail_claim',{p_uid:patient.uid,p_appointment:ids.b});
 assert.equal(Number(claim.amount),250);
 assert.ok((await service.rpc('manual_billing_mail_claim',{p_uid:patient.uid,p_appointment:ids.b})).error);
 const verified=await fetch(`${url}/functions/v1/appointment-payment-mail`,{method:'POST',
  headers:{Authorization:`Bearer ${admin.token}`,'Content-Type':'application/json'},body:JSON.stringify({appointmentId:ids.b,action:'verify-smtp'}),signal:AbortSignal.timeout(65000)});
 const mail=await verified.json();
 assert.equal(mail.smtpVerified,true);
 report.nativeEmailTransportAuthenticatedAndResendsRateLimited=true;
 stage='backup';
 const backup=await rpc(admin.client,'operational_snapshot',{p_backup:true});
 const allIds=new Set([...Object.values(ids),...userIds]);
 const subset={...backup,tables:Object.fromEntries(Object.entries(backup.tables).map(([t,rows])=>[t,rows.filter(r=>
  allIds.has(r.id)||allIds.has(r.doctor_id)||allIds.has(r.appointment_id)||allIds.has(r.patient_id)||allIds.has(r.record_id))]))};
 const proof=await rpc(admin.client,'operational_validate_restore',{p_backup:subset});
 assert.equal(proof.validated,true);assert.equal(Number(proof.counts.manual_fee_profiles),1);
 checked(await service.from('manual_fee_profiles').delete().eq('doctor_id',ids.d));
 const restored=await rpc(admin.client,'operational_restore_merge',{p_backup:subset});
 assert.ok(restored.inserted>=1);
 assert.equal(Number(checked(await service.from('manual_fee_profiles').select('price').eq('doctor_id',ids.d).single()).price),250);
 report.newFinancialCollectionsIncludedInEncryptedBackupValidation=true;
 console.log(JSON.stringify({checks:report,syntheticOnly:true,noProviderCalls:true}));
} catch(error) {
 console.error(JSON.stringify({stage,error:String(error.message).replace(/https?:\/\/\S+|[\w.+-]+@[\w.-]+/g,'[redacted]').slice(0,350)}));
 process.exitCode=1;
} finally {
 if(service) {
  for(const t of ['manual_payment_mail','manual_receipts','manual_payouts']) await service.from(t).delete().in('appointment_id',[ids.a,ids.b]);
  await service.from('manual_fee_profiles').delete().eq('doctor_id',ids.d);
  for(const t of ['financial_repasses','financial_transactions']) await service.from(t).delete().in('appointmentId',[ids.a,ids.b]);
  await service.from('evolucao_paciente').delete().eq('paciente_id',ids.p);
  await service.from('appointments').delete().in('id',[ids.a,ids.b]);
  await service.from('patients').delete().eq('id',ids.p);
  if(userIds.length) await service.from('users').delete().in('id',userIds);
  await service.from('doctors').delete().in('id',[ids.d,ids.d2]);
  // Remove audit events only for these fictitious identifiers/actors.
  await service.from('operational_audit').delete().in('record_id',[...Object.values(ids),...userIds]);
  if(authIds.length) await service.from('operational_audit').delete().in('actor_uid',authIds);
  for(const id of authIds) await service.auth.admin.deleteUser(id);
  console.log(JSON.stringify({fixtureCleanupCompleted:true}));
 }
}
