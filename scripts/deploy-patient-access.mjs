import { readFile } from 'node:fs/promises';
import { validateFreshConfiguration } from './setup-fresh-admin.mjs';

let stage = 'validar destino';
try {
  const { ref, clinic } = validateFreshConfiguration(process.env);
  if (ref !== 'zktvrcaeztmzmsdjcjsa') throw new Error('Destino não aprovado.');
  const origin = new URL(`https://${process.env.REPLIT_DEV_DOMAIN}`).origin;
  const api = `https://api.supabase.com/v1/projects/${ref}`;
  async function request(path, method = 'GET', body) {
    stage = `${method} ${path}`;
    const multipart = body instanceof FormData;
    const response = await fetch(`${api}${path}`, {
      method, redirect: 'error', signal: AbortSignal.timeout(120000),
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_MIGRATION_ACCESS_TOKEN}`,
        ...(!multipart ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: multipart ? body : JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw new Error(`Configuração do serviço respondeu HTTP ${response.status}.`);
    const text = await response.text();
    return text.trim() ? JSON.parse(text) : null;
  }
  const bound = await request('/database/query', 'POST', {
    read_only: true,
    query: `select count(*) as owners from public.users where "clinicId"='${clinic}' and role='admin' and "authUserId" is not null;`,
  });
  if (Number(bound?.[0]?.owners) !== 1) throw new Error('Revise o vínculo do administrador antes de ativar o serviço.');
  const config = await request('/config/auth');
  const trustedOrigins = new Set([origin]);
  if (config.site_url) {
    const site = new URL(config.site_url);
    if (site.protocol === 'https:' && !site.username && !site.password) trustedOrigins.add(site.origin);
  }
  await request('/secrets', 'POST', [
    { name: 'PATIENT_CLINIC_ID', value: clinic },
    { name: 'PATIENT_APP_ORIGINS', value: [...trustedOrigins].join(',') },
  ]);
  const redirects = new Set((config.uri_allow_list || '').split(',').filter(Boolean));
  redirects.add(`${origin}/**`);
  await request('/config/auth', 'PATCH', { uri_allow_list: [...redirects].join(',') });
  const form = new FormData();
  form.append('metadata', JSON.stringify({
    name: 'patient-access', entrypoint_path: 'index.ts', verify_jwt: false,
  }));
  form.append('file', new Blob([await readFile('supabase/functions/patient-access/index.ts', 'utf8')],
    { type: 'application/typescript' }), 'index.ts');
  const deployed = await request('/functions/deploy?slug=patient-access', 'POST', form);
  if (deployed.slug !== 'patient-access' || deployed.verify_jwt !== false) {
    throw new Error('A implantação precisa de revisão antes de liberar o cadastro.');
  }
  console.log(JSON.stringify({ deployed: deployed.slug, status: deployed.status,
    publicActionsEnabled: deployed.verify_jwt === false, trustedClinicConfigured: true,
    smtpConfigured: Boolean(config.smtp_host && config.smtp_user) }));
} catch (error) {
  console.error(error.constructor === Error ? error.message
    : `Falha na implantação (${stage}; ${error.name}). Nenhum segredo foi exibido.`);
  process.exitCode = 1;
}