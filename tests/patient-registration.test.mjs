import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile('supabase/functions/patient-access/index.ts', 'utf8');
const prepared = source.replace('from "npm:@supabase/supabase-js@2"', 'from "@supabase/supabase-js"')
  .replaceAll('import.meta.main', 'false');
// Only pure validation exports are evaluated; the server is not started.
const compiled = ts.transpileModule(prepared, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText.replaceAll('import.meta.main', 'false');
const { createRequire } = await import('node:module');
const require = createRequire(import.meta.url);
const module = { exports: {} };
new Function('require', 'module', 'exports', compiled)(require, module, module.exports);
const { sanitizePatient } = module.exports;
const patient = {
  name: 'Paciente de teste', cpf: '52998224725', birthDate: '1990-01-01',
  email: 'patient@example.test', phone: '(11) 99999-0000',
  streetName: 'Rua Teste', city: 'São Paulo',
};
test('registration accepts identity/contact fields without payment', () => {
  const result = sanitizePatient(patient);
  assert.ok(result);
  assert.equal(result.email, patient.email);
  for (const key of ['paymentValue', 'paymentSender', 'authUserId', 'clinicId']) {
    assert.equal(Object.hasOwn(result, key), false);
  }
});
test('registration rejects payment and caller-supplied authorization fields', () => {
  for (const addition of [{ paymentValue: '150' }, { paymentSender: 'Fixture' },
    { clinicId: 'other' }, { authUserId: 'forged' }]) {
    assert.equal(sanitizePatient({ ...patient, ...addition }), null);
  }
});
test('registration still validates mandatory identity information', () => {
  for (const addition of [{ cpf: '11111111111' }, { email: 'invalid' },
    { birthDate: '1990-02-30' }, { name: '' }]) {
    assert.equal(sanitizePatient({ ...patient, ...addition }), null);
  }
});