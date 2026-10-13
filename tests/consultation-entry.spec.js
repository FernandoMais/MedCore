import { test, expect } from '@playwright/test';

async function fixture(page, options = {}) {
  const errors = [];
  page.on('pageerror', error => {
    errors.push(error.message);
    console.error(`Consultation fixture: ${error.message}`);
  });
  page.on('dialog', dialog => dialog.accept());
  await page.route('**/services/supabase.ts*', route => route.fulfill({
    contentType: 'application/javascript',
    body: `export const isSupabaseConfigured=true;
      export const supabase={
        rpc:async(name)=>({data:name.includes('vault_key')?'${'ab'.repeat(32)}':{evolutions:[],notes:[]},error:null}),
        auth:{getUser:async()=>({data:{user:{id:'entry-auth-fixture'}},error:null})}
      };`,
  }));
  await page.route('**/__consultation-entry-fixture', route => route.fulfill({
    contentType: 'text/html',
    body: `<div id="root"></div><script>
      window.__vite_plugin_react_preamble_installed__=true;
      window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;
      </script><script type="module">
      import React from '/node_modules/.vite/deps/react.js';
      import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
      import Agenda from '/components/Agenda.tsx';
      import ConsultationRoom from '/components/ConsultationRoom.tsx';
      import ConsultationBoundary from '/components/ConsultationBoundary.tsx';
      import {draftVault} from '/services/draftVault.ts';
      const options=${JSON.stringify(options)};
      const user={id:'entry-staff-fixture',authUserId:'entry-auth-fixture',clinicId:'entry-clinic-fixture',
        role:options.role||'admin',doctorId:'entry-doctor-fixture',name:'Profissional fictício'};
      const patient={id:'entry-patient-fixture',name:'Paciente de teste da agenda',birthDate:'1990-01-01',history:'',files:[],cpf:'00000000000'};
      const patients=options.missingPatient?[]:[patient];
      const doctors=[{id:'entry-doctor-fixture',name:'Médico fictício',specialty:'Clínica Geral'}];
      await draftVault.unlock(user.role);
      window.draftVault=draftVault;
      window.finishCalls=0;
      function Broken(){throw Error('Erro de renderização simulado');}
      function Flow(){
        const [active,setActive]=React.useState(options.direct?'entry-appointment-fixture':null);
        const [appointments,setAppointments]=React.useState([{
          id:'entry-appointment-fixture',patientId:patient.id,doctorId:doctors[0].id,
          date:new Date().toLocaleDateString('en-CA'),time:'09:00',type:'Consulta',room:'Consultório 01',status:'Agendado',
          serviceValue:options.value===undefined?null:options.value,
          repassRule:{type:'fixed',value:null}
        }]);
        if(!active)return React.createElement(Agenda,{
          appointments,setAppointments,patients,doctors,currentUser:user,
          onUpdateAppointmentStatus:(id,status)=>setAppointments(items=>items.map(a=>a.id===id?{...a,status}:a)),
          startConsultation:setActive
        });
        return React.createElement(ConsultationBoundary,{onBack:()=>setActive(null)},
          options.crash?React.createElement(Broken):React.createElement(ConsultationRoom,{
            appointmentId:active,appointments,patients,doctors,medications:[],currentUser:user,
            users:[],sigilousNotes:[],setMedications:()=>{},onAddSigilousNote:async()=>{},
            onFinish:async(input)=>{if(!input){setActive(null);return;}window.finishCalls++;}
          }));
      }
      ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Flow));
    </script>`,
  }));
  await page.goto('/__consultation-entry-fixture');
  return errors;
}

for (const role of ['admin', 'doctor']) {
  test(`${role} starts care from agenda with null financial fields without crashing`, async ({ page }) => {
    const errors = await fixture(page, { role });
    await page.getByRole('button', { name: 'Atender', exact: true }).click();
    await expect(page.getByText('Valor não informado', { exact: false })).toBeVisible();
    await expect(page.getByText('Repasse não informado', { exact: false })).toBeVisible();
    await page.getByPlaceholder('Relate atual do paciente...').fill('Queixa exclusivamente fictícia.');
    await expect(page.getByRole('button', { name: 'Finalizar e Gravar Atendimento' })).toBeEnabled();
    await expect.poll(() => page.evaluate(() => window.draftVault.read(
      'medcore_consult_draft_entry-clinic-fixture_entry-staff-fixture_entry-appointment-fixture'
    ).then(draft => draft?.complaint))).toBe('Queixa exclusivamente fictícia.');
    await page.getByRole('button', { name: 'Finalizar e Gravar Atendimento' }).click();
    await expect.poll(() => page.evaluate(() => window.finishCalls)).toBe(1);
    expect(errors).toEqual([]);
  });
}

for (const [value, formatted] of [[0, 'R$ 0,00'], [350.5, 'R$ 350,50']]) {
  test(`care preserves financial value ${value}`, async ({ page }) => {
    const errors = await fixture(page, { direct: true, value });
    await expect(page.getByText(formatted, { exact: false })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('unavailable patient has a visible error and return to agenda instead of blank screen', async ({ page }) => {
  const errors = await fixture(page, { direct: true, missingPatient: true });
  await expect(page.getByRole('alert')).toContainText('Atendimento indisponível');
  await page.getByRole('button', { name: 'Voltar à agenda' }).click();
  await expect(page.getByRole('button', { name: 'Atender', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('unexpected render failure is contained and leaves encrypted draft intact', async ({ page }) => {
  await fixture(page, { direct: true, crash: true });
  await page.evaluate(() => window.draftVault.write('boundary-fixture', { complaint: 'Rascunho fictício preservado' }));
  await expect(page.getByRole('alert')).toContainText('Não foi possível abrir o atendimento');
  await page.getByRole('button', { name: 'Voltar à agenda' }).click();
  await expect(page.getByRole('button', { name: 'Atender', exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.draftVault.read('boundary-fixture'))).toEqual({
    complaint: 'Rascunho fictício preservado',
  });
});
