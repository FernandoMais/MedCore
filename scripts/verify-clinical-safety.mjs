// Real-cloud verification with synthetic fixtures only. Never prints credentials,
// account identities or clinical content. Removes its own fixtures in finally.
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { validateFreshConfiguration } from './setup-fresh-admin.mjs';

const { ref, clinic: clinicId } = validateFreshConfiguration(process.env);
assert.equal(ref, 'zktvrcaeztmzmsdjcjsa');
const url = `https://${ref}.supabase.co`;
const tag = randomUUID().replaceAll('-', '');
const constraint = `clinical_verification_${tag}`;
const pids = [`verification-patient-${tag}`];
const dids = [`verification-doctor-${tag}`, `verification-other-doctor-${tag}`];
const aids = [`verification-appointment-${tag}`, `verification-rollback-${tag}`];
const uids = [], authIds = [];
let service, installedConstraint = false, stage = 'obter acesso administrativo';
const report = {};
async function management(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST', signal: AbortSignal.timeout(60000),
    headers: { Authorization: `Bearer ${process.env.SUPABASE_MIGRATION_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, read_only: false }),
  });
  assert.ok(r.ok, 'Consulta administrativa não confirmada.');
  const result = await r.json();
  assert.ok(Array.isArray(result));
  return result;
}
function checked(result) {
  if (result.error) {
    const code = String(result.error.code || 'unavailable').replace(/[^a-zA-Z0-9_-]/g, '');
    const column = result.error.message?.match(/null value in column "([a-zA-Z0-9_]+)"/)?.[1];
    throw new Error(`fixture-error:${code}${column ? `:${column}` : ''}`);
  }
  return result.data;
}
async function count(client, table, field, value) {
  const result = await client.from(table).select('id', { count: 'exact', head: true }).eq(field, value);
  checked(result);
  return result.count;
}
try {
  const kr = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys?reveal=true`, {
    headers: { Authorization: `Bearer ${process.env.SUPABASE_MIGRATION_ACCESS_TOKEN}` },
  });
  assert.ok(kr.ok);
  const keys = await kr.json();
  const anon = keys.find(k => k.name === 'anon')?.api_key;
  const elevated = keys.find(k => k.name === 'service_role')?.api_key;
  assert.ok(anon && elevated);
  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
  service = createClient(url, elevated, options);
  stage = 'criar médicos fictícios';
  checked(await service.from('doctors').insert(dids.map((id, index) => ({
    id, clinicId, name: `Médico fictício ${index}`, crm: `TEST-${tag.slice(0,12)}-${index}`, specialty: 'Psicologia',
    email: `doctor-${index}-${tag}@example.invalid`, phone: '', availableTimes: [],
  }))));
  const actors = {};
  for (const [kind, role, doctorId, tenant] of [
    ['owner', 'doctor', dids[0], clinicId],
    ['admin', 'admin', null, clinicId],
    ['other', 'doctor', dids[1], clinicId],
    ['collaborator', 'collaborator', null, clinicId],
    ['outside', 'admin', null, randomUUID()],
    ['patient', null, null, clinicId],
  ]) {
    const email = `clinical-${kind}-${tag}@example.invalid`;
    stage = `criar conta fictícia ${kind}`;
    const password = randomBytes(32).toString('base64url');
    const created = checked(await service.auth.admin.createUser({ email, password, email_confirm: true }));
    authIds.push(created.user.id);
    const profile = { id: `verification-user-${kind}-${tag}`, authUserId: created.user.id,
      clinicId: tenant, username: email, name: `Conta fictícia ${kind}`, role, doctor_id: doctorId };
    if (role) {
      stage = `vincular perfil fictício ${kind}`;
      checked(await service.from('users').insert(profile));
      uids.push(profile.id);
    }
    const client = createClient(url, anon, options);
    stage = `autenticar conta fictícia ${kind}`;
    checked(await client.auth.signInWithPassword({ email, password }));
    actors[kind] = { client, profile, authId: created.user.id };
  }
  stage = 'criar paciente fictício';
  checked(await service.from('patients').insert({
    id: pids[0], clinicId, name: 'Paciente exclusivamente fictício', cpf: '00000000000',
    birthDate: '1990-01-01', gender: 'Outro', email: `patient-${tag}@example.invalid`,
    phone: '', history: '', authUserId: actors.patient.authId, files: [],
  }));
  stage = 'criar agendamentos fictícios';
  checked(await service.from('appointments').insert(aids.map(id => ({
    id, clinicId, patientId: pids[0], doctorId: dids[0], date: '2026-10-09',
    time: '08:00', type: 'Consulta', status: 'Agendado',
  }))));
  const payload = { p_appointment_id: aids[0], p_complaint: 'Evolução exclusivamente fictícia',
    p_diagnosis: '', p_conduct: '', p_prescription: '', p_specialty: 'Clínica Geral', p_access_password: '' };
  stage = 'bloquear finalização não autorizada';
  for (const kind of ['other', 'collaborator', 'outside', 'patient']) {
    const result = await actors[kind].client.rpc('finish_clinical_consultation', payload);
    assert.ok(result.error);
  }
  assert.equal(await count(service, 'evolucao_paciente', 'appointment_id', aids[0]), 0);
  report.unauthorizedFinalizationBlocked = true;

  stage = 'finalização atômica e repetição simultânea';
  const results = await Promise.all([actors.owner.client.rpc('finish_clinical_consultation', payload),
    actors.owner.client.rpc('finish_clinical_consultation', payload)]);
  const first = checked(results[0]), second = checked(results[1]);
  assert.equal(first.appointment.status, 'Finalizado');
  assert.equal(first.evolution.id, second.evolution.id);
  assert.equal(first.evolution.especialidade, 'Psicologia');
  assert.equal(await count(service, 'evolucao_paciente', 'appointment_id', aids[0]), 1);
  const changedRetry = await actors.owner.client.rpc('finish_clinical_consultation', { ...payload, p_complaint: 'Conteúdo diferente' });
  assert.ok(changedRetry.error);
  report.atomicFinalizationAndIdempotentRetry = true;
  report.sensitiveSpecialtyCannotBeDowngraded = true;
  assert.ok((await actors.admin.client.from('appointments').update({ status: 'Agendado' }).eq('id', aids[0])).error);
  assert.ok((await actors.owner.client.from('appointments').update({ doctorId: dids[1] }).eq('id', aids[0])).error);
  report.finalizedIdentityAndStatusProtected = true;

  stage = 'verificar rollback após falha na segunda gravação';
  // Only this uniquely tagged synthetic appointment matches the temporary
  // constraint; ordinary clinic appointments cannot be affected.
  await management(`ALTER TABLE public.appointments ADD CONSTRAINT ${constraint}
    CHECK (id <> '${aids[1]}' OR status <> 'Finalizado') NOT VALID`);
  installedConstraint = true;
  const failed = await actors.owner.client.rpc('finish_clinical_consultation', { ...payload, p_appointment_id: aids[1] });
  assert.ok(failed.error);
  assert.equal(await count(service, 'evolucao_paciente', 'appointment_id', aids[1]), 0);
  const untouched = checked(await service.from('appointments').select('status').eq('id', aids[1]).single());
  assert.equal(untouched.status, 'Agendado');
  report.partialWriteRollbackVerified = true;
  await management(`ALTER TABLE public.appointments DROP CONSTRAINT ${constraint}`);
  installedConstraint = false;

  stage = 'verificar sigilo por função e clínica';
  const note = { id: `verification-note-${tag}`, patientId: pids[0], authorId: actors.owner.profile.id,
    authorName: actors.owner.profile.name, note: 'Nota exclusivamente fictícia', createdAt: new Date().toISOString() };
  checked(await actors.owner.client.from('sigilous_notes').insert(note));
  for (const kind of ['owner', 'admin', 'other', 'collaborator', 'outside', 'patient']) {
    const expected = ['owner', 'admin'].includes(kind) ? 1 : 0;
    assert.equal(await count(actors[kind].client, 'sigilous_notes', 'id', note.id), expected);
    assert.equal(await count(actors[kind].client, 'evolucao_paciente', 'appointment_id', aids[0]), expected);
  }
  const forged = await actors.other.client.from('sigilous_notes').insert({ ...note, id: `verification-forged-${tag}` });
  assert.ok(forged.error);
  assert.ok((await actors.owner.client.from('sigilous_notes').update({ note: 'Substituição' }).eq('id', note.id)).error);
  assert.ok((await actors.owner.client.from('sigilous_notes').delete().eq('id', note.id)).error);
  assert.equal(checked(await service.from('patients').select('history').eq('id', pids[0]).single()).history, '');
  report.privateRecordsRestrictedToAuthorAndClinicAdmin = true;
  const directEvolution = checked(await actors.owner.client.from('evolucao_paciente').insert({
    paciente_id: pids[0], medico_id: dids[0], medico_nome: actors.owner.profile.name,
    especialidade: 'Clínica Geral', anotacoes: 'Texto exclusivamente fictício', senha_acesso: '',
  }).select('id').single());
  assert.equal(await count(actors.collaborator.client, 'evolucao_paciente', 'id', directEvolution.id), 0);
  assert.equal(await count(actors.owner.client, 'evolucao_paciente', 'id', directEvolution.id), 1);
  report.directInsertCannotBypassSensitiveProviderPrivacy = true;
  checked(await service.from('doctors').update({ specialty: 'Clínica Geral' }).eq('id', dids[0]));
  assert.equal(await count(actors.collaborator.client, 'evolucao_paciente', 'id', directEvolution.id), 0);
  report.privacySurvivesClinicianSpecialtyChange = true;
  report.forgedAuthorAndDestructiveChangesBlocked = true;
  report.privateContentNotCopiedIntoGeneralHistory = true;
} catch (error) {
  report.failedStage = stage;
  if (error.message?.startsWith('fixture-error:')) report.safeErrorCode = error.message;
  process.exitCode = 1;
} finally {
  let clean = true;
  if (installedConstraint) {
    try { await management(`ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS ${constraint}`); } catch { clean = false; }
  }
  if (service) {
    for (const [table, field, ids] of [
      ['sigilous_notes', 'patientId', pids], ['evolucao_paciente', 'paciente_id', pids],
      ['appointments', 'id', aids], ['patients', 'id', pids], ['users', 'id', uids], ['doctors', 'id', dids],
    ]) {
      if (ids.length && (await service.from(table).delete().in(field, ids)).error) clean = false;
    }
    for (const id of authIds) if ((await service.auth.admin.deleteUser(id)).error) clean = false;
    for (const [table, ids] of [['patients', pids], ['appointments', aids], ['users', uids], ['doctors', dids]]) {
      if (ids.length) {
        const remaining = await service.from(table).select('id', { count: 'exact', head: true }).in('id', ids);
        if (remaining.error || remaining.count !== 0) clean = false;
      }
    }
  }
  report.syntheticFixturesRemoved = clean;
  if (!clean) process.exitCode = 1;
  console.log(JSON.stringify(report));
}
