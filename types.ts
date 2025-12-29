
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

export interface AnamnesisForm {
  id: string;
  patientId: string;
  date: string;
  questions: {
    question: string;
    answer: string;
  }[];
}
