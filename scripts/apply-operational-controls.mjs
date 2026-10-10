import { readFile } from 'node:fs/promises';
import { validateFreshConfiguration } from './setup-fresh-admin.mjs';
const { ref } = validateFreshConfiguration(process.env);
if(ref!=='zktvrcaeztmzmsdjcjsa') throw Error('Destino não autorizado.');
if(!process.argv.includes('--apply')) throw Error('Use --apply para o destino autorizado.');
const query=await readFile('supabase/migrations/20261010_operational_controls.sql','utf8');
const r=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{
 method:'POST',headers:{Authorization:`Bearer ${process.env.SUPABASE_MIGRATION_ACCESS_TOKEN}`,'Content-Type':'application/json'},
 body:JSON.stringify({query,read_only:false}),signal:AbortSignal.timeout(120000)});
if(!r.ok) {
 const body=await r.json().catch(()=>({}));
 const text=String(body.message||body.error||'');
 const field=text.match(/column "([A-Za-z0-9_]+)"/)?.[1];
 console.error(JSON.stringify({applied:false,status:r.status,field,code:body.code}));
 process.exitCode=1;
} else console.log(JSON.stringify({operationalMigrationApplied:true}));
