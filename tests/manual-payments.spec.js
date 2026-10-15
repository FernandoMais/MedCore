import {test,expect} from '@playwright/test';

async function fixture(page, mode='admin') {
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/services/manualPayments.ts*',route=>route.fulfill({contentType:'application/javascript',body:`
 const profile={doctorId:'d1',price:200,doctorPercent:40,paymentUrl:'https://payments.example.invalid/200',bank:'Banco fictício',agency:'0000',account:'123',pixKey:'pix-ficticio',version:'profile-v1'};
 const base={doctorId:'d1',patientId:'p1',doctorName:'Médico fictício',date:'2026-10-20',price:200,doctorPercent:40,paymentStatus:'pendente',repassAmount:80,repassStatus:'previsto',version:'v1',paymentUrl:profile.paymentUrl};
 const rows=[{...base,appointmentId:'a1',status:'Agendado',patientName:'Paciente ainda agendado'},{...base,appointmentId:'a2',status:'Finalizado',patientName:'Paciente atendido'},{...base,appointmentId:'a3',doctorId:'d2',status:'Finalizado',patientName:'Paciente de outro médico'}];
 window.billingCalls=[];
 export async function loadManualBilling(){return {profiles:[profile],rows:rows.map(r=>({...r})),canManage:${mode!=='doctor'}};}
 export async function saveFeeProfile(p){window.billingCalls.push({action:'profile',profile:p});Object.assign(profile,p);}
 export async function confirmReceipt(p){window.billingCalls.push({action:'receipt',input:p});rows.find(r=>r.appointmentId===p.appointmentId).paymentStatus='pago';}
 export async function markPayout(p){window.billingCalls.push({action:'payout',input:p});}
 export async function sendPaymentLink(){return {sent:true};}
 `}));
 await page.route('**/__manual-billing-fixture',route=>route.fulfill({contentType:'text/html',body:`
 <div id="root"></div><script>window.__vite_plugin_react_preamble_installed__=true;window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;</script>
 <script type="module">
 import React from '/node_modules/.vite/deps/react.js';
 import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
 import ManualPayments from '/components/ManualPayments.tsx';
 import DoctorFeeProfile from '/components/DoctorFeeProfile.tsx';
 const doctor={id:'d1',name:'Médico fictício',crm:'TEST',specialty:'Clínica Geral',availableTimes:[]};
 ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(
 ${mode==='profile'?'DoctorFeeProfile':'ManualPayments'},
 ${mode==='profile'?'{doctor}':`{currentUser:{id:'u1',name:'Pessoa fictícia',role:'${mode}',doctorId:'d1',clinicId:'test'},doctors:[doctor]}`}
 ));
 </script>`}));
 await page.goto('/__manual-billing-fixture');
 return errors;
}
test('doctor earnings exclude scheduled visits and other doctors even if a bad response includes them',async({page})=>{
 const errors=await fixture(page,'doctor');
 await expect(page.getByText('Paciente atendido',{exact:true})).toBeVisible();
 await expect(page.getByText('Paciente ainda agendado',{exact:true})).toHaveCount(0);
 await expect(page.getByText('Paciente de outro médico',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Confirmar',exact:true})).toHaveCount(0);
 await expect(page.getByText('pix-ficticio',{exact:false}).first()).toBeVisible();
 expect(errors).toEqual([]);
});
test('administration confirms exact receipt and retains scheduled visits for collection',async({page})=>{
 const errors=await fixture(page);
 await expect(page.getByText('Paciente ainda agendado',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Confirmar',exact:true}).first().click();
 await page.getByPlaceholder('Identificação do comprovante').fill('TRANSACAO-FICTICIA-001');
 await page.getByRole('button',{name:'Confirmar valor',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.billingCalls.filter(c=>c.action==='receipt').length)).toBe(1);
 expect(errors).toEqual([]);
});
test('fee profile saves price, professional percentage, checkout and private payout details',async({page})=>{
 const errors=await fixture(page,'profile');
 await expect(page.getByLabel('Chave Pix')).toHaveValue('pix-ficticio');
 await page.getByLabel(/Preço da consulta/).fill('250');
 await page.getByRole('textbox',{name:/Link/i}).fill('https://payments.example.invalid/250');
 await page.getByRole('button',{name:/Salvar/i}).click();
 await expect.poll(()=>page.evaluate(()=>window.billingCalls.filter(c=>c.action==='profile').length)).toBe(1);
 expect(errors).toEqual([]);
});
