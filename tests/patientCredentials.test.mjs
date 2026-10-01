import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../services/patientCredentials.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
  },
}).outputText;
const credentials = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

function cpfFromPrefix(prefix) {
  const digit = digits => {
    const sum = [...digits].reduce(
      (total, value, index) => total + Number(value) * (digits.length + 1 - index),
      0,
    );
    return String((sum * 10) % 11 % 10);
  };
  const firstTen = prefix + digit(prefix);
  return firstTen + digit(firstTen);
}

const validFixtureCpf = cpfFromPrefix('741852963');

test('normalizes CPF formatting without changing its digits', () => {
  assert.equal(credentials.normalizeCpf(` ${validFixtureCpf.slice(0, 3)}.${validFixtureCpf.slice(3, 6)}.${validFixtureCpf.slice(6, 9)}-${validFixtureCpf.slice(9)} `), validFixtureCpf);
});

test('validates generated CPF checksums and rejects malformed/repeated digits', () => {
  assert.equal(credentials.isValidCpf(validFixtureCpf), true);
  assert.equal(credentials.isValidCpf(` ${validFixtureCpf.slice(0, 3)}.${validFixtureCpf.slice(3, 6)}.${validFixtureCpf.slice(6, 9)}-${validFixtureCpf.slice(9)} `), true);
  assert.equal(credentials.isValidCpf(validFixtureCpf.slice(0, 10) + (Number(validFixtureCpf[10]) + 1) % 10), false);
  assert.equal(credentials.isValidCpf('11111111111'), false);
  assert.equal(credentials.isValidCpf('1234567890'), false);
});

test('accepts patient passwords only from 8 through 128 characters', () => {
  assert.equal(credentials.isValidPatientPassword('1234567'), false);
  assert.equal(credentials.isValidPatientPassword('12345678'), true);
  assert.equal(credentials.isValidPatientPassword('x'.repeat(128)), true);
  assert.equal(credentials.isValidPatientPassword('x'.repeat(129)), false);
});

test('removes legacy patient passwords from a copied patient record', () => {
  const patient = { id: 'fixture-patient', patientPassword: 'legacy-secret', name: 'Fixture Patient' };
  const clean = credentials.removeLegacyPatientPassword(patient);
  assert.deepEqual(clean, { id: 'fixture-patient', name: 'Fixture Patient' });
  assert.equal(Object.hasOwn(clean, 'patientPassword'), false);
  assert.equal(patient.patientPassword, 'legacy-secret');
});