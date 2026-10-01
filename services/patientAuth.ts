/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';
import { Appointment, AppointmentStatus, Doctor, Patient } from '../types';
import { isSupabaseConfigured, supabase } from './supabase';
import { freshStartEnabled, freshTargetRef, freshClinicId } from './freshStart';
import { isValidCpf, isValidPatientPassword, normalizeCpf, removeLegacyPatientPassword } from './patientCredentials';

export { isValidCpf, isValidPatientPassword, normalizeCpf } from './patientCredentials';

const initialUrl = new URL(window.location.href);
const callbackKind = initialUrl.searchParams.get('patient-auth');
const recoveryType = initialUrl.searchParams.get('type');
const recoveryTokenHash = initialUrl.searchParams.get('token_hash');
const recoveryProof = callbackKind === 'recovery'
  && ['recovery', 'invite'].includes(recoveryType || '')
  && Boolean(recoveryTokenHash)
  && !initialUrl.searchParams.has('error');

/** A different storage key prevents a patient's session replacing a staff session. */
const patientSupabase = isSupabaseConfigured
  ? createClient(import.meta.env.VITE_SUPABASE_URL.trim(), import.meta.env.VITE_SUPABASE_ANON_KEY.trim(), {
      auth: {
        storageKey: freshStartEnabled
          ? `medcore-patient-auth-${freshTargetRef}-${freshClinicId}`
          : 'medcore-patient-auth',
        flowType: 'implicit',
        detectSessionInUrl: callbackKind === 'confirm',
      },
    })
  : null;

export const isPatientRecoveryPage = (): boolean => callbackKind === 'recovery';
export const isPatientConfirmationPage = (): boolean => callbackKind === 'confirm';

const requireClient = () => {
  if (!patientSupabase) throw new Error('O acesso do paciente exige conexão com o Supabase. Tente novamente mais tarde.');
  return patientSupabase;
};

const redirectUrl = (kind: 'recovery' | 'confirm') => {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('patient-auth', kind);
  return url.toString();
};

async function invoke(action: string, body: object, staff = false): Promise<any> {
  const client = staff ? supabase : requireClient();
  if (!isSupabaseConfigured) throw new Error('O Supabase não está configurado.');
  if (staff) {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw new Error('Entre novamente com uma conta da equipe autenticada no Supabase.');
  }
  const { data, error } = await client.functions.invoke('patient-access', { body: { action, ...body } });
  if (error) {
    // Only use controlled backend messages, never Supabase request/token details.
    let message = 'Não foi possível acessar o serviço do paciente. Verifique a conexão e a instalação da função patient-access.';
    if (error.context instanceof Response) {
      const result = await error.context.json().catch(() => null);
      if (typeof result?.error === 'string') message = result.error;
    }
    throw new Error(message);
  }
  if (!data || data.error) throw new Error(data?.error || 'O serviço retornou uma resposta inválida. Tente novamente.');
  return data;
}

export async function registerPatient(patient: Patient, password: string): Promise<void> {
  if (!isValidCpf(patient.cpf)) throw new Error('Informe um CPF válido.');
  if (!isValidPatientPassword(password)) throw new Error('A senha deve ter entre 8 e 128 caracteres.');
  const {
    name, cpf, birthDate, gender, email, phone, address, streetName, streetNumber,
    neighborhood, city, zipCode, paymentValue, paymentSender,
  } = patient;
  await invoke('register', {
    patient: {
      name, cpf: normalizeCpf(cpf), birthDate, gender, email: email.trim().toLowerCase(),
      phone, address, streetName, streetNumber, neighborhood, city, zipCode, paymentValue, paymentSender,
    },
    password,
    redirectTo: redirectUrl('confirm'),
  });
}

export async function loginPatient(cpf: string, password: string): Promise<Patient> {
  if (!isValidCpf(cpf)) throw new Error('Informe um CPF válido.');
  const client = requireClient();
  const result = await invoke('login', { cpf: normalizeCpf(cpf), password });
  if (!result.session?.access_token || !result.session?.refresh_token) {
    throw new Error('Não foi possível autenticar. Confira CPF, senha e confirmação do e-mail.');
  }
  const { error } = await client.auth.setSession(result.session);
  if (error) throw new Error('Não foi possível iniciar a sessão do paciente.');
  try {
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth.user) throw new Error('Sessão inválida.');
    const { data, error: patientError } = await client.from('patients')
      .select('*').eq('authUserId', auth.user.id).single();
    if (patientError || !data) throw new Error('Não foi possível carregar o seu cadastro. Entre em contato com a clínica.');
    return removeLegacyPatientPassword({ ...data, patientPasswordSet: Boolean(data.authUserId) }) as Patient;
  } catch (error) {
    await client.auth.signOut({ scope: 'local' });
    throw error;
  }
}

export async function requestPatientRecovery(cpf: string): Promise<void> {
  if (!isValidCpf(cpf)) throw new Error('Informe um CPF válido.');
  await invoke('recover', { cpf: normalizeCpf(cpf), redirectTo: redirectUrl('recovery') });
}

export async function requestAdminPatientReset(patientId: string): Promise<void> {
  await invoke('admin-reset', { patientId, redirectTo: redirectUrl('recovery') }, true);
}

export async function getPatientRecoverySession(): Promise<boolean> {
  if (!recoveryProof || !patientSupabase) return false;
  if (!recoveryVerification) {
    recoveryVerification = (async () => {
      // Consume the actual one-time recovery/invite token, not a query flag or
      // a caller-relabeled access token from an ordinary logged-in session.
      const { data, error } = await patientSupabase.auth.verifyOtp({
        token_hash: recoveryTokenHash!,
        type: recoveryType as 'recovery' | 'invite',
      });
      if (error || !data.session || !data.user) return false;
      verifiedRecoveryUserId = data.user.id;
      const url = new URL(window.location.href);
      url.searchParams.delete('token_hash');
      url.searchParams.delete('type');
      window.history.replaceState({}, '', url);
      return true;
    })();
  }
  return recoveryVerification;
}

let recoveryVerification: Promise<boolean> | null = null;
let verifiedRecoveryUserId: string | null = null;

export async function updatePatientPassword(password: string): Promise<void> {
  if (!isValidPatientPassword(password)) throw new Error('A senha deve ter entre 8 e 128 caracteres.');
  if (!await getPatientRecoverySession()) throw new Error('Este link é inválido ou expirou. Solicite um novo link.');
  const { data, error: userError } = await requireClient().auth.getUser();
  if (userError || !data.user || data.user.id !== verifiedRecoveryUserId) {
    throw new Error('A sessão do link expirou. Solicite um novo link.');
  }
  const { error } = await requireClient().auth.updateUser({ password });
  if (error) throw new Error('Não foi possível atualizar a senha. Solicite outro link ou use uma senha diferente.');
  await logoutPatient();
}

export async function logoutPatient(): Promise<void> {
  verifiedRecoveryUserId = null;
  if (patientSupabase) await patientSupabase.auth.signOut({ scope: 'local' });
}

export function clearPatientCallbackUrl(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('patient-auth');
  url.searchParams.delete('token_hash');
  url.searchParams.delete('type');
  url.hash = '';
  window.history.replaceState({}, '', url);
}

export async function loadPatientPortal(patient: Patient): Promise<{ doctors: Doctor[]; appointments: Appointment[] }> {
  const client = requireClient();
  const [doctors, appointments] = await Promise.all([
    client.from('patient_portal_doctors').select('id,name,crm,specialty,clinicId,availableTimes'),
    client.from('appointments').select('*').eq('patientId', patient.id),
  ]);
  if (doctors.error || appointments.error) {
    throw new Error('Não foi possível carregar a agenda do portal. Tente novamente ou fale com a clínica.');
  }
  return { doctors: (doctors.data || []) as Doctor[], appointments: (appointments.data || []) as Appointment[] };
}

export async function bookPatientAppointment(patient: Patient, appointment: Appointment): Promise<Appointment> {
  // Patient cannot set billing, other patients, finished status or an arbitrary tenant.
  const payload = {
    id: crypto.randomUUID(),
    patientId: patient.id,
    clinicId: patient.clinicId,
    doctorId: appointment.doctorId,
    date: appointment.date,
    time: appointment.time,
    type: appointment.type,
    status: AppointmentStatus.SCHEDULED,
  };
  const { data, error } = await requireClient().from('appointments').insert(payload).select('*').single();
  if (error || !data) throw new Error('Não foi possível confirmar o agendamento. Confira a data e tente novamente.');
  return data as Appointment;
}