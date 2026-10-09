import type { Appointment, EvolutionEntry } from '../types';

export interface ConsultationInput {
  diagnosis: string;
  conduct: string;
  complaint: string;
  prescription: string;
  especialidade?: string;
  senha_acesso?: string;
}

export async function persistConsultation(
  client: { rpc: (name: string, args: Record<string, string>) => any },
  appointmentId: string,
  input: ConsultationInput,
): Promise<{ appointment: Appointment; evolution: EvolutionEntry }> {
  const result = await client.rpc('finish_clinical_consultation', {
    p_appointment_id: appointmentId,
    p_complaint: input.complaint,
    p_diagnosis: input.diagnosis,
    p_conduct: input.conduct,
    p_prescription: input.prescription,
    p_specialty: input.especialidade || 'Clínica Geral',
    p_access_password: input.senha_acesso || '',
  });
  if (result.error) {
    throw new Error('O banco não confirmou a gravação. Seu rascunho foi mantido; verifique a conexão e tente novamente.');
  }
  const saved = result.data;
  if (saved?.appointment?.id !== appointmentId || saved.appointment.status !== 'Finalizado'
    || !saved.evolution?.id || saved.evolution.appointment_id !== appointmentId) {
    throw new Error('A confirmação recebida está incompleta. Seu rascunho foi mantido.');
  }
  return saved;
}
