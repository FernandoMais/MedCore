import { createHmac } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const NONCE_KEY = 'patient_access_enrollment';

export function validateProjects(url, sourceRef, targetRef) {
  if (!/^[a-z0-9]+$/.test(sourceRef || '') || !/^[a-z0-9]+$/.test(targetRef || '')) {
    throw new Error('Informe --source-ref e --target-ref válidos.');
  }
  if (sourceRef === targetRef) throw new Error('Origem e destino devem ser projetos diferentes.');
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('URL do destino inválida.'); }
  if (parsed.origin !== `https://${targetRef}.supabase.co`
    || !['', '/'].includes(parsed.pathname) || parsed.search || parsed.hash
    || parsed.username || parsed.password) {
    throw new Error('A URL configurada não corresponde ao projeto de destino confirmado.');
  }
}

export function enrollmentHash(key, clinicId, patientId, nonce) {
  return createHmac('sha256', key)
    .update(`patient-enrollment:${clinicId}:${patientId}:${nonce}`)
    .digest('hex');
}

export function validateEnrollment(row, patient, user, staffBinding) {
  const nonce = user?.app_metadata?.[NONCE_KEY];
  if (!row || !patient || !user || staffBinding
    || row.patient_id !== patient.id || row.clinic_id !== patient.clinicId
    || row.auth_user_id !== user.id
    || patient.authUserId !== null
    || !patient.email || !user.email
    || patient.email.trim().toLowerCase() !== user.email.trim().toLowerCase()
    || typeof nonce !== 'string' || !/^[a-f0-9]{64}$/.test(nonce)
    || !/^[a-f0-9]{64}$/.test(row.nonce_hash || '')) {
    throw new Error('Vínculo pendente inconsistente. Nenhuma correção automática de identidade é permitida.');
  }
  return nonce;
}

export async function repairEnrollments(client, key, apply = false) {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const result = await client.from('patient_access_enrollments')
      .select('patient_id,clinic_id,auth_user_id,nonce_hash')
      .order('patient_id').range(offset, offset + 499);
    if (result.error || !Array.isArray(result.data)) {
      throw new Error('Não foi possível ler os vínculos privados no destino. Aplique a migração antes.');
    }
    rows.push(...result.data);
    if (result.data.length < 500) break;
  }

  // Validate every identity before the first write. Do not disclose identity
  // fields or the service-owned nonce in logs or exported reports.
  const changes = [];
  for (const row of rows) {
    const [patient, auth, staff] = await Promise.all([
      client.from('patients').select('id,clinicId,email,authUserId')
        .eq('id', row.patient_id).eq('clinicId', row.clinic_id).maybeSingle(),
      client.auth.admin.getUserById(row.auth_user_id),
      client.from('users').select('id').eq('authUserId', row.auth_user_id).maybeSingle(),
    ]);
    if (patient.error || auth.error || staff.error) {
      throw new Error('Não foi possível conferir uma identidade no destino. Operação interrompida.');
    }
    const nonce = validateEnrollment(row, patient.data, auth.data?.user, staff.data);
    const hash = enrollmentHash(key, row.clinic_id, row.patient_id, nonce);
    if (hash !== row.nonce_hash) changes.push({ row, hash });
  }

  let updated = 0;
  if (apply) {
    for (const { row, hash } of changes) {
      const result = await client.from('patient_access_enrollments')
        .update({ nonce_hash: hash })
        .eq('patient_id', row.patient_id).eq('clinic_id', row.clinic_id)
        .eq('auth_user_id', row.auth_user_id).eq('nonce_hash', row.nonce_hash)
        .select('patient_id').maybeSingle();
      if (result.error || !result.data) {
        throw new Error('Correção interrompida por falha ou alteração concorrente. Confira o destino e repita a simulação; alterações anteriores podem ter sido aplicadas.');
      }
      updated++;
    }
  }
  return { checked: rows.length, changes: changes.length, updated, applied: apply };
}

async function main() {
  const args = process.argv.slice(2);
  const allowed = new Set(['--source-ref', '--target-ref', '--apply']);
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (!allowed.has(flag) || Object.hasOwn(options, flag)) throw new Error('Argumentos inválidos.');
    if (flag === '--apply') options[flag] = true;
    else {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error('Identificador de projeto ausente.');
      options[flag] = value;
    }
  }
  const url = process.env.MIGRATION_TARGET_SUPABASE_URL;
  const key = process.env.MIGRATION_TARGET_SERVICE_ROLE_KEY;
  validateProjects(url, options['--source-ref'], options['--target-ref']);
  if (!key?.trim()) throw new Error('Configure a chave service_role do destino no ambiente seguro, nunca no código.');
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const result = await repairEnrollments(client, key, options['--apply'] === true);
  console.log(JSON.stringify(result));
  console.log(result.applied
    ? 'Correção concluída somente no destino. Contas, senhas e origem não foram alteradas.'
    : 'Simulação: nenhum dado foi alterado. Revise o destino antes de usar --apply.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    // Do not print Supabase responses, URLs, metadata or credentials.
    console.error(error.message);
    process.exitCode = 1;
  });
}