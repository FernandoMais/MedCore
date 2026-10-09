import { readFile } from 'node:fs/promises';
import { validateFreshConfiguration } from './setup-fresh-admin.mjs';

const { ref } = validateFreshConfiguration(process.env);
if (ref !== 'zktvrcaeztmzmsdjcjsa') throw new Error('Destino não aprovado.');
if (!process.argv.includes('--apply')) {
  console.log(JSON.stringify({ approvedTarget: true, additiveMigration: true, applyRequired: true }));
} else {
  const query = await readFile(new URL('../supabase/migrations/20261009_clinical_safety.sql', import.meta.url), 'utf8');
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST', signal: AbortSignal.timeout(60000),
    headers: { Authorization: `Bearer ${process.env.SUPABASE_MIGRATION_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, read_only: false }),
  });
  if (!r.ok) {
    console.error(`A migração transacional não foi confirmada (HTTP ${r.status}). Nenhuma credencial foi exibida.`);
    process.exitCode = 1;
  } else {
    const data = await r.json();
    if (!Array.isArray(data)) {
      console.error('Resposta inesperada ao aplicar a proteção clínica.');
      process.exitCode = 1;
    } else console.log(JSON.stringify({ clinicalSafetyMigrationApplied: true }));
  }
}
