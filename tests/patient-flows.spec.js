import { expect, test } from '@playwright/test';
import { patientAuthModule } from './support/patient-auth-mock.js';

function cpfFromPrefix(prefix) {
  const digit = digits => {
    const sum = [...digits].reduce(
      (total, value, index) => total + Number(value) * (digits.length + 1 - index),
      0,
    );
    return String((sum * 10) % 11 % 10);
  };
  const firstTen = prefix + digit(prefix);
  return firstTen + digit(firstTen);
}

const validCpf = cpfFromPrefix('741852963');
const invalidCpf = validCpf.slice(0, 10) + (Number(validCpf[10]) + 1) % 10;
const recoveryUrl = '/?patient-auth=recovery&type=recovery&token_hash=fake-otp';

test.beforeEach(async ({ page, baseURL }) => {
  const appOrigin = new URL(baseURL).origin;
  await page.addInitScript(() => {
    window.__patientAuthMock = {
      calls: [],
      verifyOtpCalls: [],
      loginMode: 'success',
      recoveryValid: true,
      registerError: '',
      recoveryError: '',
    };
  });
  // Replace the app's patient-auth module with an isolated local fake. No real
  // Supabase request or email operation is allowed in these browser tests.
  await page.route('**/*', route => {
    if (new URL(route.request().url()).origin !== appOrigin) return route.abort();
    return route.continue();
  });
  await page.route(/\/services\/patientAuth\.ts(?:\?.*)?$/, route => route.fulfill({
    status: 200,
    contentType: 'application/javascript; charset=utf-8',
    body: patientAuthModule,
  }));
});

async function goToPatientLogin(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Área do Paciente' }).click();
  await expect(page.getByRole('heading', { name: 'Área do Paciente' })).toBeVisible();
}

async function fillRegistration(page, cpf = validCpf, password = 'Teste-seguro-123') {
  await page.getByPlaceholder('Como consta no documento').fill('Paciente de Teste');
  await page.getByPlaceholder('000.000.000-00').fill(cpf);
  await page.locator('input[type="date"]').fill('1990-01-02');
  await page.getByPlaceholder('seu@email.com').fill('patient@example.test');
  await page.getByPlaceholder('(00) 00000-0000').fill('11987654321');
  await page.getByPlaceholder('Ex: Av. Paulista').fill('Rua de Teste');
  await page.getByPlaceholder('Ex: 1234').fill('123');
  await page.getByPlaceholder('Ex: Centro').fill('Bairro de Teste');
  await page.getByPlaceholder('Ex: São Paulo').fill('Cidade de Teste');
  await page.getByPlaceholder('00000-000', { exact: true }).fill('12345678');
  await page.locator('#patient-register-password').fill(password);
  await page.locator('#patient-register-password-confirm').fill(password);
}

test('home navigation reaches patient signup/login/recovery, professional login and confirmation callback', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Fazer meu Cadastro' }).click();
  await expect(page.getByRole('heading', { name: 'Faça seu Cadastro' })).toBeVisible();
  await page.getByRole('button', { name: 'Voltar à página inicial' }).first().click();
  await expect(page.getByRole('button', { name: 'Área do Paciente' })).toBeVisible();

  await goToPatientLogin(page);
  await page.getByRole('button', { name: 'Esqueceu sua senha?' }).click();
  await expect(page.getByRole('heading', { name: 'Recuperar senha' })).toBeVisible();
  await page.getByRole('button', { name: 'Voltar ao login' }).click();
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  await page.getByRole('button', { name: 'Voltar à página inicial' }).click();
  await page.getByRole('button', { name: 'Acesso Profissional' }).click();
  await expect(page.getByPlaceholder('Seu e-mail cadastrado')).toBeVisible();

  await page.goto('/?patient-auth=confirm');
  await expect(page.getByRole('heading', { name: 'Acesso do paciente' })).toBeVisible();
  await page.getByRole('button', { name: 'Voltar à página inicial' }).click();
  await expect(page.getByRole('button', { name: 'Fazer meu Cadastro' })).toBeVisible();
});

test('signup validates CPF and password confirmation, then preserves and submits every registration field', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Fazer meu Cadastro' }).click();
  await fillRegistration(page, invalidCpf);
  await page.getByRole('button', { name: 'Confirmar Cadastro' }).click();
  await expect(page.getByText('Informe um CPF brasileiro válido.')).toBeVisible();
  expect(await page.evaluate(() => window.__patientAuthMock.calls)).toEqual([]);

  await page.getByPlaceholder('000.000.000-00').fill(validCpf);
  await page.locator('#patient-register-password-confirm').fill('Senhadiferente123');
  await page.getByRole('button', { name: 'Confirmar Cadastro' }).click();
  await expect(page.getByText('As senhas não coincidem.')).toBeVisible();
  expect(await page.evaluate(() => window.__patientAuthMock.calls)).toEqual([]);

  await page.locator('#patient-register-password-confirm').fill('Teste-seguro-123');
  await page.getByRole('button', { name: 'Confirmar Cadastro' }).click();
  await expect(page.getByRole('heading', { name: 'Cadastro Realizado!' })).toBeVisible();
  const calls = await page.evaluate(() => window.__patientAuthMock.calls);
  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatchObject({
    function: 'registerPatient',
    password: 'Teste-seguro-123',
    patient: {
      name: 'Paciente de Teste',
      cpf: validCpf,
      birthDate: '1990-01-02',
      email: 'patient@example.test',
      phone: '(11) 98765-4321',
      streetName: 'Rua de Teste',
      streetNumber: '123',
      neighborhood: 'Bairro de Teste',
      city: 'Cidade de Teste',
      zipCode: '12345-678',
    },
  });
  expect(calls[0].patient).not.toHaveProperty('paymentValue');
  expect(calls[0].patient).not.toHaveProperty('paymentSender');
});

test('signup keeps entered fields visible when the registration service fails', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Fazer meu Cadastro' }).click();
  await fillRegistration(page);
  await page.evaluate(() => { window.__patientAuthMock.registerError = 'Falha simulada no cadastro.'; });
  await page.getByRole('button', { name: 'Confirmar Cadastro' }).click();
  await expect(page.getByText('Falha simulada no cadastro.')).toBeVisible();
  await expect(page.getByPlaceholder('Como consta no documento')).toHaveValue('Paciente de Teste');
  await expect(page.locator('#patient-register-password')).toHaveValue('Teste-seguro-123');
  await expect(page.locator('#patient-register-password-confirm')).toHaveValue('Teste-seguro-123');
});

test('login rejects invalid CPF locally and displays the pending-email response for a valid CPF', async ({ page }) => {
  await goToPatientLogin(page);
  await page.locator('#patient-login-cpf').fill(invalidCpf);
  await page.locator('#patient-login-password').fill('Senha-ficticia-123');
  await page.getByRole('button', { name: 'Acessar Minha Área' }).click();
  await expect(page.getByText('Informe um CPF brasileiro válido.')).toBeVisible();
  expect(await page.evaluate(() => window.__patientAuthMock.calls)).toEqual([]);

  await page.locator('#patient-login-cpf').fill(validCpf);
  await page.evaluate(() => { window.__patientAuthMock.loginMode = 'pending'; });
  await page.getByRole('button', { name: 'Acessar Minha Área' }).click();
  await expect(page.getByText('Confirme seu e-mail antes de entrar.')).toBeVisible();
  expect(await page.evaluate(() => window.__patientAuthMock.calls)).toEqual([
    { function: 'loginPatient', cpf: validCpf, password: 'Senha-ficticia-123' },
  ]);
});

test('patient recovery shows the same generic success and calls the mocked recovery service', async ({ page }) => {
  await goToPatientLogin(page);
  await page.getByRole('button', { name: 'Esqueceu sua senha?' }).click();
  await page.locator('#patient-recovery-cpf').fill(validCpf);
  await page.getByRole('button', { name: 'Enviar link de recuperação' }).click();
  await expect(page.getByRole('heading', { name: 'Solicitação enviada' })).toBeVisible();
  await expect(page.getByText(/Se houver uma conta associada ao CPF informado/)).toBeVisible();
  expect(await page.evaluate(() => window.__patientAuthMock.calls)).toEqual([
    { function: 'requestPatientRecovery', cpf: validCpf },
  ]);
});

test('recovery callback rejects expired links and accepts matching passwords only', async ({ page }) => {
  await page.goto('/?patient-auth=recovery&type=recovery&token_hash=expired-otp');
  await expect(page.getByRole('heading', { name: 'Link inválido ou expirado' })).toBeVisible();

  await page.goto('/?patient-auth=recovery#access_token=forged-access&refresh_token=forged-refresh&type=recovery');
  await expect(page.getByRole('heading', { name: 'Link inválido ou expirado' })).toBeVisible();
  expect(await page.evaluate(() => window.__patientAuthMock.verifyOtpCalls)).toEqual([]);

  await page.goto(recoveryUrl);
  await expect(page.getByRole('heading', { name: 'Crie uma nova senha' })).toBeVisible();
  await page.locator('#patient-reset-password').fill('Nova-senha-ficticia-123');
  await page.locator('#patient-reset-confirm').fill('Senha-que-nao-bate');
  await page.getByRole('button', { name: 'Salvar nova senha' }).click();
  await expect(page.getByText('As senhas não coincidem.')).toBeVisible();
  expect(await page.evaluate(() => window.__patientAuthMock.calls)).toEqual([]);

  await page.locator('#patient-reset-confirm').fill('Nova-senha-ficticia-123');
  await page.getByRole('button', { name: 'Salvar nova senha' }).click();
  await expect(page.getByRole('heading', { name: 'Senha redefinida' })).toBeVisible();
  expect(await page.evaluate(() => window.__patientAuthMock.calls)).toEqual([
    { function: 'updatePatientPassword', password: 'Nova-senha-ficticia-123' },
  ]);
  expect(await page.evaluate(() => window.__patientAuthMock.verifyOtpCalls)).toEqual([
    { token_hash: 'fake-otp', type: 'recovery' },
  ]);
});

test('failed booking keeps the selected date, doctor, time and appointment type available for retry', async ({ page }) => {
  await goToPatientLogin(page);
  await page.locator('#patient-login-cpf').fill(validCpf);
  await page.locator('#patient-login-password').fill('Senha-ficticia-123');
  await page.getByRole('button', { name: 'Acessar Minha Área' }).click();
  await expect(page.getByRole('button', { name: 'Agendar Consulta' })).toBeVisible();
  await page.getByRole('button', { name: 'Agendar Consulta' }).click();

  const future = new Date();
  future.setDate(future.getDate() + 2);
  const dateValue = [
    future.getFullYear(),
    String(future.getMonth() + 1).padStart(2, '0'),
    String(future.getDate()).padStart(2, '0'),
  ].join('-');
  const dateInput = page.locator('input[type="date"]');
  await dateInput.fill(dateValue);
  await page.getByRole('button', { name: '10:00', exact: true }).click();
  await page.getByRole('button', { name: 'Retorno', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar Agendamento' }).click();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();

  await expect(page.getByRole('alert')).toContainText('Não foi possível confirmar o agendamento.');
  await expect(page.getByRole('heading', { name: 'Confirmar Agendamento?' })).toBeVisible();
  await expect(dateInput).toHaveValue(dateValue);
  await expect(page.getByRole('button', { name: '10:00', exact: true })).toBeVisible();
  await expect(page.getByText('Retorno', { exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => window.__patientAuthMock.calls.map(call => call.function))).toEqual([
    'loginPatient',
    'bookPatientAppointment',
  ]);
});