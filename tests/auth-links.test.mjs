import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authLinkSettings, recoveryTemplate } from '../scripts/configure-auth-links.mjs';

const published = 'https://fixture.replit.app';
const dev = 'https://fixture.replit.dev';
test('Auth uses published site and allows staff and patient callbacks without losing existing redirects', () => {
  const settings = authLinkSettings({ uri_allow_list: `${dev}/**` }, published, dev);
  assert.equal(settings.site_url, published);
  const urls = settings.uri_allow_list.split(',');
  assert.ok(urls.includes(`${dev}/**`));
  for (const origin of [published, dev]) {
    for (const query of ['staff-auth=recovery', 'patient-auth=recovery', 'patient-auth=confirm']) {
      assert.ok(urls.includes(`${origin}/?${query}`));
    }
  }
  assert.ok(!Object.hasOwn(settings, 'mailer_autoconfirm'));
  assert.ok(!Object.hasOwn(settings, 'mailer_templates_recovery_content'));
});
test('SMTP projects can apply direct-token templates but default-provider projects remain configurable', () => {
  const settings = authLinkSettings({ smtp_host: 'fixture.smtp.test', smtp_user: 'fixture' }, published, dev);
  assert.equal(settings.mailer_templates_recovery_content, recoveryTemplate());
  assert.equal(settings.mailer_templates_invite_content, recoveryTemplate('invite'));
});
test('recovery and invitation send token hashes to the requested isolated flow, with staff fallback', () => {
  for (const type of ['recovery', 'invite']) {
    const template = recoveryTemplate(type);
    assert.ok(template.includes('{{ .RedirectTo }}'));
    assert.ok(template.includes('{{ .TokenHash }}'));
    assert.ok(template.includes(`type=${type}`));
    assert.ok(template.includes('staff-auth=recovery'));
    assert.ok(!template.includes('.ConfirmationURL'));
    assert.ok(!template.includes('localhost'));
  }
});
test('configuration refuses local, development, non-HTTPS and credential-bearing canonical URLs', () => {
  for (const url of ['http://localhost:3000', dev, `${published}/path`,
    `${published}/?token_hash=fixture`, 'https://user:password@fixture.replit.app']) {
    assert.throws(() => authLinkSettings({}, url, dev));
  }
});
