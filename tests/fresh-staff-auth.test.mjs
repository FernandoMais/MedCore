import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../services/freshStaffAuth.ts', import.meta.url), 'utf8');
let sequence = 0;
async function run({ role = 'admin', clinic = 'fixture-clinic', error = null, binding = 'fixture-clinic' } = {}) {
  let signedOut = 0;
  let selected;
  globalThis.__freshAuthTest = {
    isSupabaseConfigured: true,
    supabase: {
      auth: {
        signInWithPassword: async () => ({
          error, data: { user: { id: 'fixture-auth' }, session: error ? null : { access_token: 'fixture-token' } },
        }),
        signOut: async () => { signedOut++; },
      },
      from: table => {
        assert.equal(table, 'users');
        return { select: columns => {
          selected = columns;
          return { eq: (column, value) => {
            assert.equal(column, 'authUserId');
            assert.equal(value, 'fixture-auth');
            return { maybeSingle: async () => ({
              error: null,
              data: { id: 'fixture-profile', name: 'Fixture', username: 'fixture@example.test',
                role, clinicId: clinic, authUserId: 'fixture-auth' },
            }) };
          } };
        } };
      },
      rpc: async name => { assert.equal(name, 'bind_current_user'); return { error: null, data: binding }; },
    },
  };
  const prepared = source
    .replace("import { supabase, isSupabaseConfigured } from './supabase';",
      'const {supabase,isSupabaseConfigured} = globalThis.__freshAuthTest;')
    .replace("import { freshClinicId } from './freshStart';", "const freshClinicId = 'fixture-clinic';")
    .replace("import { User, UserRole } from '../types';",
      "const UserRole = {ADMIN:'admin',DOCTOR:'doctor',COLLABORATOR:'collaborator'};");
  const compiled = ts.transpileModule(prepared, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const auth = await import(`data:text/javascript;base64,${Buffer.from(compiled + `\n// ${sequence++}`).toString('base64')}`);
  const result = await auth.loginFreshStaff('fixture@example.test', 'fixture-password');
  delete globalThis.__freshAuthTest;
  return { result, signedOut, selected };
}

test('fresh login uses the server-bound profile and never reads/stores its password', async () => {
  const { result, selected } = await run();
  assert.equal(result.ok, true);
  assert.equal(result.user.password, '');
  assert.equal(result.user.clinicId, 'fixture-clinic');
  assert.ok(!selected.includes('password'));
});
test('fresh login has no local-success fallback when Auth rejects the password', async () => {
  assert.equal((await run({ error: { message: 'fixture-private-error' } })).result.ok, false);
});
test('patient accounts cannot enter the staff application', async () => {
  const { result, signedOut } = await run({ role: 'patient' });
  assert.equal(result.ok, false); assert.equal(signedOut, 1);
});
test('a different profile clinic or server binding is rejected and signed out', async () => {
  for (const args of [{ clinic: 'other-clinic' }, { binding: 'other-clinic' }, { binding: null }]) {
    const { result, signedOut } = await run(args);
    assert.equal(result.ok, false); assert.equal(signedOut, 1);
  }
});