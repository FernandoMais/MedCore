import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const items=new Map();
globalThis.localStorage={getItem:k=>items.get(k)||null,setItem:(k,v)=>items.set(k,v),removeItem:k=>items.delete(k)};
let actor={id:'synthetic-a',role:'doctor'};
globalThis.vaultTestSdk={
 auth:{getUser:async()=>({data:{user:{id:actor.id}},error:null})},
 rpc:async(name)=>{
  if((name.includes('admin')&&actor.role!=='admin')||(name==='operational_vault_key'&&actor.role==='collaborator'))return {error:{code:'42501'}};
  const digit=actor.id.endsWith('a')?(name.includes('admin')?'3':name.includes('general')?'4':'1'):'2';
  return {data:digit.repeat(64),error:null};
 },
};
const src=(await readFile(new URL('../services/draftVault.ts',import.meta.url),'utf8')).replace("import { supabase } from './supabase';",'const supabase=globalThis.vaultTestSdk;');
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const {draftVault}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
test('drafts stay encrypted and a different account cannot decrypt copied ciphertext',async()=>{
 actor={id:'synthetic-a',role:'doctor'};await draftVault.unlock('doctor');
 await draftVault.write('consultation',{complaint:'Conteúdo fictício sigiloso'});
 assert.ok(!JSON.stringify([...items.values()]).includes('Conteúdo fictício sigiloso'));
 assert.equal((await draftVault.read('consultation')).complaint,'Conteúdo fictício sigiloso');
 const ciphertext=items.get('medcore-encrypted-draft:synthetic-a:consultation');
 draftVault.lock();await assert.rejects(draftVault.read('consultation'),/fechado/);
 actor={id:'synthetic-b',role:'doctor'};await draftVault.unlock('doctor');
 items.set('medcore-encrypted-draft:synthetic-b:consultation',ciphertext);
 await assert.rejects(draftVault.read('consultation'));
});
test('administrative quarantine and clinical drafts are not unlocked after a role downgrade',async()=>{
 draftVault.lock();actor={id:'synthetic-a',role:'admin'};await draftVault.unlock('admin');
 await draftVault.write('legacy-drafts',{text:'Rascunho administrativo fictício'});
 draftVault.lock();actor.role='doctor';await draftVault.unlock('doctor');
 await assert.rejects(draftVault.read('legacy-drafts'),/fechado/);
 draftVault.lock();actor.role='collaborator';await draftVault.unlock('collaborator');
 await assert.rejects(draftVault.read('consultation'),/fechado/);
 await draftVault.write('pending-edits-collaborator',{changes:[]});
 assert.deepEqual(await draftVault.read('pending-edits-collaborator'),{changes:[]});
});
