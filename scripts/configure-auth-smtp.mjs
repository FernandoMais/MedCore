import { pathToFileURL } from 'node:url';
import { validateFreshConfiguration } from './setup-fresh-admin.mjs';

export function smtpSettings(env) {
  const email = (env.SMTP_FROM_EMAIL || '').trim();
  if (env.SMTP_HOST !== 'smtp.titan.email' || !['465', '587'].includes(env.SMTP_PORT)) {
    throw new Error('Use o servidor Titan aprovado com TLS na porta 465 ou STARTTLS na porta 587.');
  }
  if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(email)) {
    throw new Error('Configure um endereço de remetente válido.');
  }
  if (!env.SMTP_PASSWORD) throw new Error('A senha SMTP não foi disponibilizada.');
  const name = (env.SMTP_SENDER_NAME || '').trim();
  if (!name || /[\r\n]/.test(name)) throw new Error('Configure o nome do remetente.');
  return {
    external_email_enabled: true,
    mailer_autoconfirm: false,
    rate_limit_email_sent: 30,
    smtp_max_frequency: 60,
    smtp_admin_email: email,
    smtp_host: env.SMTP_HOST,
    // The current Management API schema requires a string, not a JSON number.
    smtp_port: env.SMTP_PORT,
    smtp_user: email,
    smtp_pass: env.SMTP_PASSWORD,
    smtp_sender_name: name,
  };
}

async function main() {
  const { ref } = validateFreshConfiguration(process.env);
  if (ref !== 'zktvrcaeztmzmsdjcjsa') throw new Error('Destino não aprovado.');
  const settings = smtpSettings(process.env);
  const endpoint = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
  async function request(method, body) {
    const response = await fetch(endpoint, {
      method, redirect: 'error', signal: AbortSignal.timeout(45000),
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_MIGRATION_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw new Error(`Configuração SMTP respondeu HTTP ${response.status}.`);
    return response.json();
  }
  // Configure the transport separately: the default provider refuses custom
  // templates until a custom SMTP provider has already been saved.
  await request('PATCH', settings);
  const saved = await request('GET');
  for (const key of ['smtp_admin_email', 'smtp_host', 'smtp_user', 'smtp_sender_name']) {
    if (saved[key] !== settings[key]) throw new Error('A configuração SMTP gravada precisa de revisão.');
  }
  if (String(saved.smtp_port) !== settings.smtp_port || saved.mailer_autoconfirm !== false) {
    throw new Error('Revise a porta SMTP e a confirmação obrigatória de e-mail.');
  }
  if (saved.rate_limit_email_sent !== 30 || saved.smtp_max_frequency !== 60) {
    throw new Error('Revise os limites de envio de e-mail.');
  }
  // Do not output the API response: it can contain SMTP credentials.
  console.log(JSON.stringify({
    smtpConfigured: true, encryptedPort: Number(settings.smtp_port), emailConfirmationRequired: true,
  }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error.constructor === Error ? error.message : 'Não foi possível configurar o SMTP.');
    process.exitCode = 1;
  });
}
