
export enum UserRole {
  ADMIN = 'admin',
  DOCTOR = 'doctor',
  COLLABORATOR = 'collaborator',
  SECRETARY = 'secretaria',
  TREASURY = 'tesouraria',
  PATIENT = 'patient'
}

export interface User {
  id: string;
  authUserId?: string;
  username: string;
  password: string;
  name: string;
  role: UserRole;
  doctorId?: string;
  clinicId: string;
  senhaAcesso?: string; // Senha sigilosa definida pelo admin para acesso a informações restritas
}

export enum AppointmentStatus {
  SCHEDULED = 'Agendado',
  CONFIRMED = 'Confirmado',
  IN_PROGRESS = 'Em Atendimento',
  FINISHED = 'Finalizado',
  ABSENT = 'Faltou',
  CANCELLED = 'Cancelado'
}

export enum Gender {
  MALE = 'Masculino',
  FEMALE = 'Feminino',
  OTHER = 'Outro'
}

export interface DoctorSchedule {
  dayOfWeek: 'Segunda' | 'Terça' | 'Quarta' | 'Quinta' | 'Sexta' | 'Sábado' | 'Domingo';
  startTime: string;
  endTime: string;
}

export interface Doctor {
  id: string;
  clinicId?: string;
  name: string;
  crm: string;
  specialty: string;
  email: string;
  phone: string;
  avatar?: string;
  availableTimes: DoctorSchedule[];
  consultationPrice?: number;
}

export type RepassRuleType = 'percentage' | 'fixed';

export interface RepassRule {
  type: RepassRuleType;
  value: number;
}

export interface MedicalFile {
  id: string;
  name: string;
  type: string;
  size: number;
  date: string;
  url: string;
  category: 'Exame' | 'Receita' | 'Laudo' | 'Outros';
}

export interface Patient {
  id: string;
  clinicId?: string;
  /** Set only by the trusted patient-access backend. Never a credential. */
  authUserId?: string;
  pendingAuthUserId?: string;
  portalEnrollmentPending?: boolean;
  name: string;
  birthDate: string;
  gender: Gender;
  cpf: string;
  email: string;
  phone: string;
  address: string;
  streetName?: string;
  streetNumber?: string;
  neighborhood?: string;
  city?: string;
  zipCode?: string;
  healthInsurance?: string;
  bloodType?: string;
  allergies: string[];
  history: string;
  preExistingConditions: string[];
  createdAt: string;
  primaryDoctorId: string;
  files: MedicalFile[];
  paymentValue?: string;
  paymentSender?: string;
  selfRegistered?: boolean;
  patientPasswordSet?: boolean;
}

export interface Appointment {
  id: string;
  clinicId?: string;
  patientId: string;
  doctorId: string;
  date: string;
  time: string;
  type: 'Consulta' | 'Retorno' | 'Procedimento' | 'Telemedicina';
  status: AppointmentStatus;
  room?: string;
  serviceValue?: number;
  repassRule?: RepassRule;
  /** Immutable checkout URL captured by the server when booking. */
  paymentUrl?: string;
}

export interface MedicalRecord {
  id: string;
  patientId: string;
  appointmentId: string;
  date: string;
  chiefComplaint: string;
  diagnosis: string;
  icdCode?: string;
  conduct: string;
  prescriptions: Prescription[];
  exams: string[];
}

export interface Prescription {
  medication: string;
  dosage: string;
  frequency: string;
  duration: string;
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  posology?: string;
  period?: string;
  purpose?: string;
  manufacturer?: string;
}

export interface EvolutionEntry {
  id: string;
  appointment_id?: string;
  paciente_id: string;
  medico_id: string;
  medico_nome: string;
  especialidade: string;
  anotacoes: string;
  senha_acesso: string;
  data_criacao: string;
}

export interface SigilousNote {
  id: string;
  patientId: string;
  authorId: string;
  authorName: string;
  authorSpecialty?: string;
  note: string;
  createdAt: string; // ISO string
}

export type FinanceSection =
  | 'dashboard'
  | 'receivable'
  | 'payable'
  | 'cashflow'
  | 'income'
  | 'expenses'
  | 'payments'
  | 'repasses'
  | 'cash'
  | 'bank-accounts'
  | 'categories'
  | 'cost-centers'
  | 'payment-methods'
  | 'insurance'
  | 'billing'
  | 'reconciliation'
  | 'delinquency'
  | 'reports'
  | 'settings';

export type FinancialEntryType = 'receita' | 'despesa';
export type FinancialStatus = 'pendente' | 'pago' | 'vencido' | 'cancelado';

export interface FinancialTransaction {
  id: string;
  clinicId: string;
  type: FinancialEntryType;
  status: FinancialStatus;
  description: string;
  amount: number;
  dueDate: string;
  paidDate?: string;
  patientId?: string;
  doctorId?: string;
  appointmentId?: string;
  categoryId?: string;
  costCenterId?: string;
  paymentMethodId?: string;
  accountId?: string;
  insurancePlanId?: string;
  documentNumber?: string;
  notes?: string;
  createdAt: string;
}

export interface FinancialCategory {
  id: string;
  clinicId: string;
  name: string;
  type: FinancialEntryType | 'ambos';
  color: string;
  active: boolean;
}

export interface CostCenter {
  id: string;
  clinicId: string;
  name: string;
  description?: string;
  active: boolean;
}

export interface PaymentMethod {
  id: string;
  clinicId: string;
  name: string;
  kind: 'entrada' | 'saida' | 'ambos';
  feePercent?: number;
  active: boolean;
}

export interface BankAccount {
  id: string;
  clinicId: string;
  name: string;
  bank?: string;
  agency?: string;
  accountNumber?: string;
  kind: 'banco' | 'caixa';
  openingBalance: number;
  active: boolean;
}

export interface InsurancePlan {
  id: string;
  clinicId: string;
  name: string;
  operator: string;
  code?: string;
  paymentTermDays: number;
  active: boolean;
}

export interface ProfessionalRepass {
  id: string;
  clinicId: string;
  doctorId: string;
  patientId?: string;
  appointmentId?: string;
  referenceMonth: string;
  grossAmount: number;
  percentage?: number;
  amount: number;
  status: 'previsto' | 'aprovado' | 'pago';
  dueDate: string;
  paidDate?: string;
  notes?: string;
}

export interface CashClosure {
  id: string;
  clinicId: string;
  accountId: string;
  date: string;
  openingBalance: number;
  expectedBalance: number;
  countedBalance: number;
  difference: number;
  responsibleName: string;
  status: 'aberto' | 'fechado';
  notes?: string;
}

export interface BankReconciliation {
  id: string;
  clinicId: string;
  accountId: string;
  date: string;
  description: string;
  amount: number;
  type: FinancialEntryType;
  status: 'pendente' | 'conciliado' | 'divergente';
  transactionId?: string;
}

export interface BillingRecord {
  id: string;
  clinicId: string;
  referenceMonth: string;
  patientId?: string;
  insurancePlanId?: string;
  totalAmount: number;
  submittedAt?: string;
  dueDate: string;
  status: 'rascunho' | 'enviado' | 'pago' | 'glosa';
  notes?: string;
}

export interface FinancialSettings {
  clinicId: string;
  clinicName: string;
  document?: string;
  currency: string;
  defaultPaymentMethodId?: string;
  defaultAccountId?: string;
  allowNegativeCash: boolean;
  sendPaymentNotifications: boolean;
}

export interface FinancialData {
  transactions: FinancialTransaction[];
  categories: FinancialCategory[];
  costCenters: CostCenter[];
  paymentMethods: PaymentMethod[];
  bankAccounts: BankAccount[];
  insurancePlans: InsurancePlan[];
  repasses: ProfessionalRepass[];
  cashClosures: CashClosure[];
  reconciliations: BankReconciliation[];
  billingRecords: BillingRecord[];
  settings: FinancialSettings[];
}
