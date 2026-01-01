
import { Patient, Doctor, Appointment, MedicalRecord, User, UserRole } from '../types';
import { MOCK_PATIENTS, MOCK_DOCTORS, MOCK_APPOINTMENTS } from '../constants';

const DB_KEY = 'medcore_pro_db_v2';

interface AppDatabase {
  users: User[];
  patients: Patient[];
  doctors: Doctor[];
  appointments: Appointment[];
  medicalRecords: MedicalRecord[];
  lastBackup?: string;
}

export const storage = {
  init: (): AppDatabase => {
    const saved = localStorage.getItem(DB_KEY);
    if (saved) return JSON.parse(saved);
    
    const initialDB: AppDatabase = {
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
    storage.save(initialDB);
    return initialDB;
  },

  save: (db: AppDatabase) => {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
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
          const data = e.target?.result as string;
          localStorage.setItem(DB_KEY, data);
          resolve();
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsText(file);
    });
  }
};
