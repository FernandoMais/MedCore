// Target-only operator tool. Secrets stay in process memory, never in output/files.
import { createClient } from '@supabase/supabase-js';
import { pathToFileURL } from 'node:url';

const TABLES = [
  'users', 'doctors', 'patients', 'appointments', 'medications',
  'evolucao_paciente', 'sigilous_notes', 'financial_transactions',
  'financial_categories', 'financial_cost_centers', 'financial_payment_methods',
  'financial_bank_accounts', 'financial_insurance_plans', 'financial_repasses',
  'financial_cash_closures', 'financial_reconciliations', 'financial_billing_records',
  'financial_settings', 'patient_access_enrollments', 'patient_access_rate_limits',
];

export function validateFreshConfiguration(env, apply = false) {
  const ref = env.VITE_FRESH_TARGET_REF;
  const clinic = env.VITE_CLINIC_ID;
  if (env.VITE_FRESH_START !== 'true' || !/^[a-z0-9]{20}$/.test(ref || '')
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clinic || '')) {
    throw new Error('Configure o projeto novo e a clínica da instalação limpa antes de continuar.');
  }
  if (!env.SUPABASE_MIGRATION_ACCESS_TOKEN) {
    throw new Error('O acesso administrativo precisa ser configurado pelo formulário seguro.');
  }
  if (apply) {
    if (env.VITE_SUPABASE_URL?.replace(/\/$/, '') !== `https://${ref}.supabase.co`
      || !env.VITE_SUPABASE_ANON_KEY) {
      throw new Error('A conexão do aplicativo ainda não aponta para o projeto novo confirmado.');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.INITIAL_ADMIN_EMAIL?.trim() || '')
      || (env.INITIAL_ADMIN_PASSWORD?.length || 0) < 12
      || env.INITIAL_ADMIN_PASSWORD.length > 128) {
      throw new Error('Informe o e-mail e uma nova senha do administrador com 12 a 128 caracteres no formulário seguro.');
    }
  }
  return { ref, clinic };
}

export function requireFreshInventory(result) {
  if (!result || Number(result.application_rows) !== 0 || Number(result.auth_users) !== 0
    || Number(result.storage_objects) !== 0 || Number(result.rls_tables) !== TABLES.length) {
    throw new Error('O destino não está vazio/protegido como esperado. Nenhuma conta será criada; revise o inventário.');
  }
}

async function main() {
  const apply = process.argv[2] === '--apply-admin';
  if (process.argv.length !== 3 || !['--check', '--apply-admin'].includes(process.argv[2])) {
    throw new Error('Use --check ou --apply-admin. O aplicativo antigo não é alterado.');
  }
  const env = process.env;
  const { ref, clinic } = validateFreshConfiguration(env, apply);
  const targetUrl = `https://${ref}.supabase.co`;
  async function management(path, payload) {
    const response = await fetch(`https://api.supabase.com/v1/projects/${ref}${path}`, {
      method: payload ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${env.SUPABASE_MIGRATION_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
      redirect: 'error', signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) throw new Error(`Supabase respondeu HTTP ${response.status}. Confira a autorização do destino.`);
    return response.json();
  }
  const project = await management('');
  if (project.id !== ref || project.status !== 'ACTIVE_HEALTHY') {
    throw new Error('O destino confirmado não está ativo e saudável.');
  }
  const inventory = (await management('/database/query', {
    read_only: true,
    query: `select
      ${TABLES.map(table => `(select count(*) from public.${table})`).join(' + ')} as application_rows,
      (select count(*) from auth.users) as auth_users,
      (select count(*) from storage.objects) as storage_objects,
      (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='public' and c.relrowsecurity and c.relname=any(array[${TABLES.map(t => `'${t}'`).join(',')}])) as rls_tables;`,
  }))?.[0];
  requireFreshInventory(inventory);
  console.log(JSON.stringify({ target: ref, inventory, applied: false }));
  if (!apply) return;

  // Check the client key against the intended host before creating any account.
  const settings = await fetch(`${targetUrl}/auth/v1/settings`, {
    headers: { apikey: env.VITE_SUPABASE_ANON_KEY },
    redirect: 'error', signal: AbortSignal.timeout(30000),
  });
  if (!settings.ok) throw new Error('A chave pública fornecida não autentica no projeto novo.');
  const keys = await management('/api-keys?reveal=true');
  const serviceKey = keys.find(key => key.name === 'service_role' && key.type === 'legacy')?.api_key;
  if (!serviceKey) throw new Error('A chave de serviço legada do destino não está disponível para o operador.');
  const admin = createClient(targetUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  // Trusted operator provisions the single owner; no anonymous self-admin signup.
  const created = await admin.auth.admin.createUser({
    email: env.INITIAL_ADMIN_EMAIL.trim().toLowerCase(),
    password: env.INITIAL_ADMIN_PASSWORD,
    email_confirm: true,
  });
  if (created.error || !created.data.user?.id) {
    throw new Error('Não foi possível criar a conta inicial no Auth. Confira a política de senha e a configuração do destino.');
  }
  const id = created.data.user.id;
  const profile = await admin.from('users').insert({
    id, authUserId: id, clinicId: clinic,
    username: env.INITIAL_ADMIN_EMAIL.trim().toLowerCase(),
    name: 'Administrador', role: 'admin', password: '',
  });
  if (profile.error) {
    const rollback = await admin.auth.admin.deleteUser(id);
    throw new Error(rollback.error
      ? 'O vínculo falhou e a reversão da conta precisa de revisão manual no destino.'
      : 'O vínculo falhou; somente a conta recém-criada foi revertida. Nenhum registro antigo foi alterado.');
  }
  // Validate actual login and the database-provided staff binding, not local state.
  const client = createClient(targetUrl, env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const signedIn = await client.auth.signInWithPassword({
    email: env.INITIAL_ADMIN_EMAIL.trim().toLowerCase(), password: env.INITIAL_ADMIN_PASSWORD,
  });
  const binding = signedIn.error ? null : await client.rpc('bind_current_user');
  const deniedPasswords = await client.from('users').select('password').limit(1);
  await client.auth.signOut();
  if (signedIn.error || binding?.error || binding?.data !== clinic || !deniedPasswords.error) {
    throw new Error('A conta foi criada, mas a validação de login/permissões requer revisão. Não repita o bootstrap.');
  }
  console.log('Administrador autenticado e vinculado à nova clínica. Nenhum dado antigo foi importado; senhas internas não são legíveis pelo cliente.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error.constructor === Error ? error.message : 'Falha inesperada. Nenhum segredo foi exibido; revise o destino.');
    process.exitCode = 1;
  });
}