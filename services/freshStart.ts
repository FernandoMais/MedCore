/// <reference types="vite/client" />
import type { AppDatabase } from './storage';

export const freshStartEnabled = import.meta.env.VITE_FRESH_START === 'true';
export const freshTargetRef = (import.meta.env.VITE_FRESH_TARGET_REF || '').trim();
export const freshClinicId = (import.meta.env.VITE_CLINIC_ID || '').trim();

export function isApprovedFreshTarget(url?: string): boolean {
  if (!freshStartEnabled) return true;
  try {
    const parsed = new URL(url || '');
    return /^[a-z0-9]{20}$/.test(freshTargetRef)
      && Boolean(freshClinicId)
      && parsed.origin === `https://${freshTargetRef}.supabase.co`
      && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

export function localDatabaseKey(): string {
  if (!freshStartEnabled) return 'medcore_pro_db_v3';
  if (!freshTargetRef || !freshClinicId) {
    throw new Error('A nova instalação precisa do projeto e da clínica configurados.');
  }
  // Never read, overwrite, or migrate the previous installation's browser data.
  return `medcore_pro_fresh_${freshTargetRef}_${freshClinicId}`;
}

export function emptyDatabase(): AppDatabase {
  return {
    users: [], patients: [], doctors: [], appointments: [],
    medicalRecords: [], medications: [], sigilousNotes: [],
    financial: {
      transactions: [], categories: [], costCenters: [], paymentMethods: [],
      bankAccounts: [], insurancePlans: [], repasses: [], cashClosures: [],
      reconciliations: [], billingRecords: [],
      settings: [{
        clinicId: freshClinicId, clinicName: 'Minha clínica', currency: 'BRL',
        allowNegativeCash: false, sendPaymentNotifications: false,
      }],
    },
  };
}