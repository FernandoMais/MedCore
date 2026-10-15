import {readFile} from 'node:fs/promises';
import {validateFreshConfiguration} from './setup-fresh-admin.mjs';
const {ref} = validateFreshConfiguration(process.env);
if(ref!=='zktvrcaeztmzmsdjcjsa'||!process.argv.includes('--apply')) throw Error('Use --apply somente no destino autorizado.');
async function request(path,body,method='POST') {
 const multipart=body instanceof FormData;
 const r=await fetch(`https://api.supabase.com/v1/projects/${ref}${path}`,{
  method,headers:{Authorization:`Bearer ${process.env.SUPABASE_MIGRATION_ACCESS_TOKEN}`,
   ...(!multipart?{'Content-Type':'application/json'}:{})},
  ...(body?{body:multipart?body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(120000)});
 if(!r.ok) {
  const error=await r.json().catch(()=>({}));
  const safe=String(error.message||'').match(/(?:column|function|relation) ["']?([A-Za-z0-9_.]+)/)?.[1];
  throw Error(`Operação ${path} falhou: HTTP ${r.status}${safe?' ('+safe+')':''}.`);
 }
 const text=await r.text();
 return text.trim()?JSON.parse(text):null;
}
try {
 await request('/database/query',{query:await readFile('supabase/migrations/20261020_manual_payment_links.sql','utf8'),read_only:false});
 console.log(JSON.stringify({manualPaymentMigrationApplied:true}));
 if(process.argv.includes('--deploy-mail')) {
  const config=await request('/config/auth',null,'GET');
  if(!process.env.SMTP_PASSWORD||config.smtp_host!=='smtp.titan.email') throw Error('SMTP existente precisa de revisão.');
  await request('/secrets',[
   {name:'PAYMENT_SMTP_HOST',value:config.smtp_host},
   {name:'PAYMENT_SMTP_PORT',value:String(config.smtp_port)},
   {name:'PAYMENT_SMTP_USER',value:config.smtp_user},
   {name:'PAYMENT_SMTP_PASSWORD',value:process.env.SMTP_PASSWORD},
  ]);
  const form=new FormData();
  form.append('metadata',JSON.stringify({name:'appointment-payment-mail',entrypoint_path:'index.ts',verify_jwt:false}));
  form.append('file',new Blob([await readFile('supabase/functions/appointment-payment-mail/index.ts','utf8')],{type:'application/typescript'}),'index.ts');
  const deployed=await request('/functions/deploy?slug=appointment-payment-mail',form);
  console.log(JSON.stringify({mailServiceDeployed:deployed.slug==='appointment-payment-mail',status:deployed.status}));
 }
} catch(error) { console.error(error.message);process.exitCode=1; }
