import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const basePath = path.join(projectRoot, 'supabase/new-project/01_fresh_project_base.sql');
const patientMigrationPath = path.join(projectRoot, 'supabase_patient_access_migration.sql');
const outputPath = path.join(projectRoot, 'supabase_new_project.sql');

function stripTransactionEnvelope(sql, filename) {
  const leadingBegin = /^\s*begin\s*;\s*/i.exec(sql);
  const trailingCommit = /\s*commit\s*;\s*$/i.exec(sql);
  if (!leadingBegin || !trailingCommit || trailingCommit.index < leadingBegin[0].length) {
    throw new Error(`${filename} must have exactly one outer BEGIN/COMMIT envelope.`);
  }
  return sql.slice(leadingBegin[0].length, trailingCommit.index).trim();
}

const [baseSchema, patientMigration] = await Promise.all([
  readFile(basePath, 'utf8'),
  readFile(patientMigrationPath, 'utf8'),
]);

const combined = [
  '-- GENERATED FILE: node scripts/build-supabase-new-project.mjs',
  '-- Fresh-project bootstrap only. Review 00_source_inventory.sql first.',
  '-- This transaction creates no Auth-managed tables and seeds no users, clinic, or credentials.',
  '-- It applies schema/security only; it does not import application data or Storage objects.',
  '-- If any application schema/table already exists, the guard deliberately stops execution.',
  'begin;',
  baseSchema.trim(),
  '-- Existing hardened patient-access migration, unchanged except for its outer transaction wrapper.',
  stripTransactionEnvelope(patientMigration, 'supabase_patient_access_migration.sql'),
  'commit;',
  '',
].join('\n\n');

await writeFile(outputPath, combined, 'utf8');
console.log(`Wrote ${path.relative(projectRoot, outputPath)} from reviewed local SQL components.`);