import {test,expect} from '@playwright/test';

async function fixture(page,mode='error'){
 await page.route('**/*',route=>{
  const configured=process.env.REPLIT_DEV_DOMAIN;
  const host=configured?new URL(configured.startsWith('http')?configured:`https://${configured}`).hostname:'127.0.0.1';
  if(new URL(route.request().url()).hostname!==host)return route.abort();
  return route.continue();
 });
 await page.route('**/services/operationalStorage.ts*',route=>route.fulfill({contentType:'application/javascript',body:`
 export const storage={syncToCloud:async()=>{}};export const operationalRpc=async()=>({});
 `}));
 await page.route('**/services/supabase.ts*',route=>route.fulfill({contentType:'application/javascript',body:`
 export const supabase={functions:{invoke:async(name,{body})=>{
 window.invitation=body;
 return ${mode==='error'?"{data:null,error:{context:new Response(JSON.stringify({error:'O provedor recusou a autenticação SMTP.'}),{status:502})}}":mode==='unconfirmed'?"{data:{},error:null}":"{data:{invited:true},error:null}"};
 }}};
 `}));
 await page.route('**/__staff-invite-fixture',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:`
 <link rel="stylesheet" href="/index.css"><div id="root"></div>
 <script>window.__vite_plugin_react_preamble_installed__=true;window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;</script>
 <script type="module">
 import React from '/node_modules/.vite/deps/react.js';
 import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
 import {OperationalCenter} from '/components/OperationalCenter.tsx';
 ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(OperationalCenter,{
 team:true,user:{id:'admin',role:'admin',clinicId:'clinic'},
 db:{users:[],doctors:[{id:'doctor-fixture',clinicId:'clinic',name:'Profissional fictício',email:'fixture@example.invalid'}]},
 onReload:async()=>{${mode==='reload-error'?"throw Error('offline');":''}}
 }));
 </script>`}));
 await page.goto('/__staff-invite-fixture');
 await page.getByLabel('Ficha profissional',{exact:true}).selectOption('doctor-fixture');
}
test('server error is displayed and the completed invitation form is retained',async({page})=>{
 await fixture(page);
 await page.getByRole('button',{name:'Enviar convite'}).click();
 await expect(page.getByRole('status')).toContainText('recusou a autenticação SMTP');
 await expect(page.getByLabel('Nome completo')).toHaveValue('Profissional fictício');
 await expect(page.getByLabel('E-mail de acesso')).toHaveValue('fixture@example.invalid');
 expect(await page.evaluate(()=>window.invitation.doctorId)).toBe('doctor-fixture');
 await expect(page.getByLabel('Registro profissional')).toHaveCount(0);
});
test('only acknowledged invitations clear the form and report success',async({page})=>{
 await fixture(page,'success');
 await page.getByRole('button',{name:'Enviar convite'}).click();
 await expect(page.getByRole('status')).toContainText('Convite aceito pelo provedor');
 await expect(page.getByLabel('Nome completo')).toHaveValue('');
});
test('missing acknowledgement does not report successful invitation',async({page})=>{
 await fixture(page,'unconfirmed');
 await page.getByRole('button',{name:'Enviar convite'}).click();
 await expect(page.getByRole('status')).toContainText('não confirmou');
 await expect(page.getByLabel('Nome completo')).toHaveValue('Profissional fictício');
});
test('list refresh failure does not suggest sending another invitation',async({page})=>{
 await fixture(page,'reload-error');
 await page.getByRole('button',{name:'Enviar convite'}).click();
 await expect(page.getByRole('status')).toContainText('não reenvie');
});
