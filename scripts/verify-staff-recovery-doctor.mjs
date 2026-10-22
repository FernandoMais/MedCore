// Synthetic native checks only. No messages are sent and no tokens or account
// details are printed. Existing patient and staff records are never modified.
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {validateFreshConfiguration} from './setup-fresh-admin.mjs';
const {ref,clinic}=validateFreshConfiguration(process.env),url=`https://${ref}.supabase.co`;
const fixtures=[],profiles=[],doctorId=`recovery-doctor-${randomUUID()}`,report={};
let service,stage='metadata';
const checked=result=>{if(result.error)throw Error(`Native check ${result.error.code||result.status||'rejected'}`);return result.data;};
try{
 const response=await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys?reveal=true`,{headers:{Authorization:`Bearer ${process.env.SUPABASE_MIGRATION_ACCESS_TOKEN}`}});
 assert.ok(response.ok,`Management HTTP ${response.status}`);
 const keys=await response.json(),anon=keys.find(k=>k.name==='anon').api_key;
 service=createClient(url,keys.find(k=>k.name==='service_role').api_key,{auth:{persistSession:false}});
 const configResponse=await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`,{headers:{Authorization:`Bearer ${process.env.SUPABASE_MIGRATION_ACCESS_TOKEN}`}});
 assert.ok(configResponse.ok);const config=await configResponse.json();
 report.configuration={siteOrigin:new URL(config.site_url).origin,
  tokenHashTemplate:config.mailer_templates_recovery_content?.includes('.TokenHash')||false,
  staffCallbackTemplate:config.mailer_templates_recovery_content?.includes('staff-auth=recovery')||false};
 checked(await service.from('doctors').insert({id:doctorId,name:'Profissional fictício de validação',crm:`TEST-${randomUUID()}`,specialty:'Clínica Geral',clinicId:clinic,availableTimes:[]}));
 for(const role of ['admin','doctor','collaborator','secretaria','tesouraria']){
  stage=`recovery-${role}`;
  const email=`recovery-${randomUUID()}@example.invalid`,password=randomBytes(24).toString('base64url')+'Aa9!';
  const user=checked(await service.auth.admin.createUser({email,password,email_confirm:true})).user;fixtures.push(user.id);
  const id=randomUUID();profiles.push(id);
  checked(await service.from('users').insert({id,username:email,name:'Equipe fictícia de validação',role,clinicId:clinic,authUserId:user.id,active:true,password:'',doctor_id:role==='doctor'?doctorId:null}));
  const generated=checked(await service.auth.admin.generateLink({type:'recovery',email}));
  let client=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
  checked(await client.auth.verifyOtp({type:'recovery',token_hash:generated.properties.hashed_token}));
  const native=checked(await client.auth.getUser());
  const profile=checked(await client.from('users').select('role,clinicId,active').eq('authUserId',native.user.id).maybeSingle());
  assert.equal(profile?.clinicId,clinic);assert.equal(profile.role,role);assert.equal(profile.active,true);
  report[role]={nativeRecoveryAndProfile:true};
  if(process.argv.includes('--browser')&&['admin','secretaria'].includes(role)){
   stage=`browser-recovery-${role}`;
   const {chromium}=await import('playwright');
   const browser=await chromium.launch({executablePath:'/repl/tools/bin/chromium',headless:true,args:['--no-sandbox']});
   try{
    const browserLink=checked(await service.auth.admin.generateLink({type:'recovery',email}));
    const target=process.argv.find(arg=>arg.startsWith('--app='))?.slice(6)||config.site_url;
    const page=await browser.newPage();
    await page.goto(`${new URL(target).origin}/?staff-auth=recovery&token_hash=${encodeURIComponent(browserLink.properties.hashed_token)}&type=recovery`,{waitUntil:'networkidle'});
    const ready=await page.getByRole('button',{name:'Salvar nova senha',exact:true}).isVisible();
    report[role].browserReady=ready;
    if(!ready)report[role].browserMessage=await page.getByRole('status').textContent();
    if(ready){
     const browserPassword=randomBytes(24).toString('base64url')+'Aa9!';
     await page.getByLabel('Nova senha',{exact:true}).fill(browserPassword);
     await page.getByLabel('Confirmar senha',{exact:true}).fill(browserPassword);
     await page.getByRole('button',{name:'Salvar nova senha',exact:true}).click();
     await page.getByText('Senha atualizada. Volte ao início e entre com seu e-mail e a nova senha.',{exact:true}).waitFor();
     const login=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
     checked(await login.auth.signInWithPassword({email,password:browserPassword}));
     client=login;
     report[role].browserPasswordSavedAndLoginVerified=true;
    }
    // No screenshots, traces, URLs or generated credentials are written.
   }finally{await browser.close();}
  }
  if(role==='admin'){
   stage='doctor-save';
   const snapshot=checked(await client.rpc('operational_snapshot'));
   const save=checked(await client.rpc('operational_sync',{p_changes:[{table:'doctors',id:doctorId,expected:snapshot.versions.doctors[doctorId],row:{email:'ficticio@example.invalid',phone:'00000000000',availableTimes:[{dayOfWeek:'Segunda',startTime:'09:00',endTime:'12:00'}]}}]}));
   assert.equal(save[0].row.email,'ficticio@example.invalid');assert.equal(save[0].row.phone,'00000000000');
   assert.equal(save[0].row.availableTimes[0].startTime,'09:00');report.doctorSave={contactAndSchedulePersisted:true};
  }
  const general=checked(await client.rpc('operational_general_vault_key'));
  assert.match(general,/^[a-f0-9]{64}$/i);
  if(['collaborator','secretaria','tesouraria'].includes(role)){
   assert.ok((await client.rpc('operational_vault_key')).error);
   assert.ok((await client.rpc('operational_admin_vault_key')).error);
  }else assert.match(checked(await client.rpc('operational_vault_key')),/^[a-f0-9]{64}$/i);
  report[role].pendingDraftKeyScopeVerified=true;
  if(!report[role].browserPasswordSavedAndLoginVerified)checked(await client.auth.updateUser({password:randomBytes(24).toString('base64url')+'Aa9!'}));
  report[role].passwordChanged=true;
 }
 if(process.argv.includes('--require-browser'))assert.ok(report.admin.browserPasswordSavedAndLoginVerified&&report.secretaria.browserPasswordSavedAndLoginVerified,'Browser flow did not complete');
 console.log(JSON.stringify({report,syntheticOnly:true,noEmailSent:true}));
}catch(error){console.error(JSON.stringify({stage,error:stage.startsWith('browser-')?'Falha na verificação de navegador; nenhuma credencial foi registrada.':error.message}));process.exitCode=1;}
finally{
 if(service){
  await service.from('audit_events').delete().in('actor_uid',fixtures);
  if(profiles.length)await service.from('users').delete().in('id',profiles);
  for(const uid of fixtures)await service.auth.admin.deleteUser(uid);
  await service.from('doctors').delete().eq('id',doctorId);
  await service.from('audit_events').delete().eq('entity_id',doctorId);
 }
 console.log(JSON.stringify({fixtureCleanupCompleted:true}));
}
