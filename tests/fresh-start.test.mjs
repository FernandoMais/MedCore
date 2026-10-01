import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { validateFreshConfiguration, requireFreshInventory } from '../scripts/setup-fresh-admin.mjs';

const fixture = {
  VITE_FRESH_START: 'true', VITE_FRESH_TARGET_REF: 'a'.repeat(20),
  VITE_CLINIC_ID: '12345678-1234-4123-8123-123456789abc',
};
const source = await readFile(new URL('../services/freshStart.ts', import.meta.url), 'utf8');
async function moduleFor(env) {
  const compiled = ts.transpileModule(source.replaceAll('import.meta.env', JSON.stringify(env)), {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
}

test('fresh namespace cannot load the legacy browser database', async () => {
  const fresh = await moduleFor(fixture);
  assert.notEqual(fresh.localDatabaseKey(), 'medcore_pro_db_v3');
  assert.ok(fresh.localDatabaseKey().includes(fixture.VITE_CLINIC_ID));
  const another = await moduleFor({ ...fixture, VITE_CLINIC_ID: 'another-clinic' });
  assert.notEqual(fresh.localDatabaseKey(), another.localDatabaseKey());
});
test('fresh database contains no demo accounts, clinical records, or money', async () => {
  const fresh = await moduleFor(fixture);
  const db = fresh.emptyDatabase();
  for (const value of Object.values(db)) if (Array.isArray(value)) assert.equal(value.length, 0);
  for (const [key, rows] of Object.entries(db.financial)) {
    if (key !== 'settings') assert.equal(rows.length, 0);
  }
  assert.equal(db.financial.settings[0].sendPaymentNotifications, false);
  db.patients.push({ id: 'fixture' });
  assert.equal(fresh.emptyDatabase().patients.length, 0);
});
test('fresh connection fails closed on the previous or unapproved host', async () => {
  const fresh = await moduleFor(fixture);
  assert.equal(fresh.isApprovedFreshTarget(`https://${'a'.repeat(20)}.supabase.co`), true);
  for (const url of [undefined, `https://${'b'.repeat(20)}.supabase.co`, 'http://example.com', `https://user:pass@${'a'.repeat(20)}.supabase.co`]) {
    assert.equal(fresh.isApprovedFreshTarget(url), false);
  }
});
test('legacy mode stays separate and unchanged', async () => {
  const legacy = await moduleFor({});
  assert.equal(legacy.localDatabaseKey(), 'medcore_pro_db_v3');
  assert.equal(legacy.isApprovedFreshTarget('https://legacy.example'), true);
});
test('operator cannot create the administrator using old connection or weak credentials', () => {
  const env = { ...fixture, SUPABASE_MIGRATION_ACCESS_TOKEN: 'fixture-only' };
  assert.equal(validateFreshConfiguration(env).ref, fixture.VITE_FRESH_TARGET_REF);
  assert.throws(() => validateFreshConfiguration(env, true), /conexão/);
  const connected = { ...env, VITE_SUPABASE_URL: `https://${fixture.VITE_FRESH_TARGET_REF}.supabase.co`, VITE_SUPABASE_ANON_KEY: 'fixture-only' };
  assert.throws(() => validateFreshConfiguration(connected, true), /senha/);
  assert.equal(validateFreshConfiguration({ ...connected, INITIAL_ADMIN_EMAIL: 'fixture@example.test', INITIAL_ADMIN_PASSWORD: 'fixture-strong-password' }, true).clinic, fixture.VITE_CLINIC_ID);
});
test('operator refuses populated or unprotected target instead of deleting data', () => {
  const empty = { application_rows: 0, auth_users: 0, storage_objects: 0, rls_tables: 20 };
  requireFreshInventory(empty);
  for (const change of [{ application_rows: 1 }, { auth_users: 1 }, { storage_objects: 1 }, { rls_tables: 19 }]) {
    assert.throws(() => requireFreshInventory({ ...empty, ...change }));
  }
});