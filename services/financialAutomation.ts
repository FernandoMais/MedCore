import {
  Appointment,
  FinancialData,
  FinancialTransaction,
  ProfessionalRepass,
} from '../types';

const today = () => new Date().toISOString().split('T')[0];

/**
 * Creates the financial records associated with a completed/confirmed appointment.
 * The appointmentId is the idempotency key for both records, so calling this
 * function again for the same appointment never creates duplicates.
 */
export const ensureFinancialEntriesForAppointment = (
  financial: FinancialData,
  appointment: Appointment,
  clinicId: string,
): FinancialData => {
  const serviceValue = Number(appointment.serviceValue || 0);
  const ruleValue = Number(appointment.repassRule?.value || 0);
  if (!appointment.patientId || !appointment.doctorId || !Number.isFinite(serviceValue) || serviceValue <= 0) {
    return financial;
  }

  const transactions = financial.transactions || [];
  const repasses = financial.repasses || [];
  const transactionExists = transactions.some(
    transaction => transaction.appointmentId === appointment.id && transaction.type === 'receita',
  );
  const repassExists = repasses.some(repass => repass.appointmentId === appointment.id);
  const createdAt = today();
  const categoryId = appointment.type === 'Procedimento' ? 'fc-procedimentos' : 'fc-consultas';
  const patientLabel = appointment.type === 'Procedimento' ? 'Procedimento' : appointment.type;

  const nextTransactions = transactionExists
    ? transactions
    : [
        {
          id: `ft-appt-${appointment.id}`,
          clinicId,
          type: 'receita',
          status: 'pendente',
          description: `${patientLabel} — atendimento agendado`,
          amount: Number(serviceValue.toFixed(2)),
          dueDate: appointment.date || createdAt,
          patientId: appointment.patientId,
          doctorId: appointment.doctorId,
          appointmentId: appointment.id,
          categoryId,
          costCenterId: 'cc-consultorios',
          notes: `Gerado automaticamente a partir do agendamento ${appointment.id}.`,
          createdAt,
        } satisfies FinancialTransaction,
        ...transactions,
      ];

  const repassValue = appointment.repassRule && Number.isFinite(ruleValue)
    ? appointment.repassRule.type === 'percentage'
      ? serviceValue * ruleValue / 100
      : ruleValue
    : 0;

  const nextRepasses = repassExists || repassValue <= 0
    ? repasses
    : [
        {
          id: `rp-appt-${appointment.id}`,
          clinicId,
          doctorId: appointment.doctorId,
          patientId: appointment.patientId,
          appointmentId: appointment.id,
          referenceMonth: (appointment.date || createdAt).slice(0, 7),
          grossAmount: Number(serviceValue.toFixed(2)),
          percentage: appointment.repassRule?.type === 'percentage'
            ? ruleValue
            : undefined,
          amount: Number(repassValue.toFixed(2)),
          status: 'previsto',
          dueDate: appointment.date || createdAt,
          notes: `Gerado automaticamente a partir do agendamento ${appointment.id}. Regra: ${
            appointment.repassRule?.type === 'percentage'
              ? `${ruleValue}%`
              : `valor fixo de R$ ${ruleValue.toFixed(2)}`
          }.`,
        } satisfies ProfessionalRepass,
        ...repasses,
      ];

  if (nextTransactions === transactions && nextRepasses === repasses) {
    return financial;
  }

  return {
    ...financial,
    transactions: nextTransactions,
    repasses: nextRepasses,
  };
};