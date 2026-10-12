import { test, expect } from '@playwright/test';

const user = { id: 'staff-fixture', authUserId: 'auth-fixture', clinicId: 'clinic-fixture',
  name: 'Profissional de teste', role: 'admin', username: 'fixture@example.invalid', password: '' };
const patient = { id: 'patient-fixture', name: 'Paciente fictício', history: '', birthDate: '1990-01-01', files: [] };

async function fixture(page, mode = 'consultation') {
  page.on('pageerror', error => console.error(`Fixture browser error: ${error.message}`));
  page.on('response', response => {
    if (response.status() >= 400) console.error(`Fixture response: ${response.status()} ${new URL(response.url()).pathname}`);
  });
  await page.route('**/services/supabase.ts*', route => route.fulfill({
    contentType: 'application/javascript',
    body: `const chain={select(){return this},eq(){return this},order:async()=>({data:[],error:null})};
      export const supabase={from:()=>chain,rpc:async(name)=>({data:name.includes('vault_key')?'${'ab'.repeat(32)}':{evolutions:[],notes:[]},error:null}),auth:{getUser:async()=>({data:{user:{id:'auth-fixture'}},error:null})}};
      export const isSupabaseConfigured=true;`,
  }));
  const body = mode === 'consultation' ? `
    import ConsultationRoom from '/components/ConsultationRoom.tsx';
    import {draftVault} from '/services/draftVault.ts';
    await draftVault.unlock();
    window.draftVault=draftVault;
    window.failClinical=true;window.failNote=true;window.finishCalls=0;
    createRoot(document.getElementById('root')).render(React.createElement(ConsultationRoom,{
      appointmentId:'appointment-fixture',
      appointments:[{id:'appointment-fixture',patientId:'patient-fixture',doctorId:'doctor-fixture',date:'2026-10-09',time:'08:00',type:'Consulta',status:'Agendado'}],
      patients:[${JSON.stringify(patient)}], doctors:[{id:'doctor-fixture',name:'Médico fictício',specialty:'Clínica Geral'}],
      medications:[],currentUser:${JSON.stringify(user)},users:[],sigilousNotes:[],setMedications:()=>{},
      onFinish:async(input)=>{if(!input)return;window.finishCalls++;if(window.failClinical)throw Error('Falha simulada: rascunho mantido');},
      onAddSigilousNote:async()=>{if(window.failNote)throw Error('Nota não gravada; texto mantido');}
    }));` : `
    import ExportCenter from '/components/ExportCenter.tsx';
    import {storage} from '/services/storage.ts';
    createRoot(document.getElementById('root')).render(React.createElement(ExportCenter,{
      onExport:()=>storage.exportBackup({users:[${JSON.stringify({ ...user, password: 'synthetic-credential', senhaAcesso: 'synthetic-secret' })}],
        patients:[${JSON.stringify(patient)}],doctors:[],appointments:[],medicalRecords:[],medications:[],sigilousNotes:[],financial:{}}),
      onImport:()=>{}
    }));`;
  await page.route('**/__clinical_fixture__', route => route.fulfill({
    contentType: 'text/html',
    body: `<html><body><div id="root"></div><script>
      window.__vite_plugin_react_preamble_installed__=true;
      window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;
      </script><script type="module">
      import React from '/node_modules/.vite/deps/react.js';
      import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
      const createRoot=ReactDOM.createRoot;
      ${body}</script></body></html>`,
  }));
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/__clinical_fixture__');
}

test('failed finalization keeps the draft and screen; successful retry clears it', async ({ page }) => {
  await fixture(page);
  await page.getByPlaceholder('Relate atual do paciente...').fill('Evolução exclusivamente fictícia');
  await page.getByRole('button', { name: 'Finalizar e Gravar Atendimento' }).click();
  await expect(page.getByRole('alert')).toContainText('rascunho mantido');
  const key = 'medcore_consult_draft_clinic-fixture_staff-fixture_appointment-fixture';
  await expect.poll(()=>page.evaluate(k=>window.draftVault.read(k).then(d=>d?.complaint),key)).toBe('Evolução exclusivamente fictícia');
  expect(await page.evaluate(()=>JSON.stringify({...localStorage}))).not.toContain('Evolução exclusivamente fictícia');
  await expect(page.getByPlaceholder('Relate atual do paciente...')).toHaveValue('Evolução exclusivamente fictícia');
  await page.evaluate(() => { window.failClinical = false; });
  await page.getByRole('button', { name: 'Finalizar e Gravar Atendimento' }).click();
  await expect.poll(() => page.evaluate(k => window.draftVault.read(k), key)).toBeNull();
});

test('unreadable encrypted draft is preserved instead of being overwritten',async({page})=>{
 await fixture(page);
 const key='medcore-encrypted-draft:auth-fixture:medcore_consult_draft_clinic-fixture_staff-fixture_appointment-fixture';
 const corrupted='{"iv":"invalid","data":"invalid"}';
 await page.evaluate(({key,corrupted})=>localStorage.setItem(key,corrupted),{key,corrupted});
 await page.reload();
 await expect(page.getByRole('alert')).toContainText('Não foi possível abrir o rascunho protegido');
 await page.getByPlaceholder('Relate atual do paciente...').fill('Novo texto exclusivamente fictício');
 await expect(page.getByRole('button',{name:'Finalizar e Gravar Atendimento'})).toBeDisabled();
 expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBe(corrupted);
});

test('a rejected private note retains the text instead of reporting success', async ({ page }) => {
  await fixture(page);
  await page.getByRole('button', { name: 'Menu de informações sigilosas' }).click();
  await page.getByRole('button', { name: 'Confirmar meu acesso autenticado' }).click();
  const text = page.getByPlaceholder('Nota restrita ao autor e ao administrador da mesma clínica.');
  await text.fill('Nota fictícia que precisa permanecer');
  await page.getByRole('button', { name: 'Salvar Anotação' }).click();
  await expect(page.getByRole('alert')).toContainText('texto mantido');
  await expect(text).toHaveValue('Nota fictícia que precisa permanecer');
});

test('local copy downloads correctly and contains no staff passwords', async ({ page }) => {
  await fixture(page, 'export');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Fazer Download do Backup' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^medcore_local_backup_/);
  const stream = await download.createReadStream();
  let contents = '';
  for await (const chunk of stream) contents += chunk.toString();
  const data = JSON.parse(contents);
  expect(data.backupKind).toBe('local-visible-snapshot');
  expect(data.users[0].password).toBe('');
  expect(data.users[0]).not.toHaveProperty('senhaAcesso');
});
