
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

  // Busca assíncrona com tratamento de erro silencioso para evitar travamentos (401)
  fetchFromCloud: async (): Promise<Partial<AppDatabase>> => {
    try {
      // Fazemos o fetch um por um para isolar erros de permissão de tabelas específicas
      const cloudData: Partial<AppDatabase> = {};
      
      const patientsRes = await supabase.from('patients').select('*');
      if (!patientsRes.error) cloudData.patients = patientsRes.data;

      const doctorsRes = await supabase.from('doctors').select('*');
      if (!doctorsRes.error) cloudData.doctors = doctorsRes.data;

      const appointmentsRes = await supabase.from('appointments').select('*');
      if (!appointmentsRes.error) cloudData.appointments = appointmentsRes.data;

      const usersRes = await supabase.from('users').select('*');
      if (!usersRes.error) cloudData.users = usersRes.data;

      return cloudData;
    } catch (e) {
      // Em caso de 401 ou qualquer erro de rede, retornamos vazio para usar o local
      console.warn("Supabase Sync: Acesso negado ou erro de rede. Usando dados locais.");
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

  syncToCloud: async (db: AppDatabase) => {
    try {
      // Tenta persistir na nuvem
      if (db.patients?.length > 0) await supabase.from('patients').upsert(db.patients);
      if (db.doctors?.length > 0) await supabase.from('doctors').upsert(db.doctors);
      if (db.appointments?.length > 0) await supabase.from('appointments').upsert(db.appointments);
      if (db.users?.length > 0) await supabase.from('users').upsert(db.users);
    } catch (e) {
      console.error("Erro na sincronização cloud:", e);
      throw e; // Lança para que o App saiba que está offline
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
