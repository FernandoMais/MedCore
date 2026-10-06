import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { validateFreshConfiguration } from './setup-fresh-admin.mjs';

// Explicit operator test: two requested emails, without consuming their links
// or changing the selected patient's identity/password. No PII is logged.
const { ref, clinic } = validateFreshConfiguration(process.env);
if (ref !== 'zktvrcaeztmzmsdjcjsa') throw new Error('Destino não aprovado.');
const email = process.argv[2];
const app = new URL(process.argv[3]);
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '') ||
    app.protocol !== 'https:' || app.search || app.hash || app.pathname !== '/') {
  throw new Error('Informe o destinatário solicitado e a origem publicada confirmada.');
}
const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys?reveal=true`, {
  headers: { Authorization: `Bearer ${process.env.SUPABASE_MIGRATION_ACCESS_TOKEN}` },
  signal: AbortSignal.timeout(45000),
});
if (!response.ok) throw new Error('Consulta de configuração falhou.');
const keys = await response.json();
const serviceKey = keys.find(key => key.name === 'service_role' && key.type === 'legacy')?.api_key;
const anonKey = keys.find(key => key.name === 'anon' && key.type === 'legacy')?.api_key;
const url = `https://${ref}.supabase.co`;
const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const tag = randomUUID();
let fixtureAuthId;
let stage = 'validar cadastro solicitado';
try {
  const patient = await service.from('patients').select('id,cpf,authUserId')
    .eq('clinicId', clinic).eq('email', email).single();
  assert.equal(patient.error, null);
  const p = patient.data;
  const enrollment = await service.from('patient_access_enrollments').select('auth_user_id')
    .eq('patient_id', p.id).eq('clinic_id', clinic).maybeSingle();
  assert.equal(enrollment.error, null);
  const patientAuthId = p.authUserId || enrollment.data?.auth_user_id;
  assert.ok(patientAuthId);
  const auth = await service.auth.admin.getUserById(patientAuthId);
  assert.equal(auth.error, null);
  assert.equal(auth.data.user.email, email);
  stage = 'autenticar operador isolado';
  const fixtureEmail = `delivery-verification-${tag}@example.invalid`;
  const fixturePassword = `Aa!${randomBytes(24).toString('hex')}`;
  const created = await service.auth.admin.createUser({
    email: fixtureEmail, password: fixturePassword, email_confirm: true,
    app_metadata: { verification_fixture: tag },
  });
  assert.equal(created.error, null);
  fixtureAuthId = created.data.user.id;
  const profile = await service.from('users').insert({
    id: fixtureAuthId, authUserId: fixtureAuthId, clinicId: clinic,
    role: 'admin', name: 'Verificação temporária', username: fixtureEmail, password: '',
  });
  assert.equal(profile.error, null);
  const login = await anon.auth.signInWithPassword({ email: fixtureEmail, password: fixturePassword });
  assert.equal(login.error, null);
  async function invoke(body, bearer = anonKey) {
    const result = await fetch(`${url}/functions/v1/patient-access`, {
      method: 'POST', signal: AbortSignal.timeout(60000),
      headers: {
        apikey: anonKey, Authorization: `Bearer ${bearer}`,
        Origin: app.origin, 'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    return { status: result.status, body: await result.json() };
  }
  stage = 'enviar pelo caminho administrativo';
  const admin = await invoke({
    action: 'admin-reset', patientId: p.id,
    redirectTo: `${app.origin}/?patient-auth=recovery`,
  }, login.data.session.access_token);
  console.log(JSON.stringify({ adminRecoveryStatus: admin.status, adminSendAccepted: admin.body.sent === true }));
  assert.equal(admin.status, 200);
  assert.equal(admin.body.sent, true);
  const afterAdmin = await service.auth.admin.getUserById(patientAuthId);
  assert.equal(afterAdmin.error, null);
  const firstSentAt = afterAdmin.data.user.recovery_sent_at;
  assert.ok(firstSentAt);
  // A new OTP invalidates the previous link. Respect the native cooldown and
  // tell the recipient to use the latest email after the test.
  stage = 'respeitar intervalo de envio';
  await new Promise(resolve => setTimeout(resolve, 65000));
  stage = 'enviar pela recuperação pública com CPF';
  const publicRecovery = await invoke({
    action: 'recover', cpf: p.cpf, redirectTo: `${app.origin}/?patient-auth=recovery`,
  });
  const afterPublic = await service.auth.admin.getUserById(patientAuthId);
  assert.equal(afterPublic.error, null);
  const secondSentAt = afterPublic.data.user.recovery_sent_at;
  const accepted = Date.parse(secondSentAt) > Date.parse(firstSentAt);
  console.log(JSON.stringify({
    publicRecoveryStatus: publicRecovery.status, publicSendAccepted: accepted,
    actualPatientPasswordUntouched: true,
  }));
  assert.equal(publicRecovery.status, 200);
  assert.equal(accepted, true);
} catch {
  console.error(`Verificação de envio interrompida na etapa: ${stage}. Nenhuma credencial foi exibida.`);
  process.exitCode = 1;
} finally {
  await anon.auth.signOut({ scope: 'local' });
  if (fixtureAuthId) {
    const auth = await service.auth.admin.getUserById(fixtureAuthId);
    if (auth.data.user?.app_metadata?.verification_fixture === tag) {
      const profile = await service.from('users').delete().eq('id', fixtureAuthId)
        .eq('authUserId', fixtureAuthId).eq('clinicId', clinic);
      if (profile.error) { console.error('A remoção do operador temporário precisa de revisão.'); process.exitCode = 1; }
      else {
        const removed = await service.auth.admin.deleteUser(fixtureAuthId);
        if (removed.error) { console.error('A remoção da conta temporária precisa de revisão.'); process.exitCode = 1; }
        else console.log(JSON.stringify({ isolatedOperatorRemoved: true }));
      }
    }
  }
}
