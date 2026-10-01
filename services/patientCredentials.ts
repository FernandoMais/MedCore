export const normalizeCpf = (value: string): string => value.replace(/\D/g, '');

export function isValidCpf(value: string): boolean {
  const cpf = normalizeCpf(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  for (let size = 9; size <= 10; size++) {
    let sum = 0;
    for (let i = 0; i < size; i++) sum += Number(cpf[i]) * (size + 1 - i);
    const digit = (sum * 10) % 11 % 10;
    if (digit !== Number(cpf[size])) return false;
  }
  return true;
}

export const isValidPatientPassword = (password: string): boolean =>
  password.length >= 8 && password.length <= 128;

/** Legacy portal credentials must never leave input fields or enter backups. */
export function removeLegacyPatientPassword<T extends object>(patient: T): T {
  const clean = { ...patient } as T & { patientPassword?: unknown };
  delete clean.patientPassword;
  return clean;
}