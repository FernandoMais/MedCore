
import { Patient, Gender, Appointment, AppointmentStatus } from './types';

export const MOCK_PATIENTS: Patient[] = [
  {
    id: '1',
    name: 'João Silva',
    birthDate: '1985-05-15',
    gender: Gender.MALE,
    cpf: '123.456.789-00',
    email: 'joao@email.com',
    phone: '(11) 98888-7777',
    healthInsurance: 'Unimed',
    allergies: ['Penicilina'],
    history: 'Hipertensão leve controlada.',
    createdAt: '2023-01-01'
  },
  {
    id: '2',
    name: 'Maria Oliveira',
    birthDate: '1992-10-22',
    gender: Gender.FEMALE,
    cpf: '987.654.321-11',
    email: 'maria@email.com',
    phone: '(11) 97777-6666',
    healthInsurance: 'Bradesco Saúde',
    allergies: [],
    history: 'Histórico de asma na infância.',
    createdAt: '2023-02-15'
  }
];

export const MOCK_APPOINTMENTS: Appointment[] = [
  {
    id: 'a1',
    patientId: '1',
    doctorId: 'd1',
    date: new Date().toISOString().split('T')[0],
    time: '09:00',
    type: 'Consulta',
    status: AppointmentStatus.CONFIRMED,
    room: 'Consultório 01'
  },
  {
    id: 'a2',
    patientId: '2',
    doctorId: 'd1',
    date: new Date().toISOString().split('T')[0],
    time: '10:30',
    type: 'Telemedicina',
    status: AppointmentStatus.SCHEDULED,
    room: 'Virtual'
  }
];
