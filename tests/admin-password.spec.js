import {test,expect} from '@playwright/test';

async function fixture(page,role='admin'){
 page.on('pageerror',error=>console.error(error.message));
 await page.route('**/services/supabase.ts*',route=>route.fulfill({contentType:'application/javascript',body:`
 export const supabase={functions:{invoke:async(name,{body})=>{
 window.passwordCalls=(window.passwordCalls||0)+1;
 window.passwordTarget=body.kind+':'+body.id;
 return window.rejectPassword?{data:null,error:{context:{json:async()=>({error:'Senha administrativa não confirmada.'})}}}:{data:{changed:true},error:null};
 }}};`}));
 await page.route('**/__password_fixture__',route=>route.fulfill({contentType:'text/html',body:`
 <html><body><div id="root"></div><script>window.__vite_plugin_react_preamble_installed__=true;
 window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>t=>t;</script>
 <script type="module">
 import React from '/node_modules/.vite/deps/react.js';
 import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
 const createRoot=ReactDOM.createRoot;
 import {AdminPasswordEditor} from '/components/AdminPasswordEditor.tsx';
 createRoot(document.getElementById('root')).render(React.createElement(AdminPasswordEditor,{
 user:{role:${JSON.stringify(role)}},kind:'patient',targetId:'fake-patient',targetName:'Paciente fictício',linked:true}));
 </script></body></html>`}));
 page.on('dialog',dialog=>dialog.accept());
 await page.goto('/__password_fixture__');
}
test('administrator changes password, sees server outcome and credentials are cleared',async({page})=>{
 await fixture(page);
 await page.getByText('Alterar senha diretamente — somente administrador').click();
 await page.getByLabel('Sua senha de administrador').fill('Admin-fixture!9');
 await page.getByLabel('Nova senha do usuário',{exact:true}).fill('New-fixture!9');
 await page.getByLabel('Confirme a nova senha').fill('Different-fixture!9');
 await page.getByRole('button',{name:'Salvar nova senha'}).click();
 await expect(page.getByRole('status')).toContainText('não coincide');
 expect(await page.evaluate(()=>window.passwordCalls||0)).toBe(0);
 await page.getByLabel('Confirme a nova senha').fill('New-fixture!9');
 await page.getByRole('button',{name:'Salvar nova senha'}).click();
 await expect(page.getByRole('status')).toContainText('Senha alterada');
 await expect(page.getByLabel('Sua senha de administrador')).toHaveValue('');
 await expect(page.getByLabel('Nova senha do usuário',{exact:true})).toHaveValue('');
 expect(await page.evaluate(()=>window.passwordTarget)).toBe('patient:fake-patient');
 expect(await page.evaluate(()=>JSON.stringify({...localStorage}))).not.toContain('fixture!9');
});
test('non-administrator has no password change fields',async({page})=>{
 await fixture(page,'doctor');
 await expect(page.getByText('Alterar senha diretamente — somente administrador')).toHaveCount(0);
 await expect(page.locator('input[type=password]')).toHaveCount(0);
});
test('failed server confirmation is shown without reporting success or retaining credentials',async({page})=>{
 await fixture(page);
 await page.evaluate(()=>window.rejectPassword=true);
 await page.getByText('Alterar senha diretamente — somente administrador').click();
 await page.getByLabel('Sua senha de administrador').fill('Wrong-fixture!9');
 await page.getByLabel('Nova senha do usuário',{exact:true}).fill('New-fixture!9');
 await page.getByLabel('Confirme a nova senha').fill('New-fixture!9');
 await page.getByRole('button',{name:'Salvar nova senha'}).click();
 await expect(page.getByRole('status')).toContainText('Senha administrativa não confirmada');
 await expect(page.getByLabel('Sua senha de administrador')).toHaveValue('');
});
