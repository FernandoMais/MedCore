
import { Patient, Gender, Appointment, AppointmentStatus, Doctor } from './types';

export const MOCK_DOCTORS: Doctor[] = [
  {
    id: 'd1',
    name: 'Dr. Ricardo Souza',
    crm: '123456/SP',
    specialty: 'Cardiologia',
    email: 'ricardo@medcore.com',
    phone: '(11) 91234-5678',
    availableTimes: [
      { dayOfWeek: 'Segunda', startTime: '08:00', endTime: '18:00' },
      { dayOfWeek: 'Quarta', startTime: '08:00', endTime: '18:00' },
      { dayOfWeek: 'Sexta', startTime: '08:00', endTime: '14:00' }
    ]
  },
  {
    id: 'd2',
    name: 'Dra. Ana Beatriz',
    crm: '654321/SP',
    specialty: 'Pediatria',
    email: 'ana@medcore.com',
    phone: '(11) 98765-4321',
    availableTimes: [
      { dayOfWeek: 'Terça', startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 'Quinta', startTime: '09:00', endTime: '17:00' }
    ]
  },
  {
    id: 'd3',
    name: 'Dr. Paulo Mendes',
    crm: '112233/SP',
    specialty: 'Clínica Geral',
    email: 'paulo@medcore.com',
    phone: '(11) 95555-4444',
    availableTimes: [
      { dayOfWeek: 'Segunda', startTime: '13:00', endTime: '20:00' },
      { dayOfWeek: 'Terça', startTime: '13:00', endTime: '20:00' },
      { dayOfWeek: 'Quarta', startTime: '13:00', endTime: '20:00' }
    ]
  }
];

export const MOCK_PATIENTS: Patient[] = [
  {
    id: '1',
    name: 'João Silva',
    birthDate: '1985-05-15',
    gender: Gender.MALE,
    cpf: '123.456.789-00',
    email: 'joao@email.com',
    phone: '(11) 98888-7777',
    address: 'Rua das Palmeiras, 123, São Paulo - SP',
    healthInsurance: 'Unimed',
    bloodType: 'O+',
    allergies: ['Penicilina', 'Dipirona'],
    history: 'Hipertensão leve controlada.',
    preExistingConditions: ['Hipertensão', 'Obesidade Grau I'],
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
    address: 'Av. Brasil, 450, apto 22, São Paulo - SP',
    healthInsurance: 'Bradesco Saúde',
    bloodType: 'A-',
    allergies: [],
    history: 'Histórico de asma na infância.',
    preExistingConditions: ['Asma'],
    createdAt: '2023-02-15'
  },
  {
    id: '3',
    name: 'Carlos Santos',
    birthDate: '1970-01-30',
    gender: Gender.MALE,
    cpf: '444.555.666-00',
    email: 'carlos@email.com',
    phone: '(11) 96666-5555',
    address: 'Rua Bela Cintra, 1000, São Paulo - SP',
    healthInsurance: 'SulAmérica',
    bloodType: 'B+',
    allergies: ['Iodo', 'Frutos do Mar'],
    history: 'Paciente diabético tipo 2.',
    preExistingConditions: ['Diabetes Mellitus Tipo 2', 'Glaucoma'],
    createdAt: '2024-01-10'
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
  },
  {
    id: 'a3',
    patientId: '3',
    doctorId: 'd1',
    date: new Date().toISOString().split('T')[0],
    time: '14:00',
    type: 'Consulta',
    status: AppointmentStatus.CONFIRMED,
    room: 'Consultório 01'
  }
];
