import { pathToFileURL } from 'node:url';
import { validateFreshConfiguration } from './setup-fresh-admin.mjs';

export function recoveryTemplate(type = 'recovery') {
  if (!['recovery', 'invite'].includes(type)) throw new Error('Tipo de link inválido.');
  // Build the whole URL before putting it in href. html/template rejects a
  // token interpolation after branches with different URL/query contexts.
  return `{{ $callback := printf "%s/?staff-auth=recovery" .SiteURL }}{{ if and .RedirectTo (ne .RedirectTo .SiteURL) }}{{ $callback = .RedirectTo }}{{ end }}
<h2>Defina sua senha no MedCorePro</h2>
<p>Clique abaixo para abrir o aplicativo e escolher sua senha. O link é de uso único.</p>
<p><a href="{{ printf "%s&token_hash=%s&type=${type}" $callback .TokenHash }}">Definir nova senha</a></p>
<p>Se você não fez esta solicitação, ignore este e-mail.</p>`;
}

export function authLinkSettings(current, publishedUrl, developmentOrigin) {
  const url = new URL(publishedUrl);
  if (url.protocol !== 'https:' || url.username || url.password || url.search
    || url.hash || url.pathname !== '/' || url.hostname.endsWith('.replit.dev')
    || ['localhost', '127.0.0.1'].includes(url.hostname)) {
    throw new Error('Use a URL publicada confirmada, sem parâmetros ou caminhos.');
  }
  const origins = new Set([url.origin, developmentOrigin]);
  const redirects = new Set((current.uri_allow_list || '').split(',').filter(Boolean));
  for (const origin of origins) {
    for (const query of ['staff-auth=recovery', 'patient-auth=recovery', 'patient-auth=confirm']) {
      redirects.add(`${origin}/?${query}`);
    }
  }
  const settings = {
    site_url: url.origin,
    uri_allow_list: [...redirects].join(','),
  };
  // Supabase's free default mail provider rejects ALL settings in a PATCH
  // containing customized email templates. Native recovery links are supported
  // by the staff screen, so fix redirects without requiring a mail-plan change.
  if (current.smtp_host && current.smtp_user) {
    Object.assign(settings, {
      mailer_subjects_recovery: 'Redefinir sua senha — MedCorePro',
      mailer_templates_recovery_content: recoveryTemplate(),
      mailer_templates_invite_content: recoveryTemplate('invite'),
    });
  }
  return settings;
}

async function main() {
  const { ref } = validateFreshConfiguration(process.env);
  if (ref !== 'zktvrcaeztmzmsdjcjsa') throw new Error('Destino não aprovado.');
  const developmentOrigin = new URL(`https://${process.env.REPLIT_DEV_DOMAIN}`).origin;
  const api = `https://api.supabase.com/v1/projects/${ref}`;
  async function request(path, method = 'GET', body) {
    const response = await fetch(`${api}${path}`, {
      method, redirect: 'error', signal: AbortSignal.timeout(45000),
      headers: { Authorization: `Bearer ${process.env.SUPABASE_MIGRATION_ACCESS_TOKEN}`,
        'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw new Error(`Configuração respondeu HTTP ${response.status}.`);
    const text = await response.text();
    return text.trim() ? JSON.parse(text) : null;
  }
  const settings = authLinkSettings(await request('/config/auth'), process.argv[2], developmentOrigin);
  await request('/config/auth', 'PATCH', settings);
  // Patient confirmation/recovery shares Auth templates but retains its own
  // session and clinic authorization. Both app origins must remain trusted.
  await request('/secrets', 'POST', [{ name: 'PATIENT_APP_ORIGINS',
    value: [settings.site_url, developmentOrigin].join(',') }]);
  const saved = await request('/config/auth');
  if (saved.site_url !== settings.site_url || saved.uri_allow_list !== settings.uri_allow_list
    || (settings.mailer_templates_recovery_content
      && saved.mailer_templates_recovery_content !== settings.mailer_templates_recovery_content)) {
    throw new Error('A configuração gravada precisa de revisão.');
  }
  console.log(JSON.stringify({ siteUrl: saved.site_url, publishedRedirectsConfigured: true,
    customizedTemplatesApplied: Boolean(settings.mailer_templates_recovery_content),
    separatePatientRedirectPreserved: true }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error.constructor === Error ? error.message : 'Não foi possível configurar os links.');
    process.exitCode = 1;
  });
}
