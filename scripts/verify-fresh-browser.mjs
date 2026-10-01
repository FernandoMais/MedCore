import { chromium } from 'playwright';
import assert from 'node:assert/strict';

// Run once during initial setup, not against an already populated clinic.
// Uses a separate browser context; credentials and auth tokens are never printed.
let browser;
let stage = 'abrir navegador';
try {
  browser = await chromium.launch({
    executablePath: '/repl/tools/bin/chromium',
    headless: true, args: ['--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  let oldRequests = 0;
  page.on('response', async response => {
    if (response.status() >= 400 && new URL(response.url()).hostname.endsWith('.supabase.co')) {
      const body = await response.json().catch(() => ({}));
      console.log(JSON.stringify({ failedPath: new URL(response.url()).pathname,
        status: response.status(), errorCode: body.code || null }));
    }
  });
  page.on('request', req => {
    if (req.url().includes('fddyuaotpplsnocgvhby.supabase.co')) oldRequests++;
  });
  stage = 'abrir aplicação';
  await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.setItem('medcore_pro_db_v3',
    JSON.stringify({ patients: [{ id: 'legacy-fixture', name: 'Legacy fixture' }],
      users: [], doctors: [], appointments: [] })));
  await page.reload({ waitUntil: 'networkidle' });
  stage = 'login autenticado';
  await page.getByRole('button', { name: /acesso profissional/i }).click();
  await page.getByPlaceholder('Seu e-mail cadastrado', { exact: true }).fill(process.env.INITIAL_ADMIN_EMAIL);
  await page.getByPlaceholder('••••••••', { exact: true }).fill(process.env.INITIAL_ADMIN_PASSWORD);
  await page.getByRole('button', { name: /acessar plataforma/i }).click();
  await page.getByRole('heading', { name: 'Painel de Controle', exact: true }).waitFor({ timeout: 25000 });
  await page.getByText('Cloud Online', { exact: true }).waitFor({ state: 'visible', timeout: 45000 });
  stage = 'conferir instalação vazia e sincronização';
  const checks = await page.evaluate(() => {
    const freshKey = Object.keys(localStorage).find(k => k.startsWith('medcore_pro_fresh_'));
    const db = freshKey ? JSON.parse(localStorage.getItem(freshKey)) : null;
    return {
      legacyPreserved: JSON.parse(localStorage.getItem('medcore_pro_db_v3')).patients[0].id === 'legacy-fixture',
      counts: db ? Object.fromEntries(['patients', 'doctors', 'appointments', 'medicalRecords', 'medications', 'sigilousNotes']
        .map(k => [k, db[k].length])) : null,
      staffCount: db?.users.length,
      plaintextPasswords: db?.users.some(u => Boolean(u.password || u.senhaAcesso)),
      financial: db ? Object.fromEntries(Object.entries(db.financial)
        .filter(([k]) => k !== 'settings').map(([k, v]) => [k, v.length])) : null,
      online: document.body.textContent.includes('Cloud Online'),
      syncing: document.body.textContent.includes('Salvando...'),
      offline: document.body.textContent.includes('Cloud Offline'),
      demoClaims: ['452', 'João Silva', 'Backup Concluído'].some(s => document.body.innerText.includes(s)),
    };
  });
  console.log(JSON.stringify({ stage, ...checks, oldProjectRequests: oldRequests }));
  await page.evaluate(() => {
    for (const element of document.querySelectorAll('*')) {
      if (!element.children.length && /[^\s@]+@[^\s@]+\.[^\s@]+/.test(element.textContent || '')) {
        element.textContent = '[e-mail oculto]';
      }
    }
  });
  await page.screenshot({ path: '/tmp/fresh-admin-dashboard.jpg', fullPage: true });
  assert.ok(checks.counts); assert.ok(checks.online); assert.ok(checks.legacyPreserved);
  assert.equal(checks.staffCount, 1); assert.equal(checks.plaintextPasswords, false);
  assert.equal(checks.demoClaims, false); assert.equal(oldRequests, 0);
  for (const value of [...Object.values(checks.counts), ...Object.values(checks.financial)]) assert.equal(value, 0);
  // Redact any email-like text before retaining a temporary screenshot.
  await page.evaluate(() => {
    for (const element of document.querySelectorAll('*')) {
      if (!element.children.length && /[^\s@]+@[^\s@]+\.[^\s@]+/.test(element.textContent || '')) {
        element.textContent = '[e-mail oculto]';
      }
    }
  });
  await page.screenshot({ path: '/tmp/fresh-admin-dashboard.jpg', fullPage: true });
  console.log(JSON.stringify({ authenticatedDashboardVerified: true, ...checks, oldProjectRequests: oldRequests }));
  await page.getByRole('button', { name: /^sair$/i }).click();
  await page.waitForTimeout(1800);
  console.log('Logout executado no navegador de teste.');
} catch {
  console.error(`Verificação do navegador falhou na etapa: ${stage}. Nenhuma credencial foi exibida.`);
  process.exitCode = 1;
} finally {
  await browser?.close();
}