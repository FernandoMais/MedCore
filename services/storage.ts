
import { Patient, Doctor, Appointment, MedicalRecord, User, UserRole } from '../types';
import { MOCK_PATIENTS, MOCK_DOCTORS, MOCK_APPOINTMENTS } from '../constants';
import { supabase } from './supabase';

const DB_KEY = 'medcore_pro_db_v2';

export interface AppDatabase {
  users: User[];
  patients: Patient[];
  doctors: Doctor[];
  appointments: Appointment[];
  medicalRecords: MedicalRecord[];
  lastBackup?: string;
}

const DEFAULT_DB: AppDatabase = {
  users: [
    { id: 'u1', username: 'admin', password: '123', name: 'Administrador MedCore', role: UserRole.ADMIN },
    { id: 'u2', username: 'ricardo', password: '123', name: 'Dr. Ricardo Souza', role: UserRole.DOCTOR, doctorId: 'd1' },
    { id: 'u3', username: 'ana', password: '123', name: 'Dra. Ana Beatriz', role: UserRole.DOCTOR, doctorId: 'd2' }
  ],
  patients: MOCK_PATIENTS,
  doctors: MOCK_DOCTORS,
  appointments: MOCK_APPOINTMENTS,
  medicalRecords: [],
};

export const storage = {
  // Inicialização síncrona com garantia de estrutura completa
  initLocal: (): AppDatabase => {
    try {
      const saved = localStorage.getItem(DB_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Garante que todas as propriedades obrigatórias existam como arrays
        return {
          users: Array.isArray(parsed.users) ? parsed.users : DEFAULT_DB.users,
          patients: Array.isArray(parsed.patients) ? parsed.patients : DEFAULT_DB.patients,
          doctors: Array.isArray(parsed.doctors) ? parsed.doctors : DEFAULT_DB.doctors,
          appointments: Array.isArray(parsed.appointments) ? parsed.appointments : DEFAULT_DB.appointments,
          medicalRecords: Array.isArray(parsed.medicalRecords) ? parsed.medicalRecords : DEFAULT_DB.medicalRecords,
          lastBackup: parsed.lastBackup
        };
      }
    } catch (e) {
      console.error("Erro storage local:", e);
    }
    return DEFAULT_DB;
  },

  // Busca assíncrona garantindo o retorno de arrays vazios em vez de null/undefined
  fetchFromCloud: async (): Promise<Partial<AppDatabase>> => {
    try {
      const [
        { data: patients },
        { data: doctors },
        { data: appointments },
        { data: users }
      ] = await Promise.all([
        supabase.from('patients').select('*'),
        supabase.from('doctors').select('*'),
        supabase.from('appointments').select('*'),
        supabase.from('users').select('*')
      ]);

      const cloudData: Partial<AppDatabase> = {};
      if (patients) cloudData.patients = patients;
      if (doctors) cloudData.doctors = doctors;
      if (appointments) cloudData.appointments = appointments;
      if (users) cloudData.users = users;

      return cloudData;
    } catch (e) {
      console.error("Erro ao sincronizar com nuvem:", e);
      return {};
    }
  },

  save: (db: AppDatabase) => {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(db));
    } catch (e) {
      console.error("Falha ao salvar localmente:", e);
    }
  },

  // Sincronização persistente com verificações de segurança contra propriedades indefinidas
  syncToCloud: async (db: AppDatabase) => {
    try {
      const syncTasks = [];
      
      if (db.patients && db.patients.length > 0) 
        syncTasks.push(supabase.from('patients').upsert(db.patients));
      
      if (db.doctors && db.doctors.length > 0) 
        syncTasks.push(supabase.from('doctors').upsert(db.doctors));
      
      if (db.appointments && db.appointments.length > 0) 
        syncTasks.push(supabase.from('appointments').upsert(db.appointments));
      
      if (db.users && db.users.length > 0) 
        syncTasks.push(supabase.from('users').upsert(db.users));

      if (syncTasks.length > 0) {
        await Promise.all(syncTasks);
      }
    } catch (e) {
      console.error("Erro na sincronização cloud:", e);
    }
  },

  exportBackup: () => {
    const data = localStorage.getItem(DB_KEY);
    if (!data) return;
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `medcore_full_backup_${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  },

  importBackup: (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const data = JSON.parse(content);
          if (data && (data.patients || data.doctors || data.users)) {
            localStorage.setItem(DB_KEY, content);
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
