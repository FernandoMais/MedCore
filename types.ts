
export enum UserRole {
  ADMIN = 'admin',
  DOCTOR = 'doctor',
  COLLABORATOR = 'collaborator',
  PATIENT = 'patient'
}

export interface User {
  id: string;
  username: string;
  password: string;
  name: string;
  role: UserRole;
  doctorId?: string;
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
  name: string;
  crm: string;
  specialty: string;
  email: string;
  phone: string;
  avatar?: string;
  availableTimes: DoctorSchedule[];
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
  patientPassword?: string;
  patientPasswordSet?: boolean;
}

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  date: string;
  time: string;
  type: 'Consulta' | 'Retorno' | 'Procedimento' | 'Telemedicina';
  status: AppointmentStatus;
  room?: string;
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
