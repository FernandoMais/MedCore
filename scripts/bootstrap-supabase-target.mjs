import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const API = 'https://api.supabase.com/v1';
const TABLES = [
  'users', 'doctors', 'patients', 'appointments', 'medications',
  'evolucao_paciente', 'sigilous_notes', 'financial_transactions',
  'financial_categories', 'financial_cost_centers', 'financial_payment_methods',
  'financial_bank_accounts', 'financial_insurance_plans', 'financial_repasses',
  'financial_cash_closures', 'financial_reconciliations', 'financial_billing_records',
  'financial_settings', 'patient_access_enrollments', 'patient_access_rate_limits',
];

export function validateDestination(targetRef, configuredSourceUrl) {
  if (!/^[a-z0-9]{20}$/.test(targetRef || '')) {
    throw new Error('Confirme o código de 20 caracteres do projeto de destino.');
  }
  let source;
  try { source = new URL(configuredSourceUrl); } catch {
    throw new Error('Não foi possível identificar a origem configurada. Nenhuma instalação será feita.');
  }
  const sourceRef = source.hostname.match(/^([a-z0-9]{20})\.supabase\.co$/)?.[1];
  if (!sourceRef || source.protocol !== 'https:' || source.username || source.password) {
    throw new Error('A origem configurada precisa ser conferida antes da instalação.');
  }
  if (sourceRef === targetRef) {
    throw new Error('O destino é o projeto atualmente conectado. Instalação recusada.');
  }
  return sourceRef;
}

export function requireEmptyDestination(inventory) {
  if (!inventory || !Array.isArray(inventory.relations)
    || inventory.relations.length !== 0
    || inventory.auth_users !== 0 || inventory.storage_objects !== 0) {
    throw new Error('O destino contém estrutura ou dados. Bootstrap recusado; revise o inventário.');
  }
}

async function request(token, path, payload) {
  const response = await fetch(`${API}${path}`, {
    method: payload ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
    redirect: 'error',
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) {
    // Never print response bodies: they may contain credentials or data.
    throw new Error(`A administração do Supabase respondeu HTTP ${response.status}. Confira acesso/permissões; nenhuma conexão do aplicativo foi alterada.`);
  }
  const data = await response.json();
  if (data?.error) throw new Error('O Supabase recusou a operação. Confira o projeto antes de tentar novamente.');
  return data;
}

const inventorySql = `
select jsonb_build_object(
  'relations', coalesce((
    select jsonb_agg(jsonb_build_object('name', c.relname, 'kind', c.relkind,
      'rls', c.relrowsecurity) order by c.relname)
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','p','v','m','f')
      and not exists (select 1 from pg_catalog.pg_depend d
        where d.classid = 'pg_catalog.pg_class'::regclass
          and d.objid = c.oid and d.deptype = 'e')
  ), '[]'::jsonb),
  'auth_users', (select count(*) from auth.users),
  'storage_objects', (select count(*) from storage.objects)
) as inventory;`;

async function inventory(token, ref) {
  const result = await request(token, `/projects/${ref}/database/query`, {
    query: inventorySql, read_only: true,
  });
  if (!Array.isArray(result) || result.length !== 1 || !result[0]?.inventory) {
    throw new Error('Resposta de inventário inesperada. Operação interrompida.');
  }
  return result[0].inventory;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2 || args[0] !== '--target-ref'
    || args.length > 3 || (args[2] && args[2] !== '--apply-bootstrap')) {
    throw new Error('Use --target-ref REF_NOVO [--apply-bootstrap]. A consulta é o padrão.');
  }
  const ref = args[1];
  const sourceRef = validateDestination(ref, process.env.VITE_SUPABASE_URL);
  const token = process.env.SUPABASE_MIGRATION_ACCESS_TOKEN;
  if (!token?.trim()) throw new Error('Configure o token pelo formulário seguro.');
  const project = await request(token, `/projects/${ref}`);
  if (project.id !== ref || project.status !== 'ACTIVE_HEALTHY') {
    throw new Error('O projeto confirmado não está ativo e saudável. Operação interrompida.');
  }
  const before = await inventory(token, ref);
  console.log(JSON.stringify({ sourceRef, targetRef: ref, inventory: before }));
  requireEmptyDestination(before);
  if (args[2] !== '--apply-bootstrap') {
    console.log('Conferência concluída. Nenhum SQL de escrita foi executado.');
    return;
  }
  const sql = await readFile(new URL('../supabase_new_project.sql', import.meta.url), 'utf8');
  if (!sql.startsWith('-- GENERATED FILE: node scripts/build-supabase-new-project.mjs')
    || !/\bbegin\s*;/i.test(sql) || !/\bcommit\s*;\s*$/i.test(sql)
    || !sql.includes('Fresh-project bootstrap refused:')) {
    throw new Error('O arquivo SQL não corresponde ao bootstrap protegido esperado.');
  }
  await request(token, `/projects/${ref}/database/query`, { query: sql, read_only: false });
  const after = await inventory(token, ref);
  const tables = after.relations.filter(row => ['r', 'p'].includes(row.kind));
  if (tables.length !== TABLES.length || TABLES.some(name => !tables.some(t => t.name === name && t.rls))
    || after.auth_users !== 0 || after.storage_objects !== 0) {
    throw new Error('A verificação da estrutura requer revisão. Não conecte o aplicativo ao destino.');
  }
  const checks = await request(token, `/projects/${ref}/database/query`, {
    read_only: true,
    query: `select
      (select count(*) from pg_catalog.pg_class c
       join pg_catalog.pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r','p','v','m')
         and c.relname = any(array[${[...TABLES, 'patient_portal_doctors'].map(t => `'${t}'`).join(',')}])
         and pg_catalog.has_table_privilege('anon', c.oid, 'SELECT')) as anon_readable,
      pg_catalog.has_column_privilege('authenticated','public.users','password','SELECT') as staff_password_readable,
      (select count(*) from information_schema.columns where table_schema='public'
         and table_name='patients' and column_name='patientPassword') as patient_password_columns;`,
  });
  const check = checks?.[0];
  if (!check || Number(check.anon_readable) !== 0
    || check.staff_password_readable !== false || Number(check.patient_password_columns) !== 0) {
    throw new Error('A verificação de privilégios falhou. Não conecte o aplicativo ao destino.');
  }
  console.log(JSON.stringify({
    targetRef: ref, installedTables: tables.length,
    schemaSha256: createHash('sha256').update(sql).digest('hex'),
    securityChecks: check, authUsers: after.auth_users, storageObjects: after.storage_objects,
  }));
  console.log('Estrutura instalada somente no destino. Nenhum dado foi transferido e a conexão atual permanece inalterada.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    // Own errors are sanitized; suppress unexpected fetch/SDK/OS details.
    console.error(error.constructor === Error
      ? error.message
      : 'Falha inesperada. Confira o destino; não altere a conexão do aplicativo.');
    process.exitCode = 1;
  });
}