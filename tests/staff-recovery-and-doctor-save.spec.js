import {test,expect} from '@playwright/test';

async function fixture(page,component,mode){
 await page.addInitScript(()=>{window.fixtureCalls=[];});
 await page.route('**/services/freshStart.ts*',route=>route.fulfill({contentType:'application/javascript',body:"export const freshClinicId='fixture-clinic';"}));
 await page.route('**/services/supabase.ts*',route=>route.fulfill({contentType:'application/javascript',body:`
 export const isSupabaseConfigured=true;
 export const supabase={auth:{
 verifyOtp:async()=>{window.fixtureCalls.push('verify');return ${mode==='expired'?"{error:{code:'otp_expired',status:403}}":"{data:{}}"};},
 getSession:async()=>({data:{session:{}}}),getUser:async()=>({data:{user:{id:'fixture-user'}}}),
 updateUser:async()=>({}),signOut:async()=>({})},
 from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{role:'secretaria',clinicId:'fixture-clinic',active:${mode!=='inactive'}}})})})})};
 `}));
 await page.route('**/services/auth.ts*',route=>route.fulfill({contentType:'application/javascript',body:'export async function provisionAuthAccount(){}'}));
 await page.route('**/components/DoctorFeeProfile.tsx*',route=>route.fulfill({contentType:'application/javascript',body:'export default function Fee(){return null;}'}));
 await page.route('**/__staff-doctor-fixture*',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:`
 <div id="root"></div><script>window.__vite_plugin_react_preamble_installed__=true;window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;</script>
 <script type="module">
 import React from '/node_modules/.vite/deps/react.js';
 import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
 import Component from '/components/${component}.tsx';
 function Root(){
 const [doctors,setDoctors]=React.useState([{id:'fixture-doctor',name:'Médico fictício',crm:'TEST',specialty:'Clínica Geral',email:'fixture@example.invalid',phone:'00000000000',availableTimes:[]}]);
 const save=async doc=>{window.fixtureCalls.push('save-start');await new Promise(resolve=>setTimeout(resolve,300));${mode==='save-error'?"throw Error('O servidor não confirmou a gravação fictícia.');":"setDoctors([doc]);window.fixtureCalls.push('save-confirmed');"}};
 return React.createElement(Component,${component==='StaffPasswordReset'?'{onBack:()=>{}}':"{doctors,setDoctors,users:[],setUsers:()=>{},clinicId:'fixture-clinic',providersOnly:true,onSaveDoctor:save}"});
 }
 ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode,null,React.createElement(Root)));
 </script>`}));
 await page.goto('/__staff-doctor-fixture?staff-auth=recovery&token_hash=fictitious&type=recovery');
}
test('staff link replay has a specific error and StrictMode does not verify twice',async({page})=>{
 await fixture(page,'StaffPasswordReset','expired');
 await expect(page.getByRole('status')).toContainText('O link expirou ou já foi utilizado');
 await expect(page.getByRole('button',{name:'Salvar nova senha'})).toHaveCount(0);
 expect(await page.evaluate(()=>window.fixtureCalls)).toEqual(['verify']);
 expect(page.url()).not.toContain('token_hash');
});
test('an inactive staff profile cannot use the recovery form',async({page})=>{
 await fixture(page,'StaffPasswordReset','inactive');
 await expect(page.getByRole('status')).toContainText('não possui acesso ativo');
 await expect(page.getByRole('button',{name:'Salvar nova senha'})).toHaveCount(0);
});
for(const failed of [false,true]){
 test(`doctor save ${failed?'failure retains editable fields and displays the error':'waits for confirmation before closing the editor'}`,async({page})=>{
  await fixture(page,'DoctorRegistry',failed?'save-error':'success');
  await page.getByText('Médico fictício',{exact:true}).click();
  await page.getByRole('button',{name:'Editar Perfil'}).click();
  await page.locator('input[value="fixture@example.invalid"]').fill('alterado@example.invalid');
  await page.getByRole('button',{name:'Salvar Alterações'}).click();
  await expect(page.getByRole('status')).toContainText('Confirmando o cadastro');
  if(failed){
   await expect(page.getByRole('alert')).toContainText('O servidor não confirmou');
   await expect(page.locator('input[value="alterado@example.invalid"]')).toHaveValue('alterado@example.invalid');
   await expect(page.getByRole('button',{name:'Salvar Alterações'})).toBeVisible();
  }else{
   await expect(page.getByRole('status')).toContainText('Cadastro médico confirmado no Supabase');
   await expect(page.getByRole('button',{name:'Editar Perfil'})).toBeVisible();
   expect(await page.evaluate(()=>window.fixtureCalls)).toEqual(['save-start','save-confirmed']);
  }
 });
}
