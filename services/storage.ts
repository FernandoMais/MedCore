
import {
  Patient,
  Doctor,
  Appointment,
  MedicalRecord,
  User,
  UserRole,
  Medication,
  SigilousNote,
  FinancialData,
  EvolutionEntry,
} from '../types';
import { MOCK_PATIENTS, MOCK_DOCTORS, MOCK_APPOINTMENTS } from '../constants';
import { supabase } from './supabase';
import { removeLegacyPatientPassword } from './patientCredentials';
import { emptyDatabase, freshStartEnabled, localDatabaseKey } from './freshStart';
import { persistConsultation, ConsultationInput } from './clinicalPersistence';
import { CloudChanges } from './cloudChanges';

const DB_KEY = localDatabaseKey();

export interface AppDatabase {
  users: User[];
  patients: Patient[];
  doctors: Doctor[];
  appointments: Appointment[];
  medicalRecords: MedicalRecord[];
  medications: Medication[];
  sigilousNotes: SigilousNote[];
  financial: FinancialData;
  lastBackup?: string;
  evolutions?: EvolutionEntry[];
}

const cloudChanges = new CloudChanges();
let syncQueue: Promise<unknown> = Promise.resolve();
const cloudScope = (clinic: string, table: string) => `${clinic}:${table}`;
const writableRows = (table: string, rows: any[], clinic: string): any[] => rows.map(row => {
  if (table === 'patients') {
    const { authUserId, pendingAuthUserId, portalEnrollmentPending, patientPasswordSet, history, ...fields } = removeLegacyPatientPassword(row);
    return { ...fields, clinicId: fields.clinicId || clinic };
  }
  if (table === 'users') {
    return { id: row.id, username: row.username, name: row.name, role: row.role,
      doctor_id: row.doctorId || row.doctor_id || null, clinicId: clinic };
  }
  if (table === 'doctors' || table === 'appointments') return { ...row, clinicId: row.clinicId || clinic };
  return row;
});

const CLINIC_ID = 'clinic-demo-001';

const requireClinicId = (clinicId: string): string => {
  const normalizedClinicId = clinicId?.trim();
  if (!normalizedClinicId) {
    throw new Error('Sessão sem clínica autorizada.');
  }
  return normalizedClinicId;
};

const financialRowsForClinic = <T extends { clinicId: string }>(rows: T[], clinicId: string): T[] => {
  const scopedRows = rows.filter(row => row.clinicId === clinicId);
  if (scopedRows.length !== rows.length) {
    throw new Error('A operação contém dados de outra clínica.');
  }
  return scopedRows;
};

const normalizeAppointments = (appointments: Appointment[]): Appointment[] => appointments.map(appointment => ({
  ...appointment,
  serviceValue: appointment.serviceValue ?? (appointment.type === 'Procedimento' ? 500 : appointment.type === 'Retorno' ? 180 : 350),
  repassRule: appointment.repassRule ?? { type: 'percentage', value: 60 },
}));

const dateFromToday = (offset: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().split('T')[0];
};

const DEFAULT_FINANCIAL: FinancialData = {
  categories: [
    { id: 'fc-consultas', clinicId: CLINIC_ID, name: 'Consultas', type: 'receita', color: '#2563eb', active: true },
    { id: 'fc-procedimentos', clinicId: CLINIC_ID, name: 'Procedimentos', type: 'receita', color: '#0d9488', active: true },
    { id: 'fc-convenios', clinicId: CLINIC_ID, name: 'Convênios', type: 'receita', color: '#7c3aed', active: true },
    { id: 'fc-insumos', clinicId: CLINIC_ID, name: 'Insumos e materiais', type: 'despesa', color: '#f59e0b', active: true },
    { id: 'fc-operacional', clinicId: CLINIC_ID, name: 'Despesas operacionais', type: 'despesa', color: '#ef4444', active: true },
    { id: 'fc-pessoal', clinicId: CLINIC_ID, name: 'Pessoal e repasses', type: 'despesa', color: '#db2777', active: true },
  ],
  costCenters: [
    { id: 'cc-clinica', clinicId: CLINIC_ID, name: 'Operação da clínica', description: 'Custos gerais da unidade', active: true },
    { id: 'cc-consultorios', clinicId: CLINIC_ID, name: 'Consultórios', description: 'Atendimento e salas', active: true },
    { id: 'cc-administrativo', clinicId: CLINIC_ID, name: 'Administrativo', description: 'Gestão e backoffice', active: true },
  ],
  paymentMethods: [
    { id: 'pm-pix', clinicId: CLINIC_ID, name: 'PIX', kind: 'ambos', feePercent: 0, active: true },
    { id: 'pm-credit', clinicId: CLINIC_ID, name: 'Cartão de crédito', kind: 'entrada', feePercent: 2.99, active: true },
    { id: 'pm-debit', clinicId: CLINIC_ID, name: 'Cartão de débito', kind: 'entrada', feePercent: 1.49, active: true },
    { id: 'pm-cash', clinicId: CLINIC_ID, name: 'Dinheiro', kind: 'entrada', feePercent: 0, active: true },
    { id: 'pm-transfer', clinicId: CLINIC_ID, name: 'Transferência bancária', kind: 'ambos', feePercent: 0, active: true },
  ],
  bankAccounts: [
    { id: 'ba-main', clinicId: CLINIC_ID, name: 'Conta principal', bank: 'Banco MedCore', agency: '0001', accountNumber: '12345-6', kind: 'banco', openingBalance: 18450, active: true },
    { id: 'ba-cash', clinicId: CLINIC_ID, name: 'Caixa recepção', kind: 'caixa', openingBalance: 850, active: true },
  ],
  insurancePlans: [
    { id: 'ip-unimed', clinicId: CLINIC_ID, name: 'Unimed', operator: 'Unimed Nacional', code: 'UNIMED-001', paymentTermDays: 30, active: true },
    { id: 'ip-bradesco', clinicId: CLINIC_ID, name: 'Bradesco Saúde', operator: 'Bradesco Saúde', code: 'BRAD-001', paymentTermDays: 45, active: true },
    { id: 'ip-particular', clinicId: CLINIC_ID, name: 'Particular', operator: 'Atendimento particular', paymentTermDays: 0, active: true },
  ],
  transactions: [
    {
      id: 'ft-001', clinicId: CLINIC_ID, type: 'receita', status: 'pago', description: 'Consulta cardiológica — João Silva',
      amount: 350, dueDate: dateFromToday(-3), paidDate: dateFromToday(-3), patientId: '1', doctorId: 'd1',
      appointmentId: 'a1', categoryId: 'fc-consultas', costCenterId: 'cc-consultorios', paymentMethodId: 'pm-pix',
      accountId: 'ba-main', createdAt: dateFromToday(-3),
    },
    {
      id: 'ft-002', clinicId: CLINIC_ID, type: 'receita', status: 'pendente', description: 'Consulta pediátrica — Carlos Santos',
      amount: 280, dueDate: dateFromToday(4), patientId: '3', doctorId: 'd2',
      categoryId: 'fc-consultas', costCenterId: 'cc-consultorios', paymentMethodId: 'pm-credit', accountId: 'ba-main', createdAt: dateFromToday(-1),
    },
    {
      id: 'ft-003', clinicId: CLINIC_ID, type: 'receita', status: 'vencido', description: 'Repasse de convênio — Unimed',
      amount: 1280, dueDate: dateFromToday(-12), insurancePlanId: 'ip-unimed',
      categoryId: 'fc-convenios', costCenterId: 'cc-clinica', accountId: 'ba-main', createdAt: dateFromToday(-35),
    },
    {
      id: 'ft-004', clinicId: CLINIC_ID, type: 'despesa', status: 'pago', description: 'Materiais descartáveis',
      amount: 430, dueDate: dateFromToday(-5), paidDate: dateFromToday(-5), categoryId: 'fc-insumos',
      costCenterId: 'cc-consultorios', paymentMethodId: 'pm-transfer', accountId: 'ba-main', createdAt: dateFromToday(-5),
    },
    {
      id: 'ft-005', clinicId: CLINIC_ID, type: 'despesa', status: 'pendente', description: 'Aluguel da unidade',
      amount: 6200, dueDate: dateFromToday(8), categoryId: 'fc-operacional',
      costCenterId: 'cc-clinica', accountId: 'ba-main', createdAt: dateFromToday(-2),
    },
  ],
  repasses: [
    { id: 'rp-001', clinicId: CLINIC_ID, doctorId: 'd1', patientId: '1', appointmentId: 'a1', referenceMonth: dateFromToday(-4).slice(0, 7), grossAmount: 350, percentage: 60, amount: 210, status: 'previsto', dueDate: dateFromToday(10) },
  ],
  cashClosures: [
    { id: 'cash-001', clinicId: CLINIC_ID, accountId: 'ba-cash', date: dateFromToday(0), openingBalance: 850, expectedBalance: 850, countedBalance: 850, difference: 0, responsibleName: 'Recepção', status: 'aberto' },
  ],
  reconciliations: [
    { id: 'br-001', clinicId: CLINIC_ID, accountId: 'ba-main', date: dateFromToday(-1), description: 'PIX — João Silva', amount: 350, type: 'receita', status: 'conciliado', transactionId: 'ft-001' },
    { id: 'br-002', clinicId: CLINIC_ID, accountId: 'ba-main', date: dateFromToday(-1), description: 'Tarifa bancária', amount: 18.9, type: 'despesa', status: 'pendente' },
  ],
  billingRecords: [
    { id: 'bill-001', clinicId: CLINIC_ID, referenceMonth: dateFromToday(-4).slice(0, 7), insurancePlanId: 'ip-unimed', totalAmount: 1280, dueDate: dateFromToday(18), status: 'enviado', submittedAt: dateFromToday(-2), notes: 'Lote mensal de consultas' },
  ],
  settings: [
    { clinicId: CLINIC_ID, clinicName: 'Clínica MedCore', document: '12.345.678/0001-90', currency: 'BRL', defaultPaymentMethodId: 'pm-pix', defaultAccountId: 'ba-main', allowNegativeCash: false, sendPaymentNotifications: true },
  ],
};

const DEFAULT_DB: AppDatabase = {
  users: [
    { id: 'u1', username: 'admin', password: '123', name: 'Administrador MedCore', role: UserRole.ADMIN, clinicId: CLINIC_ID },
    { id: 'u2', username: 'ricardo', password: '123', name: 'Dr. Ricardo Souza', role: UserRole.DOCTOR, doctorId: 'd1', clinicId: CLINIC_ID },
    { id: 'u3', username: 'ana', password: '123', name: 'Dra. Ana Beatriz', role: UserRole.DOCTOR, doctorId: 'd2', clinicId: CLINIC_ID }
  ],
  patients: MOCK_PATIENTS,
  doctors: MOCK_DOCTORS,
  appointments: MOCK_APPOINTMENTS,
  medicalRecords: [],
  medications: [
    { id: 'm1', name: 'Amoxicilina', dosage: '500mg', posology: 'Tomar 1 comprimido de 8 em 8 horas', period: '7 dias', purpose: 'Antibiótico', manufacturer: 'Eurofarma' },
    { id: 'm2', name: 'Dipirona', dosage: '500mg', posology: '1 comprimido se dor ou febre', period: 'Até de 6 em 6 horas', purpose: 'Analgésico e Antitérmico', manufacturer: 'Medley' }
  ],
  sigilousNotes: [],
  financial: DEFAULT_FINANCIAL,
};

export const storage = {
  initLocal: (): AppDatabase => {
    if (freshStartEnabled) {
      const saved = localStorage.getItem(DB_KEY);
      if (!saved) return emptyDatabase();
      let parsed: AppDatabase;
      try { parsed = JSON.parse(saved); } catch {
        throw new Error('O armazenamento da nova instalação está inválido. Nenhum dado antigo foi carregado.');
      }
      if (!parsed || !Array.isArray(parsed.patients) || !Array.isArray(parsed.doctors)
        || !Array.isArray(parsed.users) || !parsed.financial) {
        throw new Error('O armazenamento da nova instalação está incompleto. Nenhum dado antigo foi carregado.');
      }
      return {
        ...parsed,
        users: parsed.users.map(user => ({ ...user, password: '', senhaAcesso: undefined })),
        patients: parsed.patients.map(removeLegacyPatientPassword),
        // Private note bodies must not survive into another user's session.
        sigilousNotes: [],
        evolutions: [],
      };
    }
    try {
      const saved = localStorage.getItem(DB_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const users = Array.isArray(parsed.users) && parsed.users.length > 0
          ? parsed.users
          : DEFAULT_DB.users;
        const hasAdmin = users.some((u: User) => u.username === 'admin');
        const finalUsers = hasAdmin ? users : [...DEFAULT_DB.users.filter(u => u.username === 'admin'), ...users];
        return {
          users: finalUsers.map((user: User) => ({ ...user, clinicId: user.clinicId || CLINIC_ID })),
          patients: Array.isArray(parsed.patients)
            ? parsed.patients.map((patient: Patient) => ({
                ...removeLegacyPatientPassword(patient),
                patientPasswordSet: Boolean(patient.authUserId),
              }))
            : DEFAULT_DB.patients,
          doctors: Array.isArray(parsed.doctors) ? parsed.doctors : DEFAULT_DB.doctors,
          appointments: Array.isArray(parsed.appointments) ? normalizeAppointments(parsed.appointments) : DEFAULT_DB.appointments,
          medicalRecords: Array.isArray(parsed.medicalRecords) ? parsed.medicalRecords : DEFAULT_DB.medicalRecords,
          medications: Array.isArray(parsed.medications) ? parsed.medications : DEFAULT_DB.medications,
          sigilousNotes: Array.isArray(parsed.sigilousNotes) ? parsed.sigilousNotes : DEFAULT_DB.sigilousNotes,
          financial: parsed.financial && typeof parsed.financial === 'object'
            ? {
                ...DEFAULT_FINANCIAL,
                ...parsed.financial,
                transactions: Array.isArray(parsed.financial.transactions) ? parsed.financial.transactions : DEFAULT_FINANCIAL.transactions,
                categories: Array.isArray(parsed.financial.categories) ? parsed.financial.categories : DEFAULT_FINANCIAL.categories,
                costCenters: Array.isArray(parsed.financial.costCenters) ? parsed.financial.costCenters : DEFAULT_FINANCIAL.costCenters,
                paymentMethods: Array.isArray(parsed.financial.paymentMethods) ? parsed.financial.paymentMethods : DEFAULT_FINANCIAL.paymentMethods,
                bankAccounts: Array.isArray(parsed.financial.bankAccounts) ? parsed.financial.bankAccounts : DEFAULT_FINANCIAL.bankAccounts,
                insurancePlans: Array.isArray(parsed.financial.insurancePlans) ? parsed.financial.insurancePlans : DEFAULT_FINANCIAL.insurancePlans,
                repasses: Array.isArray(parsed.financial.repasses) ? parsed.financial.repasses : DEFAULT_FINANCIAL.repasses,
                cashClosures: Array.isArray(parsed.financial.cashClosures) ? parsed.financial.cashClosures : DEFAULT_FINANCIAL.cashClosures,
                reconciliations: Array.isArray(parsed.financial.reconciliations) ? parsed.financial.reconciliations : DEFAULT_FINANCIAL.reconciliations,
                billingRecords: Array.isArray(parsed.financial.billingRecords) ? parsed.financial.billingRecords : DEFAULT_FINANCIAL.billingRecords,
                settings: Array.isArray(parsed.financial.settings) ? parsed.financial.settings : DEFAULT_FINANCIAL.settings,
              }
            : DEFAULT_DB.financial,
          lastBackup: parsed.lastBackup
        };
      }
    } catch (e) {
      console.error("Erro storage local:", e);
    }
    return DEFAULT_DB;
  },

  fetchFromCloud: async (clinicId?: string): Promise<Partial<AppDatabase>> => {
    // Antes do login não existe tenant autorizado. Não consultar a nuvem
    // nesse momento evita substituir o estado local por respostas vazias/RLS.
    if (!clinicId) return {};
    const authorizedClinicId = requireClinicId(clinicId);
    try {
      const cloudData: Partial<AppDatabase> = {};
      const assignRows = <K extends keyof AppDatabase>(key: K, table: string, res: any) => {
        if (res.error || !Array.isArray(res.data)) throw new Error(`Não foi possível carregar ${table}.`);
        (cloudData as any)[key] = res.data;
        cloudChanges.capture(cloudScope(authorizedClinicId, table), writableRows(table, res.data, authorizedClinicId));
      };

      assignRows('patients', 'patients', await supabase.from('patients').select('*').eq('clinicId', authorizedClinicId));
      if (cloudData.patients) {
        cloudData.patients = cloudData.patients.map(patient => ({
          ...removeLegacyPatientPassword(patient),
          patientPasswordSet: Boolean(patient.authUserId),
        }));
      }
      assignRows('doctors', 'doctors', await supabase.from('doctors').select('*').eq('clinicId', authorizedClinicId));
      assignRows('appointments', 'appointments', await supabase.from('appointments').select('*').eq('clinicId', authorizedClinicId));
      const profiles = await supabase.from('users')
        .select('id,username,name,role,doctor_id,clinicId,authUserId');
      assignRows('users', 'users', profiles);
      if (profiles.data) {
        // Keep legacy offline credentials only on this browser. Never download
        // another staff member's password or use it as a cloud profile field.
        const localUsers = storage.initLocal().users;
        cloudData.users = profiles.data.map(profile => ({
          ...profile,
          doctorId: profile.doctor_id || undefined,
          password: localUsers.find(user => user.id === profile.id)?.password || '',
          senhaAcesso: localUsers.find(user => user.id === profile.id)?.senhaAcesso,
        })) as User[];
      }
      assignRows('medications', 'medications', await supabase.from('medications').select('*'));
      assignRows('sigilousNotes', 'sigilous_notes', await supabase.from('sigilous_notes').select('*'));
      assignRows('evolutions', 'evolucao_paciente', await supabase.from('evolucao_paciente').select('*'));
      const financialTables: Record<string, keyof FinancialData> = {
        financial_transactions: 'transactions',
        financial_categories: 'categories',
        financial_cost_centers: 'costCenters',
        financial_payment_methods: 'paymentMethods',
        financial_bank_accounts: 'bankAccounts',
        financial_insurance_plans: 'insurancePlans',
        financial_repasses: 'repasses',
        financial_cash_closures: 'cashClosures',
        financial_reconciliations: 'reconciliations',
        financial_billing_records: 'billingRecords',
        financial_settings: 'settings',
      };
      const financial = freshStartEnabled
        ? emptyDatabase().financial
        : { ...DEFAULT_FINANCIAL } as FinancialData;
      for (const [table, key] of Object.entries(financialTables)) {
        const result = await supabase.from(table).select('*').eq('clinicId', authorizedClinicId);
        if (result.error || !Array.isArray(result.data)) throw new Error('Não foi possível carregar os dados financeiros.');
        (financial[key] as any) = result.data;
        cloudChanges.capture(cloudScope(authorizedClinicId, table), result.data);
      }
      cloudData.financial = financial;
      if (Array.isArray(cloudData.appointments)) {
        cloudData.appointments = normalizeAppointments(cloudData.appointments);
      }

      return cloudData;
    } catch (e) {
      throw new Error('Não foi possível carregar a base autorizada da nuvem. A sincronização automática está suspensa.');
    }
  },

  save: (db: AppDatabase) => {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify({
        ...db, patients: db.patients.map(removeLegacyPatientPassword),
        sigilousNotes: [], evolutions: [],
        ...(freshStartEnabled ? {
          users: db.users.map(user => ({ ...user, password: '', senhaAcesso: undefined })),
        } : {}),
      }));
    } catch (e) {
      console.error("Falha ao salvar localmente:", e);
    }
  },

  syncToCloud: async (db: AppDatabase, clinicId: string) => {
    const authorizedClinicId = requireClinicId(clinicId);
    const run = async () => {
      const writeChanged = async (table: string, rows: any[]) => {
        const scope = cloudScope(authorizedClinicId, table);
        const prepared = writableRows(table, rows, authorizedClinicId);
        const changed = cloudChanges.changed(scope, prepared);
        if (!changed.length) return;
        const { error } = await supabase.from(table).upsert(changed);
        if (error) throw new Error(`A gravação de ${table} não foi confirmada.`);
        cloudChanges.acknowledged(scope, changed);
      };
    try {
      // Missing rows are not proof of an authorized deletion (a filtered UI
      // can also omit them). Fail explicitly until dedicated delete APIs exist.
      for (const [table, rows] of [
        ['patients', db.patients], ['doctors', db.doctors],
        ['appointments', db.appointments], ['medications', db.medications],
      ] as [string, any[]][]) {
        cloudChanges.assertNoUnconfirmedRemovals(cloudScope(authorizedClinicId, table), rows || []);
      }
      if (db.patients?.length > 0) {
        const rows = db.patients.map(patient => {
          const { authUserId, pendingAuthUserId, portalEnrollmentPending, patientPasswordSet, ...row } = removeLegacyPatientPassword(patient);
          return { ...row, clinicId: row.clinicId || authorizedClinicId };
        }).filter(patient => patient.clinicId === authorizedClinicId);
        await writeChanged('patients', rows);
      }
      if (db.doctors?.length > 0) {
        const rows = db.doctors.map(doctor => ({ ...doctor, clinicId: doctor.clinicId || authorizedClinicId }))
          .filter(doctor => doctor.clinicId === authorizedClinicId);
        await writeChanged('doctors', rows);
      }
      if (db.appointments?.length > 0) {
        const rows = db.appointments.map(appointment => ({
          ...appointment,
          clinicId: appointment.clinicId || db.patients.find(p => p.id === appointment.patientId)?.clinicId || authorizedClinicId,
        })).filter(appointment => appointment.clinicId === authorizedClinicId);
        await writeChanged('appointments', rows);
      }
      if (db.users?.length > 0) {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        const actor = db.users.find(user => user.authUserId === auth.user?.id);
        if (actor?.role === UserRole.ADMIN) {
          const rows = db.users.filter(user => user.clinicId === authorizedClinicId).map(user => ({
            id: user.id, username: user.username, name: user.name, role: user.role,
            doctor_id: user.doctorId || null, clinicId: authorizedClinicId,
          }));
          await writeChanged('users', rows);
        }
      }
      if (db.medications?.length > 0) await writeChanged('medications', db.medications);
      // Notes and evolutions are append-only, acknowledged clinical writes.
      // Never bulk-upsert these protected records from a browser snapshot.
      if (db.financial) {
        const financialTables: Record<keyof FinancialData, string> = {
          transactions: 'financial_transactions',
          categories: 'financial_categories',
          costCenters: 'financial_cost_centers',
          paymentMethods: 'financial_payment_methods',
          bankAccounts: 'financial_bank_accounts',
          insurancePlans: 'financial_insurance_plans',
          repasses: 'financial_repasses',
          cashClosures: 'financial_cash_closures',
          reconciliations: 'financial_reconciliations',
          billingRecords: 'financial_billing_records',
          settings: 'financial_settings',
        };
        for (const [key, table] of Object.entries(financialTables)) {
          const rows = db.financial[key as keyof FinancialData];
          if (Array.isArray(rows) && rows.length > 0) {
            const scopedRows = financialRowsForClinic(rows as Array<{ clinicId: string }>, authorizedClinicId);
            await writeChanged(table, scopedRows);
          }
        }
      }
    } catch (e) {
      throw e;
    }
    };
    const queued = syncQueue.then(run);
    syncQueue = queued.catch(() => {});
    return queued;
  },

  resetCloudSyncState: () => cloudChanges.clear(),

  finishConsultation: async (appointmentId: string, input: ConsultationInput, clinicId: string) => {
    const saved = await persistConsultation(supabase, appointmentId, input);
    const scope = cloudScope(requireClinicId(clinicId), 'appointments');
    // Only acknowledge if a full authenticated snapshot exists.
    try { cloudChanges.acknowledged(scope, writableRows('appointments', [saved.appointment], clinicId)); } catch {}
    return saved;
  },

  saveEvolutionToCloud: async (evolution: any) => {
    return await supabase.from('evolucao_paciente').insert([evolution]);
  },

  saveSigilousNoteToCloud: async (note: SigilousNote) => {
    const result = await supabase.from('sigilous_notes').insert([note]);
    if (result.error) throw new Error('A nota sigilosa não foi gravada. O texto foi mantido; confira seu acesso e a conexão.');
    return result;
  },

  exportBackup: (db?: AppDatabase) => {
    const source = db ? { ...db, lastBackup: new Date().toISOString() } : JSON.parse(localStorage.getItem(DB_KEY) || 'null');
    if (source?.patients) source.patients = source.patients.map(removeLegacyPatientPassword);
    if (source?.users) source.users = source.users.map(({ password, senhaAcesso, ...user }: User) => ({ ...user, password: '' }));
    if (source) source.backupKind = 'local-visible-snapshot';
    const data = JSON.stringify(source);
    if (!data || data === 'null') {
      alert("Nenhum dado disponível para exportar.");
      return;
    }
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `medcore_local_backup_${new Date().toISOString().replaceAll(':', '-')}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  },

  importBackup: (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const data = JSON.parse(content);
          if (data && Array.isArray(data.patients) && Array.isArray(data.doctors) && Array.isArray(data.users)) {
            data.patients = data.patients.map(removeLegacyPatientPassword);
            localStorage.setItem(DB_KEY, JSON.stringify(data));
            resolve();
          } else {
            reject(new Error("Arquivo de backup inválido ou corrompido."));
          }
        } catch (err) {
          reject(new Error("Erro ao ler o arquivo de backup."));
        }
      };
      reader.onerror = () => reject(new Error("Falha ao ler o arquivo físico."));
      reader.readAsText(file);
    });
  }
};
