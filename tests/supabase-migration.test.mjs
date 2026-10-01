import test from 'node:test';
import assert from 'node:assert/strict';
import { enrollmentHash, validateEnrollment, validateProjects, repairEnrollments } from '../scripts/rehash-patient-enrollments.mjs';

const fixture = () => ({
  row: { patient_id: 'fixture-patient', clinic_id: 'fixture-clinic', auth_user_id: 'fixture-auth', nonce_hash: 'a'.repeat(64) },
  patient: { id: 'fixture-patient', clinicId: 'fixture-clinic', email: 'patient@example.test', authUserId: null },
  user: { id: 'fixture-auth', email: 'patient@example.test', app_metadata: { patient_access_enrollment: 'b'.repeat(64) } },
});

test('requires distinct projects and exact HTTPS target origin', () => {
  assert.doesNotThrow(() => validateProjects('https://targetref.supabase.co', 'sourceref', 'targetref'));
  for (const url of ['http://targetref.supabase.co', 'https://sourceref.supabase.co', 'https://targetref.supabase.co/path', 'https://targetref.supabase.co?key=x']) {
    assert.throws(() => validateProjects(url, 'sourceref', 'targetref'));
  }
  assert.throws(() => validateProjects('https://targetref.supabase.co', 'targetref', 'targetref'));
});

test('enrollment hashes are deterministic and differ per project key and identity', () => {
  const first = enrollmentHash('dummy-source-key', 'clinic', 'patient', 'nonce');
  assert.equal(first, enrollmentHash('dummy-source-key', 'clinic', 'patient', 'nonce'));
  assert.notEqual(first, enrollmentHash('dummy-target-key', 'clinic', 'patient', 'nonce'));
  assert.notEqual(first, enrollmentHash('dummy-source-key', 'other', 'patient', 'nonce'));
});

test('only a matching patient-only Auth binding with server metadata is accepted', () => {
  const { row, patient, user } = fixture();
  assert.equal(validateEnrollment(row, patient, user, null), 'b'.repeat(64));
  assert.throws(() => validateEnrollment(row, patient, user, { id: 'staff' }));
  assert.throws(() => validateEnrollment(row, { ...patient, clinicId: 'other' }, user, null));
  assert.throws(() => validateEnrollment(row, { ...patient, authUserId: 'other' }, user, null));
  assert.throws(() => validateEnrollment(row, { ...patient, authUserId: user.id }, user, null));
  assert.throws(() => validateEnrollment(row, patient, { ...user, email: 'other@example.test' }, null));
  assert.throws(() => validateEnrollment(row, patient, { ...user, app_metadata: {}, user_metadata: user.app_metadata }, null));
});

function fakeClient(invalid = false) {
  const { row, patient, user } = fixture();
  let writes = 0;
  const client = {
    auth: { admin: { getUserById: async () => ({ data: { user }, error: null }) } },
    from(table) {
      let update = false;
      const chain = {
        select() { return chain; }, order() { return chain; }, eq() { return chain; },
        range: async () => ({ data: [row], error: null }),
        update() { update = true; writes++; return chain; },
        maybeSingle: async () => ({
          data: update ? { patient_id: row.patient_id }
            : table === 'patients' ? { ...patient, clinicId: invalid ? 'wrong' : patient.clinicId } : null,
          error: null,
        }),
      };
      return chain;
    },
  };
  return { client, writes: () => writes };
}

test('simulation makes no writes; apply updates only the validated private hash', async () => {
  const dry = fakeClient();
  const result = await repairEnrollments(dry.client, 'dummy-target-key');
  assert.equal(result.changes, 1);
  assert.equal(dry.writes(), 0);
  const apply = fakeClient();
  assert.equal((await repairEnrollments(apply.client, 'dummy-target-key', true)).updated, 1);
  assert.equal(apply.writes(), 1);
});

test('invalid identity aborts before any write even in apply mode', async () => {
  const invalid = fakeClient(true);
  await assert.rejects(repairEnrollments(invalid.client, 'dummy-target-key', true));
  assert.equal(invalid.writes(), 0);
});

test('an already-linked last record prevents writes to earlier valid enrollments', async () => {
  const first = fixture();
  const last = fixture();
  last.row = { ...last.row, patient_id: 'last-patient', auth_user_id: 'last-auth' };
  last.patient = { ...last.patient, id: 'last-patient', authUserId: 'last-auth' };
  last.user = { ...last.user, id: 'last-auth' };
  let writes = 0;
  const client = {
    auth: { admin: { getUserById: async id => ({ data: { user: id === 'last-auth' ? last.user : first.user } }) } },
    from(table) {
      let selectedId;
      const chain = {
        select() { return chain; }, order() { return chain; },
        eq(column, value) { if (column === 'id') selectedId = value; return chain; },
        range: async () => ({ data: [first.row, last.row] }),
        update() { writes++; return chain; },
        maybeSingle: async () => ({
          data: table === 'patients' ? selectedId === 'last-patient' ? last.patient : first.patient : null,
        }),
      };
      return chain;
    },
  };
  await assert.rejects(repairEnrollments(client, 'dummy-target-key', true));
  assert.equal(writes, 0);
});