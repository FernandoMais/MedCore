import tls from 'node:tls';
import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { smtpSettings } from './configure-auth-smtp.mjs';

// One optional test message to the sender, or an explicitly selected recipient.
// No Auth account is created and no password or recovery token is changed.
const settings = smtpSettings(process.env);
const recipientIndex = process.argv.indexOf('--recipient');
const recipient = recipientIndex < 0
  ? settings.smtp_admin_email : process.argv[recipientIndex + 1];
if (!recipient || !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(recipient)) {
  throw new Error('Informe um destinatário de teste válido.');
}
if (recipientIndex >= 0 && !process.argv.includes('--send-test')) {
  throw new Error('O destinatário de teste exige a opção --send-test.');
}
let socket = settings.smtp_port === '587'
  ? net.connect({ host: settings.smtp_host, port: 587 })
  : tls.connect({
      host: settings.smtp_host, port: 465,
      servername: settings.smtp_host, rejectUnauthorized: true,
    });
let buffer = '';
const replies = [];
let waiter = null;
let failure = null;
let rejectionHint = 'não especificado';
function fail() {
  failure = new Error('Não foi possível completar a conexão SMTP criptografada.');
  if (waiter) { waiter.reject(failure); waiter = null; }
  socket.destroy();
}
function receive(chunk) {
  buffer += chunk.toString('utf8');
  let end;
  while ((end = buffer.indexOf('\r\n')) >= 0) {
    const line = buffer.slice(0, end);
    buffer = buffer.slice(end + 2);
    // Do not store response text, which may include identities or challenges.
    if (/^\d{3} /.test(line)) {
      const code = Number(line.slice(0, 3));
      if (code >= 400) {
        if (/third.?party|external.*(?:disabled|not allowed|not enabled)/i.test(line)) {
          rejectionHint = 'acesso externo não permitido';
        } else if (/locked|suspended/i.test(line)) {
          rejectionHint = 'conta bloqueada';
        } else if (/too many|rate limit/i.test(line)) {
          rejectionHint = 'limite de tentativas';
        } else if (/authentication failed|invalid credentials|password.*not accepted/i.test(line)) {
          rejectionHint = 'credenciais não aceitas';
        }
      }
      if (waiter) { waiter.resolve(code); waiter = null; }
      else replies.push(code);
    }
  }
}
function bindSocket() {
  socket.setTimeout(20000);
  socket.on('error', fail);
  socket.on('timeout', fail);
  socket.on('close', () => { if (waiter) fail(); });
  socket.on('data', receive);
}
bindSocket();
async function expect(expected, command) {
  if (failure) throw failure;
  if (command) socket.write(`${command}\r\n`);
  const code = replies.length ? replies.shift()
    : await new Promise((resolve, reject) => { waiter = { resolve, reject }; });
  if (!expected.includes(code)) {
    throw new Error(`O servidor SMTP recusou a etapa (código ${code}; motivo: ${rejectionHint}).`);
  }
}
try {
  await expect([220]);
  await expect([250], 'EHLO medcorepro');
  if (settings.smtp_port === '587') {
    await expect([220], 'STARTTLS');
    const plain = socket;
    plain.removeAllListeners('data');
    plain.removeAllListeners('error');
    plain.removeAllListeners('timeout');
    plain.removeAllListeners('close');
    socket = tls.connect({
      socket: plain, servername: settings.smtp_host, rejectUnauthorized: true,
    });
    bindSocket();
    // Authentication happens only after a successful, verified TLS upgrade.
    await expect([250], 'EHLO medcorepro');
  }
  if (process.argv.includes('--plain')) {
    const credentials = Buffer.from(`\0${settings.smtp_user}\0${settings.smtp_pass}`).toString('base64');
    await expect([235], `AUTH PLAIN ${credentials}`);
  } else {
    await expect([334], 'AUTH LOGIN');
    await expect([334], Buffer.from(settings.smtp_user).toString('base64'));
    await expect([235], Buffer.from(settings.smtp_pass).toString('base64'));
  }
  let testMessageAccepted = false;
  if (process.argv.includes('--send-test')) {
    const backupAlert = process.argv.includes('--backup-alert-test');
    await expect([250], `MAIL FROM:<${settings.smtp_admin_email}>`);
    await expect([250, 251], `RCPT TO:<${recipient}>`);
    await expect([354], 'DATA');
    const content = [
      `From: <${settings.smtp_admin_email}>`, `To: <${recipient}>`,
      backupAlert ? 'Subject: Teste de alerta de backup - MedCore'
        : 'Subject: Teste de envio - Restaura Integral',
      `Message-ID: <${randomUUID()}@${settings.smtp_admin_email.split('@')[1]}>`,
      `Date: ${new Date().toUTCString()}`, 'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8', '',
      backupAlert ? 'Teste solicitado do canal de alertas de backup do MedCore.'
        : 'Teste de conexao SMTP para envio de convites do sistema.',
      ...(backupAlert ? [
        'Esta mensagem nao contem dados de pacientes.',
        'O recebimento deste teste nao significa que o backup automatico ja esta ativo.',
      ] : []),
      'Esta mensagem nao altera contas ou senhas e nao requer nenhuma acao.',
      '.', '',
    ].join('\r\n');
    socket.write(content);
    await expect([250]);
    testMessageAccepted = true;
  }
  await expect([221], 'QUIT');
  console.log(JSON.stringify({ smtpAuthenticated: true, testMessageAccepted }));
} catch (error) {
  console.error(error.constructor === Error ? error.message : 'O teste SMTP não foi concluído.');
  process.exitCode = 1;
} finally {
  socket.destroy();
}
