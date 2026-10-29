import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the actual Edge handler without sending mail or accessing real users.
async function fixture({mailError=null,doctors=[],users=[],patients=[],saveFails=false}={}){
 const calls=[],actor={id:'admin-profile',authUserId:'admin-auth',clinicId:'clinic',role:'admin',active:true};
 let handler;
 const tables={users:[actor,...users],doctors:[...doctors],patients};
 class Query{
  constructor(table){this.table=table;this.filters=[];this.operation='select';}
  select(){return this;}
  eq(k,v){this.filters.push(r=>r[k]===v);return this;}
  is(k,v){this.filters.push(r=>(r[k]??null)===v);return this;}
  ilike(k,v){const value=v.replace(/\\([%_])/g,'$1').toLowerCase();this.filters.push(r=>String(r[k]||'').toLowerCase()===value);return this;}
  limit(){return this;}
  insert(row){this.operation='insert';this.row=row;return this;}
  update(row){this.operation='update';this.row=row;return this;}
  delete(){this.operation='delete';return this;}
  async execute(single=false){
   let rows=(tables[this.table]||[]).filter(r=>this.filters.every(f=>f(r)));
   if(this.operation!=='select'){
    calls.push({operation:this.operation,table:this.table});
    if(saveFails&&this.table==='users')return {data:null,error:{code:'fixture_failure'}};
    if(this.operation==='insert'){tables[this.table].push(this.row);rows=[this.row];}
    if(this.operation==='update')rows.forEach(r=>Object.assign(r,this.row));
    if(this.operation==='delete')tables[this.table]=tables[this.table].filter(r=>!rows.includes(r));
   }
   return {data:single?rows[0]||null:rows,error:null};
  }
  maybeSingle(){return this.execute(true);}
  then(resolve,reject){return this.execute().then(resolve,reject);}
 }
 const client={
  from:table=>new Query(table),
  rpc:async()=>({data:true,error:null}),
  auth:{
   getUser:async()=>({data:{user:{id:'admin-auth'}},error:null}),
   admin:{
    inviteUserByEmail:async()=>{calls.push({operation:'mail'});return {data:{user:mailError?null:{id:'invited-auth'}},error:mailError};},
    deleteUser:async()=>{throw Error('Existing identities must never be deleted');},
   },
  },
 };
 const source=(await readFile('supabase/functions/staff-access/index.ts','utf8')).replace(/^import .*;\n/,'');
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
 vm.runInNewContext(js,{createClient:()=>client,Deno:{env:{get:key=>({SUPABASE_URL:'https://example.invalid',PATIENT_CLINIC_ID:'clinic',PATIENT_APP_ORIGINS:'https://app.invalid'}[key]||'fixture')},serve:fn=>{handler=fn;}},
  Response,Request,Set,crypto,console});
 return {calls,tables,invite:async(body={})=>{
  const response=await handler(new Request('https://edge.invalid',{method:'POST',headers:{origin:'https://app.invalid',authorization:'Bearer fixture'},body:JSON.stringify({action:'invite',name:'Profissional fictício',email:'fixture@example.invalid',role:'doctor',crm:'TEST-1',specialty:'Clínica Geral',...body})}));
  return {status:response.status,body:await response.json()};
 }};
}

test('SMTP failure is explicit and creates no clinical or staff record',async()=>{
 const f=await fixture({mailError:{code:'unexpected_failure',status:500}});
 const r=await f.invite();
 assert.equal(r.status,502);assert.match(r.body.error,/SMTP/);
 assert.deepEqual(f.calls,[{operation:'mail'}]);
});
test('native mail quota and existing identity are distinguished',async()=>{
 for(const [error,status,text] of [[{status:429},429,/limite/],[{code:'email_exists'},409,/já possui/]]){
  const f=await fixture({mailError:error});const r=await f.invite();
  assert.equal(r.status,status);assert.match(r.body.error,text);
 }
});
test('existing professional is reused by explicit selection or exact email',async()=>{
 for(const selected of [true,false]){
  const f=await fixture({doctors:[{id:'existing-doctor',clinicId:'clinic',email:'fixture@example.invalid'}]});
  const r=await f.invite(selected?{doctorId:'existing-doctor',crm:'',specialty:''}:{});
  assert.equal(r.status,200);assert.equal(r.body.invited,true);
  assert.equal(f.tables.doctors.length,1);
  assert.equal(f.tables.users.find(u=>u.id!=='admin-profile').doctor_id,'existing-doctor');
 }
});
test('new professional creates one doctor and one authenticated profile',async()=>{
 const f=await fixture();assert.equal((await f.invite()).status,200);
 assert.equal(f.tables.doctors.length,1);assert.equal(f.tables.users.length,2);
 assert.equal(f.tables.users[1].authUserId,'invited-auth');
});
test('foreign clinic, already-linked doctor and duplicate CRM fail before email',async()=>{
 for(const options of [
  {doctors:[{id:'doctor-1',clinicId:'other'}]},
  {doctors:[{id:'doctor-1',clinicId:'clinic'}],users:[{id:'other-profile',clinicId:'clinic',doctor_id:'doctor-1'}]},
  {doctors:[{id:'doctor-1',clinicId:'clinic',crm:'TEST-1'}]},
 ]){
  const f=await fixture(options);const r=await f.invite(options.doctors[0].crm?{}:{doctorId:'doctor-1'});
  assert.ok(r.status>=400);assert.equal(f.calls.length,0);
 }
});
test('profile save failure preserves pre-existing doctor and never deletes Auth identity',async()=>{
 const f=await fixture({doctors:[{id:'doctor-1',clinicId:'clinic'}],saveFails:true});
 const r=await f.invite({doctorId:'doctor-1'});
 assert.equal(r.status,500);assert.match(r.body.error,/vínculo não foi salvo/);
 assert.equal(f.tables.doctors.length,1);
});
test('patient identity cannot be repurposed as staff access',async()=>{
 const f=await fixture({patients:[{id:'patient-1',authUserId:'invited-auth'}]});
 assert.equal((await f.invite()).status,409);
 assert.equal(f.tables.users.length,1);assert.equal(f.tables.doctors.length,0);
});
