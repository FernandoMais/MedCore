import {test,expect} from '@playwright/test';

async function openForm(page){
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 const origin=new URL(process.env.REPLIT_DEV_DOMAIN?`https://${process.env.REPLIT_DEV_DOMAIN}`:'http://127.0.0.1:5000').origin;
 await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
 for(const component of ['PatientEvolution','RestrictedHistory']){
  await page.route(`**/components/${component}.tsx*`,route=>route.fulfill({contentType:'application/javascript',body:'export default function Stub(){return null;}'}));
 }
 await page.route('**/components/AdminPasswordEditor.tsx*',route=>route.fulfill({contentType:'application/javascript',body:'export function AdminPasswordEditor(){return null;}'}));
 await page.route('**/services/supabase.ts*',route=>route.fulfill({contentType:'application/javascript',body:'export const supabase={};'}));
 await page.route('**/services/patientAuth.ts*',route=>route.fulfill({contentType:'application/javascript',body:'export async function requestAdminPatientReset(){throw Error("Envio não permitido nesta fixture");}'}));
 await page.route('**/__patient-form-fixture',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:`
 <div id="root"></div><script>window.__vite_plugin_react_preamble_installed__=true;window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;</script>
 <script type="module">
 import React from '/node_modules/.vite/deps/react.js';
 import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
 import '/index.css';
 import PatientManager from '/components/PatientManager.tsx';
 function Fixture(){
  const [patients,setPatients]=React.useState([]);
  React.useEffect(()=>{window.patientFormFixture={patients};},[patients]);
  return React.createElement(PatientManager,{patients,setPatients,doctors:[{id:'d1',name:'Profissional fictício',crm:'TESTE',specialty:'Clínica geral',availableTimes:[]}],isAdmin:true,currentUser:{id:'u1',role:'admin',name:'Administrador fictício',clinicId:'fixture-clinic'}});
 }
 ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode,null,React.createElement(Fixture)));
 </script>`}));
 await page.goto('/__patient-form-fixture');
 await page.getByRole('button',{name:'Novo Paciente',exact:true}).click();
 return errors;
}
async function typeWithoutLosingFocus(page,field,text){
 await field.scrollIntoViewIfNeeded();
 await field.click();
 const before=await field.boundingBox();
 await field.evaluate(el=>{window.typingInput=el;});
 await field.pressSequentially(text,{delay:5});
 await expect(field).toHaveValue(text);
 await expect(field).toBeFocused();
 expect(await field.evaluate(el=>el===window.typingInput)).toBe(true);
 const after=await field.boundingBox();
 expect(Math.abs(after.y-before.y)).toBeLessThan(2);
}
for(const viewport of [{width:1280,height:800},{width:390,height:844}]){
 test(`patient allergies and conditions retain focus and text in create and edit at ${viewport.width}px`,async({page})=>{
  await page.setViewportSize(viewport);
  const errors=await openForm(page);
  const allergies=page.getByPlaceholder('Ex: Penicilina, Dipirona');
  const conditions=page.getByPlaceholder('Ex: Hipertensão, Diabetes');
  const allergyText='Penicilina, Dipirona, Látex';
  const conditionText='Hipertensão, Diabetes tipo 2';
  await typeWithoutLosingFocus(page,allergies,allergyText);
  await typeWithoutLosingFocus(page,conditions,conditionText);
  await page.getByPlaceholder('Nome do paciente').fill('Paciente fictício de digitação');
  await page.getByRole('button',{name:'Salvar',exact:true}).click();
  await expect(allergies).toHaveCount(0);
  expect(await page.evaluate(()=>window.patientFormFixture.patients[0].allergies)).toEqual(['Penicilina','Dipirona','Látex']);
  expect(await page.evaluate(()=>window.patientFormFixture.patients[0].preExistingConditions)).toEqual(['Hipertensão','Diabetes tipo 2']);
  await page.getByRole('button',{name:'Editar Cadastro',exact:true}).click();
  await expect(allergies).toHaveValue(allergyText);
  await expect(conditions).toHaveValue(conditionText);
  await allergies.fill('');
  await typeWithoutLosingFocus(page,allergies,'Poeira, Camarão');
  await conditions.fill('');
  await typeWithoutLosingFocus(page,conditions,'Asma, Hipotireoidismo');
  await page.getByRole('button',{name:'Salvar',exact:true}).click();
  await expect(allergies).toHaveCount(0);
  expect(await page.evaluate(()=>window.patientFormFixture.patients[0].allergies)).toEqual(['Poeira','Camarão']);
  expect(await page.evaluate(()=>window.patientFormFixture.patients[0].preExistingConditions)).toEqual(['Asma','Hipotireoidismo']);
  expect(errors).toEqual([]);
 });
}
