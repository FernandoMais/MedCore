import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { chromium } from '@playwright/test';
import { validateFreshConfiguration } from './setup-fresh-admin.mjs';

// Isolated live verification. No existing patient's password or token is used.
const { ref, clinic } = validateFreshConfiguration(process.env);
if (ref !== 'zktvrcaeztmzmsdjcjsa') throw new Error('Destino não aprovado.');
const app = new URL(process.argv[2]);
if (app.protocol !== 'https:' || app.search || app.hash || app.pathname !== '/') {
  throw new Error('Informe a origem publicada confirmada.');
}
const url = `https://${ref}.supabase.co`;
const tag = randomUUID();
const email = `password-verification-${tag}@example.invalid`;
const password = `Aa!${randomBytes(24).toString('hex')}`;
const nextPassword = `Bb!${randomBytes(24).toString('hex')}`;
const digits = [...randomBytes(9)].map(byte => byte % 10);
for (const factor of [10, 11]) {
  const remainder = digits.reduce((sum, digit, index) => sum + digit * (factor - index), 0) * 10 % 11;
  digits.push(remainder === 10 ? 0 : remainder);
}
const cpf = digits.join('');
let browser;
let patientId;
let authId;
let service;
let stage = 'preparar conexão';
try {
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys?reveal=true`, {
    headers: { Authorization: `Bearer ${process.env.SUPABASE_MIGRATION_ACCESS_TOKEN}` },
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) throw new Error('Consulta de configuração falhou.');
  const keys = await response.json();
  const serviceKey = keys.find(key => key.name === 'service_role' && key.type === 'legacy')?.api_key;
  const anonKey = keys.find(key => key.name === 'anon' && key.type === 'legacy')?.api_key;
  service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  async function invoke(body) {
    const result = await fetch(`${url}/functions/v1/patient-access`, {
      method: 'POST', signal: AbortSignal.timeout(60000),
      headers: {
        apikey: anonKey, Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json', Origin: app.origin,
      },
      body: JSON.stringify(body),
    });
    return { status: result.status, body: await result.json() };
  }
  stage = 'cadastrar paciente isolado';
  const registration = await invoke({
    action: 'register', password, redirectTo: `${app.origin}/?patient-auth=confirm`,
    patient: {
      name: 'Paciente temporário de verificação', cpf, email, birthDate: '1990-01-01',
      phone: '00000000000', streetName: 'Rua de teste', city: 'Cidade de teste',
    },
  });
  // Always look up the unique fixture for cleanup, even if the HTTP call failed.
  const patient = await service.from('patients').select('id,authUserId')
    .eq('clinicId', clinic).eq('email', email).maybeSingle();
  patientId = patient.data?.id;
  if (patientId) {
    const enrollment = await service.from('patient_access_enrollments').select('auth_user_id')
      .eq('patient_id', patientId).eq('clinic_id', clinic).maybeSingle();
    authId = enrollment.data?.auth_user_id || patient.data.authUserId;
  }
  assert.equal(registration.status, 200);
  assert.ok(patientId && authId);
  console.log(JSON.stringify({
    registrationPersisted: true, confirmationEmailAccepted: registration.body.confirmationEmailSent,
  }));
  stage = 'gerar OTP sem enviar outro e-mail';
  // generateLink does not send email. The OTP is kept only in process memory.
  const generated = await service.auth.admin.generateLink({
    type: 'recovery', email, options: { redirectTo: `${app.origin}/?patient-auth=recovery` },
  });
  assert.equal(generated.error, null);
  const token = generated.data.properties.hashed_token;
  stage = 'verificar tela publicada de nova senha';
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/repl/tools/bin/chromium',
    headless: true, args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.goto(`${app.origin}/?patient-auth=recovery&type=recovery&token_hash=${encodeURIComponent(token)}`);
  await page.locator('#patient-reset-password').waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('#patient-reset-password').fill(nextPassword);
  await page.locator('#patient-reset-confirm').fill(nextPassword);
  await page.locator('button[type=submit]').click();
  await page.getByText(/Senha (?:redefinida|atualizada)/i).first().waitFor({ timeout: 30000 });
  console.log(JSON.stringify({ publishedRecoveryFormVerified: true, isolatedPasswordSaved: true }));
  stage = 'entrar com CPF e nova senha';
  const login = await invoke({ action: 'login', cpf, password: nextPassword });
  assert.equal(login.status, 200);
  assert.ok(login.body.session?.access_token);
  const linked = await service.from('patients').select('authUserId,portalEnrollmentPending')
    .eq('id', patientId).eq('clinicId', clinic).single();
  assert.equal(linked.data.authUserId, authId);
  assert.equal(linked.data.portalEnrollmentPending, false);
  const staff = await fetch(`${url}/rest/v1/users?select=id`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${login.body.session.access_token}` },
  });
  assert.ok(staff.ok);
  assert.deepEqual(await staff.json(), []);
  console.log(JSON.stringify({ cpfLoginVerified: true, patientBindingVerified: true, staffDataIsolated: true }));
} catch {
  console.error(`Teste isolado interrompido na etapa: ${stage}. Nenhuma credencial foi exibida.`);
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (service && patientId) {
    const removed = await service.from('patients').delete()
      .eq('id', patientId).eq('clinicId', clinic).eq('email', email).select('id');
    if (removed.error || removed.data?.length !== 1) {
      console.error('A remoção do paciente de teste precisa de revisão.');
      process.exitCode = 1;
    }
  }
  if (service && authId) {
    const auth = await service.auth.admin.getUserById(authId);
    if (auth.data.user?.email === email) {
      const removed = await service.auth.admin.deleteUser(authId);
      if (removed.error) { console.error('A remoção da conta de teste precisa de revisão.'); process.exitCode = 1; }
      else console.log(JSON.stringify({ isolatedAuthRemoved: true }));
    }
  }
}
