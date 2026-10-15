import { supabase } from './supabase';
import { operationalRpc } from './operationalStorage';

export interface FeeProfile {
  doctorId: string;
  price: number;
  doctorPercent: number;
  paymentUrl: string;
  bank: string;
  agency: string;
  account: string;
  pixKey: string;
  version?: string;
}
export interface BillingRow {
  appointmentId: string;
  doctorId: string;
  patientId: string;
  patientName: string;
  doctorName: string;
  date: string;
  status: string;
  price: number;
  doctorPercent: number;
  paymentUrl: string;
  paymentStatus: string;
  paymentDate?: string;
  receiptReference?: string;
  repassAmount: number;
  repassStatus: string;
  repassPaidDate?: string;
  version: string;
}
export const loadManualBilling = (): Promise<{profiles: FeeProfile[]; rows: BillingRow[]; canManage: boolean}> =>
  operationalRpc('manual_billing_snapshot');
export async function saveFeeProfile(profile: FeeProfile) {
  await operationalRpc('manual_billing_save_profile', {p_profile: profile, p_expected: profile.version || null});
}
export async function confirmReceipt(input: {appointmentId: string; amount: number; date: string; reference: string; expected: string}) {
  await operationalRpc('manual_billing_confirm', {
    p_appointment: input.appointmentId, p_amount: input.amount, p_date: input.date,
    p_reference: input.reference, p_expected: input.expected,
  });
}
export async function markPayout(input: {appointmentId: string; date: string; expected: string}) {
  await operationalRpc('manual_billing_payout', {
    p_appointment: input.appointmentId, p_date: input.date, p_expected: input.expected,
  });
}
export async function sendPaymentLink(appointmentId: string, patient = false): Promise<{sent: boolean; error?: string}> {
  try {
    // Load the isolated patient client only for a patient operation. Staff and
    // report modules must not eagerly depend on the patient-login module.
    const client = patient ? (await import('./patientAuth')).patientSupabase : supabase;
    if (!client) throw Error();
    const {data, error} = await client.functions.invoke('appointment-payment-mail', {body: {appointmentId}});
    if (error || !data?.sent) return {sent: false, error: data?.error || 'O agendamento está salvo, mas o e-mail não foi enviado. O link continua disponível na tela.'};
    return {sent: true};
  } catch {
    return {sent: false, error: 'O agendamento está salvo, mas o serviço de e-mail não respondeu. O link continua disponível na tela.'};
  }
}
