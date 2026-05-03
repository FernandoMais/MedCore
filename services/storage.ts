
import { Patient, Doctor, Appointment, MedicalRecord, User, UserRole, Medication, SigilousNote } from '../types';
import { MOCK_PATIENTS, MOCK_DOCTORS, MOCK_APPOINTMENTS } from '../constants';
import { supabase } from './supabase';

const DB_KEY = 'medcore_pro_db_v3';

export interface AppDatabase {
  users: User[];
  patients: Patient[];
  doctors: Doctor[];
  appointments: Appointment[];
  medicalRecords: MedicalRecord[];
  medications: Medication[];
  sigilousNotes: SigilousNote[];
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
  medications: [
    { id: 'm1', name: 'Amoxicilina', dosage: '500mg', posology: 'Tomar 1 comprimido de 8 em 8 horas', period: '7 dias', purpose: 'Antibiótico', manufacturer: 'Eurofarma' },
    { id: 'm2', name: 'Dipirona', dosage: '500mg', posology: '1 comprimido se dor ou febre', period: 'Até de 6 em 6 horas', purpose: 'Analgésico e Antitérmico', manufacturer: 'Medley' }
  ],
  sigilousNotes: [],
};

export const storage = {
  initLocal: (): AppDatabase => {
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
          users: finalUsers,
          patients: Array.isArray(parsed.patients) ? parsed.patients : DEFAULT_DB.patients,
          doctors: Array.isArray(parsed.doctors) ? parsed.doctors : DEFAULT_DB.doctors,
          appointments: Array.isArray(parsed.appointments) ? parsed.appointments : DEFAULT_DB.appointments,
          medicalRecords: Array.isArray(parsed.medicalRecords) ? parsed.medicalRecords : DEFAULT_DB.medicalRecords,
          medications: Array.isArray(parsed.medications) ? parsed.medications : DEFAULT_DB.medications,
          sigilousNotes: Array.isArray(parsed.sigilousNotes) ? parsed.sigilousNotes : DEFAULT_DB.sigilousNotes,
          lastBackup: parsed.lastBackup
        };
      }
    } catch (e) {
      console.error("Erro storage local:", e);
    }
    return DEFAULT_DB;
  },

  fetchFromCloud: async (): Promise<Partial<AppDatabase>> => {
    try {
      const cloudData: Partial<AppDatabase> = {};
      const assignIfNonEmpty = <K extends keyof AppDatabase>(key: K, res: any) => {
        if (!res.error && Array.isArray(res.data) && res.data.length > 0) {
          (cloudData as any)[key] = res.data;
        }
      };

      assignIfNonEmpty('patients', await supabase.from('patients').select('*'));
      assignIfNonEmpty('doctors', await supabase.from('doctors').select('*'));
      assignIfNonEmpty('appointments', await supabase.from('appointments').select('*'));
      assignIfNonEmpty('users', await supabase.from('users').select('*'));
      assignIfNonEmpty('medications', await supabase.from('medications').select('*'));
      assignIfNonEmpty('sigilousNotes', await supabase.from('sigilous_notes').select('*'));

      return cloudData;
    } catch (e) {
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
      if (db.patients?.length > 0) await supabase.from('patients').upsert(db.patients);
      if (db.doctors?.length > 0) await supabase.from('doctors').upsert(db.doctors);
      if (db.appointments?.length > 0) await supabase.from('appointments').upsert(db.appointments);
      if (db.users?.length > 0) await supabase.from('users').upsert(db.users);
      if (db.medications?.length > 0) await supabase.from('medications').upsert(db.medications);
      if (db.sigilousNotes?.length > 0) await supabase.from('sigilous_notes').upsert(db.sigilousNotes);
    } catch (e) {
      console.error("Erro na sincronização cloud:", e);
      throw e;
    }
  },

  saveEvolutionToCloud: async (evolution: any) => {
    return await supabase.from('evolucao_paciente').insert([evolution]);
  },

  saveSigilousNoteToCloud: async (note: SigilousNote) => {
    return await supabase.from('sigilous_notes').insert([note]);
  },

  exportBackup: (db?: AppDatabase) => {
    const data = JSON.stringify(db ? { ...db, lastBackup: new Date().toISOString() } : JSON.parse(localStorage.getItem(DB_KEY) || 'null'));
    if (!data || data === 'null') {
      alert("Nenhum dado disponível para exportar.");
      return;
    }
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
          if (data && Array.isArray(data.patients) && Array.isArray(data.doctors) && Array.isArray(data.users)) {
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
