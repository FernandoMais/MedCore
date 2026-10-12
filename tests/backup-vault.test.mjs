import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../services/backupVault.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const {encryptBackup,decryptBackup}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const example={schemaVersion:1,clinicId:'synthetic',tables:{patients:[{id:'synthetic-patient',name:'Registro exclusivamente fictício',files:[{url:'data:text/plain;base64,dGVzdGU='}]}]}};
const phrase='Frase sintética protegida 2026!';
test('encrypted backup restores all synthetic fields and attachments without plaintext leakage',async()=>{
 const file=await encryptBackup(example,phrase);
 assert.ok(!file.includes('Registro exclusivamente fictício'));
 assert.deepEqual(await decryptBackup(file,phrase),example);
});
test('wrong phrase and tampered ciphertext do not produce a restored backup',async()=>{
 const file=await encryptBackup(example,phrase);
 await assert.rejects(decryptBackup(file,'Outra frase incorreta 2026!'),/danificado/);
 const envelope=JSON.parse(file);envelope.data=(envelope.data[0]==='A'?'B':'A')+envelope.data.slice(1);
 await assert.rejects(decryptBackup(JSON.stringify(envelope),phrase),/danificado/);
});
test('independent exports use different randomness and reject short phrases and unknown formats',async()=>{
 assert.notEqual(await encryptBackup(example,phrase),await encryptBackup(example,phrase));
 await assert.rejects(encryptBackup(example,'7777'),/12/);
 await assert.rejects(decryptBackup('{"version":999}',phrase),/não reconhecido/);
});
