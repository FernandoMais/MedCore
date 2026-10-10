import { supabase } from './supabase';
const prefix='medcore-encrypted-draft:';
let key:CryptoKey|null=null;
let adminKey:CryptoKey|null=null;
let generalKey:CryptoKey|null=null;
let owner='';
let sequence:Promise<unknown>=Promise.resolve();
const b64=(bytes:Uint8Array)=>btoa(Array.from(bytes,b=>String.fromCharCode(b)).join(''));
const bytes=(text:string)=>Uint8Array.from(atob(text),c=>c.charCodeAt(0));
export const draftVault={
 async unlock(role='doctor') {
  const user=await supabase.auth.getUser();
  if(!user.data?.user?.id)throw Error('Autentique-se para proteger os rascunhos.');
  const load=async(name:string)=>{
   const response=await supabase.rpc(name);
   if(response.error||!/^[a-f0-9]{64}$/i.test(response.data||''))throw Error('Não foi possível abrir o cofre de rascunhos.');
   return crypto.subtle.importKey('raw',Uint8Array.from(response.data.match(/../g).map((s:string)=>parseInt(s,16))),{name:'AES-GCM'},false,['encrypt','decrypt']);
  };
  generalKey=await load('operational_general_vault_key');
  key=role==='collaborator'?null:await load('operational_vault_key');
  adminKey=role==='admin'?await load('operational_admin_vault_key'):null;
  owner=user.data.user.id;
 },
 lock(){key=null;adminKey=null;generalKey=null;owner='';},
 write(scope:string,value:any):Promise<void> {
  const activeKey=scope.startsWith('legacy-')||scope==='pending-edits-admin'?adminKey:scope==='pending-edits-collaborator'?generalKey:key,activeOwner=owner;
  if(!activeKey)return Promise.reject(Error('Cofre fechado: rascunho ainda não foi protegido.'));
  const task=sequence.catch(()=>{}).then(async()=>{
   const iv=crypto.getRandomValues(new Uint8Array(12));
   const data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(scope)},activeKey,new TextEncoder().encode(JSON.stringify(value)));
   localStorage.setItem(prefix+activeOwner+':'+scope,JSON.stringify({iv:b64(iv),data:b64(new Uint8Array(data))}));
  });
  sequence=task;return task;
 },
 async read(scope:string) {
  const activeKey=scope.startsWith('legacy-')||scope==='pending-edits-admin'?adminKey:scope==='pending-edits-collaborator'?generalKey:key;
  if(!activeKey)throw Error('Cofre fechado.');
  const text=localStorage.getItem(prefix+owner+':'+scope);if(!text)return null;
  const packet=JSON.parse(text);
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(packet.iv),additionalData:new TextEncoder().encode(scope)},activeKey,bytes(packet.data));
  return JSON.parse(new TextDecoder().decode(plain));
 },
 async remove(scope:string) {const activeOwner=owner;await sequence.catch(()=>{});localStorage.removeItem(prefix+activeOwner+':'+scope);},
};
