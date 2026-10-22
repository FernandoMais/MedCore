import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

const source=await readFile(new URL('../services/operationalStorage.ts',import.meta.url),'utf8');
let sequence=0;
async function fixture(){
 const vault=new Map([['pending-edits-admin',{changes:[{table:'doctors',id:'d1',expected:'v1',row:{name:'Alteração protegida'}}]}]]);
 const calls=[];
 let row={id:'d1',name:'Confirmado'},version='v1';
 const emptyDatabase=()=>({patients:[],doctors:[],appointments:[],medications:[],users:[],financial:{},sigilousNotes:[],evolutions:[]});
 const state={mode:'success',removeFails:false};
 const deps={
  emptyDatabase,localDatabaseKey:()=> 'fixture-empty',
  draftVault:{
   unlock:async()=>{},lock:()=>{},read:async key=>structuredClone(vault.get(key)),
   write:async(key,value)=>vault.set(key,structuredClone(value)),
   remove:async key=>{if(state.removeFails)throw Error('Falha local simulada');vault.delete(key);},
  },
  supabase:{rpc:async(name,args)=>{
   calls.push(name);
   if(name==='operational_snapshot')return {data:{clinicId:'clinic',tables:{doctors:[structuredClone(row)]},versions:{doctors:{d1:version}}}};
   assert.equal(name,'operational_sync');
   if(state.mode==='conflict'||args.p_changes[0].expected!==version)return {error:{code:'PT409'}};
   row={...row,...args.p_changes[0].row};version='v2';
   if(state.mode==='session-change')deps.storage.resetCloudSyncState();
   return {data:state.mode==='incomplete'?[]:[{table:'doctors',id:'d1',version,row:structuredClone(row)}]};
  }},
 };
 globalThis.__pendingRecoveryFixture=deps;
 globalThis.localStorage={getItem:()=>null,removeItem:()=>{}};
 const prepared=source
  .replace("import { supabase } from './supabase';",'const {supabase,emptyDatabase,localDatabaseKey,draftVault}=globalThis.__pendingRecoveryFixture;')
  .replace("import { emptyDatabase, localDatabaseKey } from './freshStart';",'')
  .replace("import { removeLegacyPatientPassword } from './patientCredentials';",'const removeLegacyPatientPassword=value=>value;')
  .replace("import { draftVault } from './draftVault';",'')
  .replaceAll('import.meta.env',"({VITE_FRESH_TARGET_REF:'fixture',VITE_CLINIC_ID:'clinic'})");
 const js=ts.transpileModule(prepared,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
 const {storage}=await import(`data:text/javascript;base64,${Buffer.from(js+`\n// ${sequence++}`).toString('base64')}`);
 deps.storage=storage;
 await storage.prepareSession('admin');
 const db=await storage.fetchFromCloud('clinic');
 return {storage,vault,calls,state,db};
}
test('protected pending edits block writes but allow a read-only comparison without deleting the vault',async()=>{
 const f=await fixture();
 await assert.rejects(f.storage.syncToCloud(f.db,'clinic'),/pendências protegidas/);
 const confirmed=await f.storage.fetchFromCloud('clinic');
 assert.equal(confirmed.doctors[0].name,'Confirmado');
 assert.equal((await f.storage.getPendingChanges()).changes[0].row.name,'Alteração protegida');
 assert.equal(f.calls.filter(c=>c==='operational_sync').length,0);
});
test('review exposes local and confirmed values without changing or submitting protected edits',async()=>{
 const f=await fixture();
 const original=structuredClone(f.vault.get('pending-edits-admin'));
 const items=await f.storage.inspectPendingChanges();
 assert.equal(items[0].current.name,'Confirmado');
 assert.equal(items[0].row.name,'Alteração protegida');
 assert.equal(items[0].conflict,false);
 assert.equal(items[0].applied,false);
 assert.deepEqual(f.vault.get('pending-edits-admin'),original);
 assert.equal(f.calls.filter(c=>c==='operational_sync').length,0);
 f.vault.get('pending-edits-admin').changes[0].expected='older-version';
 assert.equal((await f.storage.inspectPendingChanges())[0].conflict,true);
 f.vault.get('pending-edits-admin').changes[0].row.name='Confirmado';
 assert.equal((await f.storage.inspectPendingChanges())[0].applied,true);
 assert.ok((await f.storage.getPendingChanges()).changes.length);
});
test('recovery clears the protected copy only after a full server acknowledgment, then reloads without flushing old data',async()=>{
 const f=await fixture();
 await f.storage.recoverPendingChanges();
 assert.equal(await f.storage.getPendingChanges(),undefined);
 const confirmed=await f.storage.fetchFromCloud('clinic');
 assert.equal(confirmed.doctors[0].name,'Alteração protegida');
 await f.storage.syncToCloud(confirmed,'clinic');
 assert.equal(f.calls.filter(c=>c==='operational_sync').length,1);
});
test('a stale-write conflict preserves the local copy and never retries with a newer version',async()=>{
 const f=await fixture();f.state.mode='conflict';
 await assert.rejects(f.storage.recoverPendingChanges(),/Conflito de gravação/);
 assert.ok((await f.storage.getPendingChanges()).changes.length);
 await assert.rejects(f.storage.syncToCloud(f.db,'clinic'),/pendências protegidas/);
 assert.equal(f.calls.filter(c=>c==='operational_sync').length,1);
});
test('an incomplete acknowledgment preserves the copy and a later confirmed comparison prevents duplicate submission',async()=>{
 const f=await fixture();f.state.mode='incomplete';
 await assert.rejects(f.storage.recoverPendingChanges(),/não confirmou todas/);
 assert.ok((await f.storage.getPendingChanges()).changes.length);
 await f.storage.fetchFromCloud('clinic');
 await f.storage.recoverPendingChanges();
 assert.equal(await f.storage.getPendingChanges(),undefined);
 assert.equal(f.calls.filter(c=>c==='operational_sync').length,1);
});
test('a session change during recovery cannot clear the protected copy',async()=>{
 const f=await fixture();f.state.mode='session-change';
 await assert.rejects(f.storage.recoverPendingChanges(),/sessão mudou/);
 assert.ok((await f.storage.getPendingChanges()).changes.length);
});
test('a failed explicit discard leaves the pending write lock active',async()=>{
 const f=await fixture();f.state.removeFails=true;
 await assert.rejects(f.storage.discardPendingChanges(),/Falha local/);
 await assert.rejects(f.storage.syncToCloud(f.db,'clinic'),/pendências protegidas/);
 assert.ok((await f.storage.getPendingChanges()).changes.length);
});
