// @ts-ignore The Supabase Edge runtime resolves npm: imports directly.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const edgeRuntime = globalThis as typeof globalThis & {
  Deno: {
    env: { get(name: string): string | undefined };
    serve(handler: (request: Request) => Response | Promise<Response>): void;
  };
};

type JsonObject = Record<string, unknown>;

const PATIENT_FIELDS = new Set([
  "name",
  "birthDate",
  "gender",
  "cpf",
  "email",
  "phone",
  "address",
  "streetName",
  "streetNumber",
  "neighborhood",
  "city",
  "zipCode",
  "healthInsurance",
  "bloodType",
  "allergies",
  "history",
  "preExistingConditions",
  "primaryDoctorId",
  "files",
  "paymentValue",
  "paymentSender",
  "selfRegistered",
]);

const GENERIC_LOGIN_ERROR = "CPF ou senha inválidos.";
const GENERIC_RECOVERY_MESSAGE = "Solicitação recebida.";
const REGISTRATION_CONFLICT_MESSAGE =
  "Não foi possível concluir o cadastro. Se você já possui conta, entre em contato com a clínica.";
const ENROLLMENT_METADATA_KEY = "patient_access_enrollment";
const STAFF_ROLES = new Set(["admin", "doctor", "collaborator"]);
const RATE_WINDOW_SECONDS = 15 * 60;

interface Settings {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
  clinicId: string;
  allowedOrigins: Set<string>;
}

interface PatientRow {
  id: string;
  clinicId: string;
  cpf: string;
  email: string;
  authUserId: string | null;
  portalEnrollmentPending: boolean;
}

interface PatientEnrollment {
  patient_id: string;
  clinic_id: string;
  auth_user_id: string;
  nonce_hash: string;
}

function readSettings(): Settings {
  const url = edgeRuntime.Deno.env.get("SUPABASE_URL")?.trim();
  const anonKey = edgeRuntime.Deno.env.get("SUPABASE_ANON_KEY")?.trim();
  const serviceRoleKey = edgeRuntime.Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  const clinicId = edgeRuntime.Deno.env.get("PATIENT_CLINIC_ID")?.trim();
  const rawOrigins = edgeRuntime.Deno.env.get("PATIENT_APP_ORIGINS") ?? "";
  const allowedOrigins = new Set<string>();

  for (const raw of rawOrigins.split(",")) {
    const value = raw.trim();
    if (!value) continue;
    const parsed = new URL(value);
    if (
      !["https:", "http:"].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      parsed.origin !== value.replace(/\/$/, "")
    ) {
      throw new Error("PATIENT_APP_ORIGINS must contain only exact URL origins.");
    }
    allowedOrigins.add(parsed.origin);
  }

  if (!url || !anonKey || !serviceRoleKey || !clinicId || allowedOrigins.size === 0) {
    throw new Error("Patient access function configuration is incomplete.");
  }
  return { url, anonKey, serviceRoleKey, clinicId, allowedOrigins };
}

function json(body: JsonObject, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

function makeClients(settings: Settings): {
  service: SupabaseClient;
  anon: SupabaseClient;
} {
  return {
    service: createClient(settings.url, settings.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
    anon: createClient(settings.url, settings.anonKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    }),
  };
}

function normalizeCpf(value: unknown): string {
  return typeof value === "string" ? value.replace(/\D/g, "") : "";
}

export function isValidCpf(value: unknown): boolean {
  if (typeof value !== "string" || !/^[\d.\-\s]+$/.test(value)) return false;
  const cpf = normalizeCpf(value);
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (length: number, factor: number) => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(cpf[i]) * (factor - i);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return digit(9, 10) === Number(cpf[9]) && digit(10, 11) === Number(cpf[10]);
}

function isEmail(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 254) return false;
  const email = value.trim();
  const [local, domain, ...rest] = email.split("@");
  return rest.length === 0 &&
    !!local &&
    local.length <= 64 &&
    !/\s/.test(local) &&
    /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local) &&
    !!domain &&
    domain.length <= 253 &&
    domain.includes(".") &&
    domain.split(".").every((label) =>
      label.length > 0 && label.length <= 63 &&
      /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(label)
    );
}

export function isStrongPassword(value: unknown): value is string {
  return typeof value === "string" &&
    value.length >= 8 &&
    value.length <= 128;
}

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredText(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.trim().length > 0 &&
    value.trim().length <= maxLength;
}

function optionalText(value: unknown, maxLength: number): boolean {
  return value === undefined || value === null ||
    (typeof value === "string" && value.length <= maxLength);
}

export function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validStringArray(value: unknown, maxItems = 100): value is string[] {
  return Array.isArray(value) && value.length <= maxItems &&
    value.every((item) => typeof item === "string" && item.length <= 2000);
}

function sanitizePatient(input: unknown): JsonObject | null {
  if (!isPlainObject(input)) return null;
  if (Object.keys(input).some((key) => !PATIENT_FIELDS.has(key))) return null;

  if (
    !requiredText(input.name, 200) ||
    !isValidCpf(input.cpf) ||
    !validDate(input.birthDate) ||
    !isEmail(input.email) ||
    !requiredText(input.phone, 40) ||
    !requiredText(input.streetName, 200) ||
    !requiredText(input.city, 120) ||
    !requiredText(input.paymentValue, 80) ||
    !requiredText(input.paymentSender, 200)
  ) return null;

  const optionalTextFields: Array<[string, number]> = [
    ["gender", 40],
    ["address", 1000],
    ["streetNumber", 40],
    ["neighborhood", 120],
    ["zipCode", 20],
    ["healthInsurance", 200],
    ["bloodType", 20],
    ["history", 10000],
    ["primaryDoctorId", 200],
    ["paymentValue", 80],
    ["paymentSender", 200],
  ];
  if (optionalTextFields.some(([key, max]) => !optionalText(input[key], max))) return null;
  if (input.gender !== undefined && input.gender !== "Masculino" &&
    input.gender !== "Feminino" && input.gender !== "Outro") return null;
  if (input.allergies !== undefined && !validStringArray(input.allergies)) return null;
  if (
    input.preExistingConditions !== undefined &&
    !validStringArray(input.preExistingConditions)
  ) return null;
  if (input.files !== undefined && (!Array.isArray(input.files) || input.files.length > 0)) {
    return null;
  }
  if (input.selfRegistered !== undefined && input.selfRegistered !== true) return null;

  const cpfDigits = normalizeCpf(input.cpf);
  const cpf = `${cpfDigits.slice(0, 3)}.${cpfDigits.slice(3, 6)}.${cpfDigits.slice(6, 9)}-${cpfDigits.slice(9)}`;
  const email = String(input.email).trim().toLowerCase();
  if (email.endsWith(".local")) return null;

  return {
    name: String(input.name).trim(),
    birthDate: input.birthDate,
    gender: input.gender ?? "Outro",
    cpf,
    email,
    phone: String(input.phone).trim(),
    address: typeof input.address === "string" ? input.address.trim() : "",
    streetName: String(input.streetName).trim(),
    streetNumber: typeof input.streetNumber === "string" ? input.streetNumber.trim() : "",
    neighborhood: typeof input.neighborhood === "string" ? input.neighborhood.trim() : "",
    city: String(input.city).trim(),
    zipCode: typeof input.zipCode === "string" ? input.zipCode.trim() : "",
    healthInsurance: typeof input.healthInsurance === "string" ? input.healthInsurance : "",
    bloodType: typeof input.bloodType === "string" ? input.bloodType : "",
    allergies: input.allergies ?? [],
    history: typeof input.history === "string" ? input.history : "",
    preExistingConditions: input.preExistingConditions ?? [],
    createdAt: new Date().toISOString(),
    primaryDoctorId: typeof input.primaryDoctorId === "string" ? input.primaryDoctorId : "",
    files: [],
    paymentValue: String(input.paymentValue).trim(),
    paymentSender: String(input.paymentSender).trim(),
    selfRegistered: true,
  };
}

function validatedRedirect(value: unknown, settings: Settings): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const parsed = new URL(value);
    if (
      !["https:", "http:"].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      !settings.allowedOrigins.has(parsed.origin)
    ) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

async function hmacHex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function createEnrollmentNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function enrollmentNonceHash(
  settings: Settings,
  patient: PatientRow,
  nonce: string,
): Promise<string> {
  return await hmacHex(
    settings.serviceRoleKey,
    `patient-enrollment:${settings.clinicId}:${patient.id}:${nonce}`,
  );
}

async function findPendingEnrollment(
  service: SupabaseClient,
  patient: PatientRow,
): Promise<PatientEnrollment | null> {
  const { data, error } = await service
    .from("patient_access_enrollments")
    .select("patient_id,clinic_id,auth_user_id,nonce_hash")
    .eq("patient_id", patient.id)
    .eq("clinic_id", patient.clinicId)
    .maybeSingle();
  if (error) throw error;
  return data as PatientEnrollment | null;
}

async function verifyPendingEnrollment(
  service: SupabaseClient,
  settings: Settings,
  patient: PatientRow,
  enrollment: PatientEnrollment,
): Promise<{ nonce: string; authUserId: string } | null> {
  if (
    enrollment.patient_id !== patient.id ||
    enrollment.clinic_id !== patient.clinicId ||
    (patient.authUserId && patient.authUserId !== enrollment.auth_user_id)
  ) return null;

  const { data, error } = await service.auth.admin.getUserById(enrollment.auth_user_id);
  const authUser = data.user;
  const appMetadata = isPlainObject(authUser?.app_metadata) ? authUser.app_metadata : {};
  const nonce = appMetadata[ENROLLMENT_METADATA_KEY];
  if (
    error ||
    !authUser ||
    authUser.email?.toLowerCase() !== patient.email.toLowerCase() ||
    typeof nonce !== "string" ||
    await enrollmentNonceHash(settings, patient, nonce) !== enrollment.nonce_hash
  ) return null;
  return { nonce, authUserId: authUser.id };
}

async function persistPendingEnrollment(
  service: SupabaseClient,
  settings: Settings,
  patient: PatientRow,
  authUserId: string,
  nonce: string,
): Promise<boolean> {
  const nonceHash = await enrollmentNonceHash(settings, patient, nonce);
  const { error } = await service.from("patient_access_enrollments").insert({
    patient_id: patient.id,
    clinic_id: patient.clinicId,
    auth_user_id: authUserId,
    nonce_hash: nonceHash,
  });
  return !error;
}

async function updateEnrollmentDisplayFlag(
  service: SupabaseClient,
  patient: PatientRow,
  pending: boolean,
): Promise<boolean> {
  const { data, error } = await service
    .from("patients")
    .update({ portalEnrollmentPending: pending })
    .eq("id", patient.id)
    .eq("clinicId", patient.clinicId)
    .select("id")
    .maybeSingle();
  return !error && data?.id === patient.id;
}

async function clearPendingEnrollment(
  service: SupabaseClient,
  patient: PatientRow,
  enrollment: PatientEnrollment,
  nonce: string,
): Promise<void> {
  await service.from("patient_access_enrollments")
    .delete()
    .eq("patient_id", patient.id)
    .eq("clinic_id", patient.clinicId)
    .eq("auth_user_id", enrollment.auth_user_id);

  const { data, error } = await service.auth.admin.getUserById(enrollment.auth_user_id);
  const appMetadata = isPlainObject(data.user?.app_metadata) ? { ...data.user.app_metadata } : {};
  if (
    error ||
    appMetadata[ENROLLMENT_METADATA_KEY] !== nonce
  ) return;
  appMetadata[ENROLLMENT_METADATA_KEY] = null;
  await service.auth.admin.updateUserById(enrollment.auth_user_id, {
    app_metadata: appMetadata,
  });
}

async function sendPendingEnrollmentRecovery(
  service: SupabaseClient,
  anon: SupabaseClient,
  authUserId: string,
  email: string,
  redirectTo: string,
): Promise<boolean> {
  const { data, error } = await service.auth.admin.getUserById(authUserId);
  if (error || data.user?.email?.toLowerCase() !== email.toLowerCase()) return false;
  const result = await anon.auth.resetPasswordForEmail(email, { redirectTo });
  return !result.error;
}

function createTemporaryPassword(): string {
  return `Aa!${createEnrollmentNonce()}9`;
}

function requestIp(request: Request): string {
  const trustedHeader = request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0];
  return trustedHeader?.trim().slice(0, 128) || "unknown";
}

async function permitAttempt(
  service: SupabaseClient,
  settings: Settings,
  request: Request,
  action: string,
  cpf: string,
): Promise<boolean> {
  const ipBucket = await hmacHex(
    settings.serviceRoleKey,
    `${settings.clinicId}:${action}:ip:${requestIp(request)}`,
  );
  const cpfBucket = await hmacHex(
    settings.serviceRoleKey,
    `${settings.clinicId}:${action}:cpf:${cpf || "invalid"}`,
  );
  for (const bucket of [ipBucket, cpfBucket]) {
    const { data, error } = await service.rpc("consume_patient_access_attempt", {
      p_bucket_hash: bucket,
      p_limit: 8,
      p_window_seconds: RATE_WINDOW_SECONDS,
    });
    if (error || data !== true) return false;
  }
  return true;
}

function addCorsHeaders(request: Request, settings: Settings): HeadersInit {
  const origin = request.headers.get("origin");
  if (!origin || !settings.allowedOrigins.has(origin)) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-headers":
      "authorization, content-type, apikey, x-client-info, x-supabase-api-version",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-max-age": "600",
    vary: "Origin",
  };
}

function extractBearer(request: Request): string | null {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] ?? null;
}

async function findPatientByCpf(
  service: SupabaseClient,
  clinicId: string,
  cpf: string,
): Promise<PatientRow | null> {
  const digits = normalizeCpf(cpf);
  const formatted = digits.length === 11
    ? `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
    : digits;
  const { data, error } = await service
    .from("patients")
    .select("id,clinicId,cpf,email,authUserId,portalEnrollmentPending")
    .eq("clinicId", clinicId)
    .or(`cpf.eq.${digits},cpf.eq.${formatted}`)
    .maybeSingle();
  if (error) throw error;
  return data as PatientRow | null;
}

async function linkAuthenticatedPatient(
  service: SupabaseClient,
  patient: PatientRow,
  authUserId: string,
): Promise<boolean> {
  if (patient.authUserId && patient.authUserId !== authUserId) return false;
  const { data, error } = await service
    .from("patients")
    .update({ authUserId, portalEnrollmentPending: false })
    .eq("id", patient.id)
    .eq("clinicId", patient.clinicId)
    .is("authUserId", null)
    .select("id")
    .maybeSingle();
  if (error) return false;
  if (data?.id) return true;
  const { data: current, error: readError } = await service
    .from("patients")
    .select("authUserId")
    .eq("id", patient.id)
    .eq("clinicId", patient.clinicId)
    .maybeSingle();
  return !readError && current?.authUserId === authUserId;
}

async function deleteUncommittedAuthUser(
  service: SupabaseClient,
  authUserId: string,
  email: string,
  nonce: string,
): Promise<void> {
  const { data, error: lookupError } = await service.auth.admin.getUserById(authUserId);
  const appMetadata = isPlainObject(data.user?.app_metadata) ? data.user.app_metadata : {};
  if (
    lookupError ||
    !data.user ||
    data.user.email?.toLowerCase() !== email.toLowerCase() ||
    appMetadata[ENROLLMENT_METADATA_KEY] !== nonce
  ) throw new Error("Uncommitted Auth identity ownership could not be verified.");
  const { error: deleteError } = await service.auth.admin.deleteUser(authUserId);
  if (deleteError) throw new Error("Could not roll back uncommitted Auth identity.");
}

async function register(
  body: JsonObject,
  request: Request,
  settings: Settings,
  service: SupabaseClient,
  anon: SupabaseClient,
): Promise<Response> {
  const patient = sanitizePatient(body.patient);
  const password = body.password;
  const redirectTo = validatedRedirect(body.redirectTo, settings);
  if (!patient || !isStrongPassword(password) || !redirectTo) {
    return json({ error: "Dados de cadastro inválidos." }, 400);
  }
  const cpf = normalizeCpf(patient.cpf);
  if (!(await permitAttempt(service, settings, request, "register", cpf))) {
    return json({ error: "Tente novamente mais tarde." }, 429);
  }

  let newlyCreatedAuthUserId: string | null = null;
  let enrollmentNonce: string | null = null;
  let pendingPatientId: string | null = null;
  let pendingEnrollmentPersisted = false;
  try {
    const existing = await findPatientByCpf(service, settings.clinicId, String(patient.cpf));
    if (existing) return json({ error: REGISTRATION_CONFLICT_MESSAGE }, 409);

    enrollmentNonce = createEnrollmentNonce();
    const email = String(patient.email);
    const { data: created, error: createError } = await service.auth.admin.createUser({
      email: String(patient.email),
      password: password as string,
      email_confirm: false,
      app_metadata: {
        [ENROLLMENT_METADATA_KEY]: enrollmentNonce,
      },
    });
    const authUser = created.user;
    if (createError || !authUser?.id) {
      return json({ error: REGISTRATION_CONFLICT_MESSAGE }, 409);
    }
    newlyCreatedAuthUserId = authUser.id;

    const { data: authCheck, error: authCheckError } = await service.auth.admin
      .getUserById(authUser.id);
    const appMetadata = isPlainObject(authCheck.user?.app_metadata)
      ? authCheck.user.app_metadata
      : {};
    if (
      authCheckError ||
      authCheck.user?.email?.toLowerCase() !== email.toLowerCase() ||
      authCheck.user?.email_confirmed_at ||
      appMetadata[ENROLLMENT_METADATA_KEY] !== enrollmentNonce
    ) {
      await deleteUncommittedAuthUser(
        service,
        authUser.id,
        email,
        enrollmentNonce,
      );
      newlyCreatedAuthUserId = null;
      return json({ error: REGISTRATION_CONFLICT_MESSAGE }, 409);
    }

    const patientId = `patient-${crypto.randomUUID()}`;
    pendingPatientId = patientId;
    const { error: insertError } = await service.from("patients").insert({
      id: patientId,
      ...patient,
      clinicId: settings.clinicId,
      authUserId: null,
      portalEnrollmentPending: true,
    });
    if (insertError) throw new Error("Patient registration insert failed.");

    const patientRow: PatientRow = {
      id: patientId,
      clinicId: settings.clinicId,
      cpf: String(patient.cpf),
      email,
      authUserId: null,
      portalEnrollmentPending: true,
    };
    if (!await persistPendingEnrollment(
      service,
      settings,
      patientRow,
      authUser.id,
      enrollmentNonce,
    )) throw new Error("Patient enrollment persistence failed.");
    pendingEnrollmentPersisted = true;

    const { error: resendError } = await anon.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: redirectTo },
    });
    if (resendError) throw new Error("Patient signup confirmation delivery failed.");

    pendingPatientId = null;
    newlyCreatedAuthUserId = null;
    return json({ requiresConfirmation: true });
  } catch {
    if (pendingEnrollmentPersisted) {
      return json({ error: REGISTRATION_CONFLICT_MESSAGE }, 502);
    }
    if (pendingPatientId) {
      await service.from("patients")
        .delete()
        .eq("id", pendingPatientId)
        .eq("clinicId", settings.clinicId);
    }
    if (newlyCreatedAuthUserId) {
      try {
        await deleteUncommittedAuthUser(
          service,
          newlyCreatedAuthUserId,
          String(patient.email),
          String(enrollmentNonce),
        );
      } catch {
        return json({ error: "Não foi possível concluir o cadastro." }, 500);
      }
    }
    return json({ error: REGISTRATION_CONFLICT_MESSAGE }, 500);
  }
}

async function login(
  body: JsonObject,
  request: Request,
  settings: Settings,
  service: SupabaseClient,
  anon: SupabaseClient,
): Promise<Response> {
  const cpf = normalizeCpf(body.cpf);
  const password = body.password;
  if (!(await permitAttempt(service, settings, request, "login", cpf))) {
    return json({ error: GENERIC_LOGIN_ERROR }, 429);
  }
  if (!isValidCpf(cpf) || typeof password !== "string" || password.length === 0) {
    return json({ error: GENERIC_LOGIN_ERROR }, 401);
  }

  try {
    const patient = await findPatientByCpf(service, settings.clinicId, cpf);
    if (!patient || !isEmail(patient.email)) return json({ error: GENERIC_LOGIN_ERROR }, 401);
    const { data, error } = await anon.auth.signInWithPassword({
      email: patient.email,
      password,
    });
    if (
      error ||
      !data.user?.id ||
      data.user.email?.toLowerCase() !== patient.email.toLowerCase() ||
      !data.session
    ) return json({ error: GENERIC_LOGIN_ERROR }, 401);

    let enrollment: PatientEnrollment | null = null;
    let enrollmentOwnership: { nonce: string; authUserId: string } | null = null;
    if (patient.authUserId) {
      if (patient.authUserId !== data.user.id) {
        return json({ error: GENERIC_LOGIN_ERROR }, 401);
      }
    } else {
      enrollment = await findPendingEnrollment(service, patient);
      if (!enrollment) return json({ error: GENERIC_LOGIN_ERROR }, 401);
      enrollmentOwnership = await verifyPendingEnrollment(
        service,
        settings,
        patient,
        enrollment,
      );
      if (!enrollmentOwnership || enrollmentOwnership.authUserId !== data.user.id) {
        return json({ error: GENERIC_LOGIN_ERROR }, 401);
      }
    }

    const { data: staffBinding, error: bindingError } = await service
      .from("users")
      .select("id")
      .eq("authUserId", data.user.id)
      .maybeSingle();
    if (
      bindingError ||
      staffBinding ||
      (patient.authUserId === null &&
        !await linkAuthenticatedPatient(service, patient, data.user.id))
      || (patient.authUserId !== null &&
        patient.portalEnrollmentPending &&
        !await updateEnrollmentDisplayFlag(service, patient, false))
    ) {
      return json({ error: GENERIC_LOGIN_ERROR }, 401);
    }
    if (enrollment && enrollmentOwnership) {
      await clearPendingEnrollment(service, patient, enrollment, enrollmentOwnership.nonce);
    }
    return json({
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      },
    });
  } catch {
    return json({ error: GENERIC_LOGIN_ERROR }, 401);
  }
}

async function recover(
  body: JsonObject,
  request: Request,
  settings: Settings,
  service: SupabaseClient,
  anon: SupabaseClient,
): Promise<Response> {
  const cpf = normalizeCpf(body.cpf);
  const redirectTo = validatedRedirect(body.redirectTo, settings);
  if (!redirectTo) return json({ error: "Redirecionamento inválido." }, 400);
  if (!(await permitAttempt(service, settings, request, "recover", cpf))) {
    return json({ message: GENERIC_RECOVERY_MESSAGE });
  }

  try {
    if (isValidCpf(cpf)) {
      const patient = await findPatientByCpf(service, settings.clinicId, cpf);
      if (patient && isEmail(patient.email)) {
        if (patient.authUserId) {
          await anon.auth.resetPasswordForEmail(patient.email, { redirectTo });
        } else {
          const enrollment = await findPendingEnrollment(service, patient);
          if (enrollment) {
            const ownership = await verifyPendingEnrollment(
              service,
              settings,
              patient,
              enrollment,
            );
            if (ownership) {
              await sendPendingEnrollmentRecovery(
                service,
                anon,
                ownership.authUserId,
                patient.email,
                redirectTo,
              );
            }
          }
        }
      }
    }
  } catch {
    // A recovery request intentionally has the same public result for all account states.
  }
  return json({ message: GENERIC_RECOVERY_MESSAGE });
}

async function adminReset(
  body: JsonObject,
  request: Request,
  settings: Settings,
  service: SupabaseClient,
  anon: SupabaseClient,
): Promise<Response> {
  if (!requiredText(body.patientId, 200)) {
    return json({ error: "Dados de solicitação inválidos." }, 400);
  }
  const redirectTo = validatedRedirect(body.redirectTo, settings);
  if (!redirectTo) return json({ error: "Redirecionamento inválido." }, 400);
  const token = extractBearer(request);
  if (!token) return json({ error: "Não autorizado." }, 401);

  const { data: verified, error: verifyError } = await service.auth.getUser(token);
  if (verifyError || !verified.user?.id) return json({ error: "Não autorizado." }, 401);

  const { data: staff, error: staffError } = await service
    .from("users")
    .select("id,role,clinicId,authUserId")
    .eq("authUserId", verified.user.id)
    .eq("clinicId", settings.clinicId)
    .maybeSingle();
  if (
    staffError ||
    !staff ||
    !STAFF_ROLES.has(staff.role)
  ) return json({ error: "Não autorizado." }, 403);

  const { data: patient, error: patientError } = await service
    .from("patients")
    .select("id,clinicId,cpf,email,authUserId,portalEnrollmentPending")
    .eq("id", String(body.patientId).trim())
    .eq("clinicId", settings.clinicId)
    .maybeSingle();
  if (patientError || !patient || !isEmail(patient.email)) {
    return json({ error: "Paciente não encontrado." }, 404);
  }
  const cpf = normalizeCpf(patient.cpf);
  if (!(await permitAttempt(service, settings, request, "admin-reset", cpf))) {
    return json({ error: "Tente novamente mais tarde." }, 429);
  }

  const redirectOptions = { redirectTo };
  if (patient.authUserId) {
    const result = await anon.auth.resetPasswordForEmail(patient.email, redirectOptions);
    if (result.error) return json({ error: "Não foi possível enviar a solicitação." }, 502);
    return json({ sent: true });
  }

  const existingEnrollment = await findPendingEnrollment(service, patient);
  if (existingEnrollment) {
    const ownership = await verifyPendingEnrollment(
      service,
      settings,
      patient,
      existingEnrollment,
    );
    if (!ownership) {
      return json({ error: "Não foi possível enviar a solicitação." }, 502);
    }
    if (
      !patient.portalEnrollmentPending &&
      !await updateEnrollmentDisplayFlag(service, patient as PatientRow, true)
    ) return json({ error: "Não foi possível enviar a solicitação." }, 502);
    if (!await sendPendingEnrollmentRecovery(
      service,
      anon,
      ownership.authUserId,
      patient.email,
      redirectTo,
    )) return json({ error: "Não foi possível enviar a solicitação." }, 502);
    return json({ sent: true });
  }

  const nonce = createEnrollmentNonce();
  let createdAuthUserId: string | null = null;
  let pendingPersisted = false;
  try {
    const { data: created, error: createError } = await service.auth.admin.createUser({
      email: patient.email,
      password: createTemporaryPassword(),
      email_confirm: false,
      app_metadata: { [ENROLLMENT_METADATA_KEY]: nonce },
    });
    if (createError || !created.user?.id) {
      return json({ error: "Não foi possível enviar a solicitação." }, 502);
    }
    createdAuthUserId = created.user.id;

    const { data: authCheck, error: authCheckError } = await service.auth.admin
      .getUserById(createdAuthUserId);
    const appMetadata = isPlainObject(authCheck.user?.app_metadata)
      ? authCheck.user.app_metadata
      : {};
    if (
      authCheckError ||
      authCheck.user?.email?.toLowerCase() !== patient.email.toLowerCase() ||
      authCheck.user?.email_confirmed_at ||
      appMetadata[ENROLLMENT_METADATA_KEY] !== nonce
    ) throw new Error("Could not verify new invited Auth identity ownership.");

    if (!await persistPendingEnrollment(
      service,
      settings,
      patient as PatientRow,
      createdAuthUserId,
      nonce,
    )) throw new Error("Could not persist invited patient enrollment.");
    pendingPersisted = true;
    if (!await updateEnrollmentDisplayFlag(service, patient as PatientRow, true)) {
      throw new Error("Could not update patient enrollment status.");
    }

    const { error: recoveryError } = await anon.auth.resetPasswordForEmail(
      patient.email,
      redirectOptions,
    );
    if (recoveryError) throw new Error("Could not send patient recovery invitation.");
    return json({ sent: true });
  } catch {
    // Once the private marker is persisted, retain this recoverable pending
    // enrollment even if email delivery fails; retries can safely resend.
    if (pendingPersisted) {
      return json({ error: "Não foi possível enviar a solicitação." }, 502);
    }
    if (createdAuthUserId) {
      try {
        await deleteUncommittedAuthUser(
          service,
          createdAuthUserId,
          patient.email,
          nonce,
        );
      } catch {
        // Keep the public admin response generic and never delete without the app-metadata nonce.
      }
    }
    return json({ error: "Não foi possível enviar a solicitação." }, 502);
  }
}

async function handleRequest(request: Request): Promise<Response> {
  let settings: Settings;
  try {
    settings = readSettings();
  } catch {
    return json({ error: "Patient access is not configured." }, 503);
  }
  const cors = addCorsHeaders(request, settings);
  const origin = request.headers.get("origin");
  if (origin && !settings.allowedOrigins.has(origin)) {
    return json({ error: "Origin not allowed." }, 403);
  }
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, cors);

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 32_768) return json({ error: "Request too large." }, 413, cors);
  let body: unknown;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 32_768) {
      return json({ error: "Request too large." }, 413, cors);
    }
    body = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid JSON." }, 400, cors);
  }
  if (!isPlainObject(body) || typeof body.action !== "string") {
    return json({ error: "Invalid request." }, 400, cors);
  }
  const { service, anon } = makeClients(settings);
  let response: Response;
  try {
    switch (body.action) {
      case "register":
        response = await register(body, request, settings, service, anon);
        break;
      case "login":
        response = await login(body, request, settings, service, anon);
        break;
      case "recover":
        response = await recover(body, request, settings, service, anon);
        break;
      case "admin-reset":
        response = await adminReset(body, request, settings, service, anon);
        break;
      default:
        response = json({ error: "Unsupported action." }, 400);
    }
  } catch {
    response = json({ error: "Request could not be completed." }, 500);
  }
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(cors)) headers.set(key, value);
  return new Response(response.body, { status: response.status, headers });
}

if ((import.meta as ImportMeta & { main?: boolean }).main) {
  edgeRuntime.Deno.serve(handleRequest);
}