import test from 'node:test';
import assert from 'node:assert/strict';
import { smtpSettings } from '../scripts/configure-auth-smtp.mjs';

const env = {
  SMTP_HOST: 'smtp.titan.email', SMTP_PORT: '465',
  SMTP_FROM_EMAIL: 'clinic@example.invalid', SMTP_SENDER_NAME: 'Clinic',
  SMTP_PASSWORD: 'test-placeholder-not-a-real-credential',
};

test('Titan SMTP requires TLS and retains mandatory email confirmation', () => {
  const settings = smtpSettings(env);
  assert.equal(settings.smtp_port, '465');
  assert.equal(settings.smtp_host, 'smtp.titan.email');
  assert.equal(settings.smtp_user, env.SMTP_FROM_EMAIL);
  assert.equal(settings.smtp_admin_email, env.SMTP_FROM_EMAIL);
  assert.equal(settings.smtp_pass, env.SMTP_PASSWORD);
  assert.equal(settings.mailer_autoconfirm, false);
  assert.equal(settings.rate_limit_email_sent, 30);
  assert.equal(settings.smtp_max_frequency, 60);
});

test('missing credentials and unsafe sender values fail explicitly', () => {
  for (const change of [
    { SMTP_PASSWORD: '' }, { SMTP_HOST: 'localhost' }, { SMTP_PORT: '25' },
    { SMTP_FROM_EMAIL: 'invalid' }, { SMTP_FROM_EMAIL: 'x@example.invalid\r\nBcc:y@example.invalid' },
    { SMTP_SENDER_NAME: 'Clinic\r\nInjected' },
  ]) {
    assert.throws(() => smtpSettings({ ...env, ...change }));
  }
});

test('Titan also supports the verified STARTTLS port for hosted Auth delivery', () => {
  assert.equal(smtpSettings({ ...env, SMTP_PORT: '587' }).smtp_port, '587');
});
