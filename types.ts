
export enum UserRole {
  ADMIN = 'admin',
  DOCTOR = 'doctor'
}

export interface User {
  id: string;
  username: string;
  password: string; // Em produção, usar hash
  name: string;
  role: UserRole;
  doctorId?: string; // Vínculo se o usuário for um médico
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
  url: string; // Base64 ou URL fictícia para este ambiente
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
  healthInsurance?: string;
  bloodType?: string;
  allergies: string[];
  history: string;
  preExistingConditions: string[];
  createdAt: string;
  primaryDoctorId: string; // Vínculo principal para controle de acesso
  files: MedicalFile[]; // Nova lista de documentos
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
  senha_acesso: string; // Hash da senha para acesso sigiloso
  data_criacao: string;
}
