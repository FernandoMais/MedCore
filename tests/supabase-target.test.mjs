import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDestination, requireEmptyDestination } from '../scripts/bootstrap-supabase-target.mjs';

const source = 'a'.repeat(20);
const target = 'b'.repeat(20);

test('destination must be distinct from the configured source', () => {
  assert.equal(validateDestination(target, `https://${source}.supabase.co`), source);
  assert.throws(() => validateDestination(source, `https://${source}.supabase.co`));
  assert.throws(() => validateDestination('invalid', `https://${source}.supabase.co`));
  assert.throws(() => validateDestination(target, undefined));
  assert.throws(() => validateDestination(target, `http://${source}.supabase.co`));
  assert.throws(() => validateDestination(target, 'https://example.test'));
});

test('bootstrap requires empty app schema, Auth accounts and Storage objects', () => {
  const empty = { relations: [], auth_users: 0, storage_objects: 0 };
  assert.doesNotThrow(() => requireEmptyDestination(empty));
  assert.throws(() => requireEmptyDestination({ ...empty, auth_users: 1 }));
  assert.throws(() => requireEmptyDestination({ ...empty, storage_objects: 1 }));
  assert.throws(() => requireEmptyDestination({ ...empty, relations: [{ name: 'patients' }] }));
  assert.throws(() => requireEmptyDestination({ ...empty, relations: undefined }));
  assert.throws(() => requireEmptyDestination(undefined));
});