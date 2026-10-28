import {test,expect} from '@playwright/test';

async function openProfessional(page,{role='admin',scenario='linked',actorClinic='fixture-clinic'}={}){
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const origin=new URL(process.env.REPLIT_DEV_DOMAIN?`https://${process.env.REPLIT_DEV_DOMAIN}`:'http://127.0.0.1:5000').origin;
 await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
 await page.route('**/services/supabase.ts*',route=>route.fulfill({contentType:'application/javascript',body:`
 window.passwordRequests=[];
 export const supabase={functions:{invoke:async(name,{body})=>{
  window.passwordRequests.push({name,action:body.action,kind:body.kind,id:body.id,adminProofProvided:!!body.currentPassword});
  return window.rejectPassword?{error:{context:{json:async()=>({error:'Senha administrativa não confirmada.'})}}}:{data:{changed:true}};
 }}};
 `}));
 await page.route('**/services/auth.ts*',route=>route.fulfill({contentType:'application/javascript',body:'export async function provisionAuthAccount(){throw Error("Não permitido nesta fixture");}'}));
 await page.route('**/components/DoctorFeeProfile.tsx*',route=>route.fulfill({contentType:'application/javascript',body:'export default function DoctorFeeProfile(){return null;}'}));
 await page.route('**/__doctor-password-fixture',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:`
 <div id="root"></div><script>window.__vite_plugin_react_preamble_installed__=true;window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;</script>
 <script type="module">
 import React from '/node_modules/.vite/deps/react.js';
 import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
 import '/index.css';
 import DoctorRegistry from '/components/DoctorRegistry.tsx';
 const doctors=[1,2].map(n=>({id:'d'+n,name:'Profissional fictício '+n,crm:'TESTE',specialty:'Clínica geral',availableTimes:[],email:'fixture'+n+'@example.invalid'}));
 const users=doctors.map((d,index)=>({id:'staff-profile-'+(index+1),doctorId:d.id,clinicId:'fixture-clinic',authUserId:'auth-'+index,username:d.email,name:d.name,role:'doctor',active:true}));
 if(${JSON.stringify(scenario)}==='unlinked')users[0].authUserId=null;
 if(${JSON.stringify(scenario)}==='inactive')users[0].active=false;
 if(${JSON.stringify(scenario)}==='ambiguous')users.push({...users[0],id:'other-profile'});
 users.push({...users[0],id:'foreign-profile',clinicId:'another-clinic'});
 ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode,null,React.createElement(DoctorRegistry,{
 doctors,users,clinicId:'fixture-clinic',providersOnly:true,setDoctors:()=>{},setUsers:()=>{},
 currentUser:{id:'admin-fixture',role:${JSON.stringify(role)},clinicId:${JSON.stringify(actorClinic)}}
 })));
 </script>`}));
 page.on('dialog',dialog=>dialog.accept());
 await page.goto('/__doctor-password-fixture');
 await page.getByRole('heading',{name:'Profissional fictício 1',level:3,exact:true}).click();
 return errors;
}
async function enterPasswords(page){
 await page.getByText('Alterar senha diretamente — somente administrador',{exact:true}).click();
 await page.getByLabel('Sua senha de administrador').fill('Synthetic-admin!9');
 await page.getByLabel('Nova senha do usuário',{exact:true}).fill('Synthetic-new!9');
 await page.getByLabel('Confirme a nova senha').fill('Synthetic-new!9');
}
test('professional registry submits authenticated password change to the linked staff profile and clears credentials',async({page})=>{
 const errors=await openProfessional(page);
 await expect(page.getByText(/A recuperação por e-mail continua disponível/)).toBeVisible();
 await enterPasswords(page);
 await page.getByRole('button',{name:'Salvar nova senha'}).click();
 await expect(page.getByRole('status')).toContainText('Senha alterada');
 expect(await page.evaluate(()=>window.passwordRequests)).toEqual([{name:'staff-access',action:'set-password',kind:'staff',id:'staff-profile-1',adminProofProvided:true}]);
 for(const name of ['Sua senha de administrador','Nova senha do usuário','Confirme a nova senha'])await expect(page.getByLabel(name,{exact:true})).toHaveValue('');
 expect(await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}))).not.toContain('Synthetic-');
 expect(errors).toEqual([]);
});
test('switching professional clears unsent credentials and selects the other bound account',async({page})=>{
 await openProfessional(page);
 await enterPasswords(page);
 await page.getByRole('heading',{name:'Profissional fictício 2',level:3,exact:true}).click();
 for(const name of ['Sua senha de administrador','Nova senha do usuário','Confirme a nova senha'])await expect(page.getByLabel(name,{exact:true})).toHaveValue('');
 await enterPasswords(page);
 await page.getByRole('button',{name:'Salvar nova senha'}).click();
 expect(await page.evaluate(()=>window.passwordRequests[0].id)).toBe('staff-profile-2');
});
test('rejected administrative proof is not reported as success and clears entered passwords',async({page})=>{
 await openProfessional(page);await enterPasswords(page);
 await page.evaluate(()=>{window.rejectPassword=true;});
 await page.getByRole('button',{name:'Salvar nova senha'}).click();
 await expect(page.getByRole('status')).toContainText('Senha administrativa não confirmada');
 await expect(page.getByLabel('Nova senha do usuário',{exact:true})).toHaveValue('');
});
for(const role of ['doctor','secretaria','tesouraria','collaborator']){
 test(`${role} has no direct password controls in the professional registry`,async({page})=>{
  await openProfessional(page,{role});
  await expect(page.getByRole('region',{name:'Senha de acesso do profissional'})).toHaveCount(0);
  await expect(page.locator('input[type=password]')).toHaveCount(0);
  expect(await page.evaluate(()=>window.passwordRequests)).toEqual([]);
 });
}
for(const scenario of ['unlinked','inactive','ambiguous']){
 test(`${scenario} professional binding cannot receive a direct password change`,async({page})=>{
  await openProfessional(page,{scenario});
  await expect(page.getByRole('region',{name:'Senha de acesso do profissional'})).toBeVisible();
  await expect(page.locator('input[type=password]')).toHaveCount(0);
 });
}
test('an administrator from another clinic does not get password controls',async({page})=>{
 await openProfessional(page,{actorClinic:'another-clinic'});
 await expect(page.locator('input[type=password]')).toHaveCount(0);
});
