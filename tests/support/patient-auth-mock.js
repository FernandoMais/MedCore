export const patientAuthModule = `
const state = window.__patientAuthMock;
let recoveryVerification;
const normalizeCpf = value => String(value).replace(/\\D/g, '');
const isValidCpf = value => {
  const cpf = normalizeCpf(value);
  if (cpf.length !== 11 || /^(\\d)\\1{10}$/.test(cpf)) return false;
  for (let size = 9; size <= 10; size++) {
    let sum = 0;
    for (let i = 0; i < size; i++) sum += Number(cpf[i]) * (size + 1 - i);
    if ((sum * 10) % 11 % 10 !== Number(cpf[size])) return false;
  }
  return true;
};
const isValidPatientPassword = password => password.length >= 8 && password.length <= 128;
const patient = {
  id: 'fixture-patient-id',
  name: 'Paciente Teste',
  cpf: '74185296355',
  email: 'patient@example.test',
  clinicId: 'fixture-clinic',
  primaryDoctorId: 'fixture-doctor',
};
const doctor = {
  id: 'fixture-doctor',
  name: 'Dra. Teste',
  crm: 'CRM-FICTICIO',
  specialty: 'Clínica geral',
  clinicId: 'fixture-clinic',
  availableTimes: [],
};
export { isValidCpf, isValidPatientPassword, normalizeCpf };
export const registerPatient = async (patientData, password) => {
  state.calls.push({ function: 'registerPatient', patient: structuredClone(patientData), password });
  if (state.registerError) throw new Error(state.registerError);
  return { confirmationEmailSent: true };
};
export const loginPatient = async (cpf, password) => {
  state.calls.push({ function: 'loginPatient', cpf, password });
  if (state.loginMode === 'pending') throw new Error('Confirme seu e-mail antes de entrar.');
  if (state.loginMode === 'error') throw new Error('Não foi possível autenticar. Confira CPF, senha e confirmação do e-mail.');
  return patient;
};
export const requestPatientRecovery = async cpf => {
  state.calls.push({ function: 'requestPatientRecovery', cpf });
  if (state.recoveryError) throw new Error(state.recoveryError);
};
export const requestAdminPatientReset = async patientId => {
  state.calls.push({ function: 'requestAdminPatientReset', patientId });
};
export const getPatientRecoverySession = async () => {
  if (!recoveryVerification) {
    const query = new URLSearchParams(location.search);
    const tokenHash = query.get('token_hash');
    const type = query.get('type');
    const validCallback = query.get('patient-auth') === 'recovery'
      && Boolean(tokenHash)
      && ['recovery', 'invite'].includes(type)
      && !query.has('error');
    if (!validCallback) return false;
    state.verifyOtpCalls.push({ token_hash: tokenHash, type });
    recoveryVerification = Promise.resolve(state.recoveryValid && tokenHash !== 'expired-otp');
  }
  return recoveryVerification;
};
export const updatePatientPassword = async password => {
  state.calls.push({ function: 'updatePatientPassword', password });
  if (!state.recoveryValid) throw new Error('Este link é inválido ou expirou. Solicite um novo link.');
};
export const logoutPatient = async () => {};
export const loadPatientPortal = async () => ({ doctors: [doctor], appointments: [] });
export const bookPatientAppointment = async (patientData, appointment) => {
  state.calls.push({ function: 'bookPatientAppointment', appointment: structuredClone(appointment) });
  throw new Error('Não foi possível confirmar o agendamento. Confira a data e tente novamente.');
};
export const isPatientRecoveryPage = () => new URLSearchParams(location.search).get('patient-auth') === 'recovery';
export const isPatientConfirmationPage = () => new URLSearchParams(location.search).get('patient-auth') === 'confirm';
export const clearPatientCallbackUrl = () => {
  const url = new URL(location.href);
  url.searchParams.delete('patient-auth');
  url.hash = '';
  history.replaceState({}, '', url);
};
`;