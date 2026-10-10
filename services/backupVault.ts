const encode=(v:Uint8Array)=>btoa(Array.from(v,b=>String.fromCharCode(b)).join(''));
const decode=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function derive(password:string,salt:Uint8Array) {
 if(password.length<12)throw Error('Use uma frase de proteção com pelo menos 12 caracteres.');
 const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:310000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export async function encryptBackup(snapshot:any,password:string):Promise<string>{
 const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
 const plaintext=new TextEncoder().encode(JSON.stringify(snapshot));
 const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},await derive(password,salt),plaintext);
 return JSON.stringify({format:'medcore-encrypted-backup',version:1,kdf:'PBKDF2-SHA256',iterations:310000,salt:encode(salt),iv:encode(iv),data:encode(new Uint8Array(cipher))});
}
export async function decryptBackup(text:string,password:string):Promise<any>{
 const p=JSON.parse(text);
 if(p.format!=='medcore-encrypted-backup'||p.version!==1||p.iterations!==310000)throw Error('Formato de backup não reconhecido.');
 try {
  const data=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(p.iv)},await derive(password,decode(p.salt)),decode(p.data));
  return JSON.parse(new TextDecoder().decode(data));
 }catch{throw Error('Frase incorreta ou backup danificado. Nenhum dado foi alterado.');}
}
export function downloadEncryptedBackup(text:string){
 const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
 const link=document.createElement('a');link.href=url;link.download=`medcore-backup-criptografado-${new Date().toISOString().slice(0,10)}.json`;
 document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
