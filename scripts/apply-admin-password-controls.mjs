import {readFile} from 'node:fs/promises';
import {validateFreshConfiguration} from './setup-fresh-admin.mjs';
const {ref}=validateFreshConfiguration(process.env);
if(ref!=='zktvrcaeztmzmsdjcjsa'||!process.argv.includes('--apply'))throw Error('Destino/comando não autorizado.');
const query=await readFile('supabase/migrations/20261013_admin_password_controls.sql','utf8');
const r=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{
 method:'POST',headers:{Authorization:`Bearer ${process.env.SUPABASE_MIGRATION_ACCESS_TOKEN}`,'Content-Type':'application/json'},
 body:JSON.stringify({query,read_only:false}),signal:AbortSignal.timeout(120000)});
if(!r.ok){const body=await r.json().catch(()=>({}));console.error(JSON.stringify({applied:false,status:r.status,code:body.code}));process.exitCode=1;}
else console.log(JSON.stringify({adminPasswordControlsApplied:true}));
