import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function load(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}
const { persistConsultation } = await load('../services/clinicalPersistence.ts');
const { CloudChanges } = await load('../services/cloudChanges.ts');
const input = { complaint: 'Queixa fictícia', diagnosis: '', conduct: '', prescription: '' };

test('clinical errors reject instead of acknowledging a saved encounter', async () => {
  await assert.rejects(persistConsultation({ rpc: async () => ({ error: { code: '42501' } }) }, 'a1', input), /rascunho foi mantido/);
  await assert.rejects(persistConsultation({ rpc: async () => { throw Error('offline'); } }, 'a1', input), /offline/);
});
test('incomplete or mismatched server acknowledgements reject', async () => {
  for (const data of [null, {}, { appointment: { id: 'other', status: 'Finalizado' }, evolution: { id: 'e1', appointment_id: 'a1' } },
    { appointment: { id: 'a1', status: 'Agendado' }, evolution: { id: 'e1', appointment_id: 'a1' } },
    { appointment: { id: 'a1', status: 'Finalizado' }, evolution: { id: 'e1' } }]) {
    await assert.rejects(persistConsultation({ rpc: async () => ({ data }) }, 'a1', input), /incompleta/);
  }
});
test('clinical payload never accepts client-supplied clinic, author or status', async () => {
  const saved = { appointment: { id: 'a1', status: 'Finalizado' }, evolution: { id: 'e1', appointment_id: 'a1' } };
  let called;
  assert.deepEqual(await persistConsultation({ rpc: async (name, args) => { called = { name, args }; return { data: saved }; } }, 'a1',
    { ...input, clinicId: 'attacker', medico_id: 'other', status: 'Finalizado' }), saved);
  assert.equal(called.name, 'finish_clinical_consultation');
  assert.equal(called.args.p_appointment_id, 'a1');
  assert.equal('clinicId' in called.args, false);
  assert.equal('medico_id' in called.args, false);
});
test('unchanged rows and empty remote collections are not bulk-replayed', () => {
  const tracker = new CloudChanges();
  tracker.capture('clinic:patients', [{ id: 'p1', name: 'A', details: { a: 1, b: 2 } }]);
  assert.deepEqual(tracker.changed('clinic:patients', [{ details: { b: 2, a: 1 }, name: 'A', id: 'p1' }]), []);
  const changed = { id: 'p1', name: 'B' };
  assert.deepEqual(tracker.changed('clinic:patients', [changed]), [changed]);
  tracker.acknowledged('clinic:patients', [changed]);
  assert.deepEqual(tracker.changed('clinic:patients', [changed]), []);
  tracker.capture('clinic:empty', []);
  assert.deepEqual(tracker.changed('clinic:empty', []), []);
});
test('an unauthorized or not-yet-loaded clinic cannot synchronize', () => {
  const tracker = new CloudChanges();
  assert.throws(() => tracker.changed('other-clinic:patients', [{ id: 'p1' }]), /carregados/);
  tracker.capture('clinic:patients', [{ id: 'p1' }]);
  tracker.clear();
  assert.throws(() => tracker.changed('clinic:patients', [{ id: 'p1' }]), /carregados/);
});
test('missing records never receive a false synchronized acknowledgement', () => {
  const tracker = new CloudChanges();
  tracker.capture('clinic:patients', [{ id: 'p1' }]);
  assert.throws(() => tracker.assertNoUnconfirmedRemovals('clinic:patients', []), /exclusão/);
  tracker.assertNoUnconfirmedRemovals('clinic:patients', [{ id: 'p1' }]);
});
