-- GENERATED FILE: node scripts/build-supabase-new-project.mjs

-- Fresh-project bootstrap only. Review 00_source_inventory.sql first.

-- This transaction creates no Auth-managed tables and seeds no users, clinic, or credentials.

-- It applies schema/security only; it does not import application data or Storage objects.

-- If any application schema/table already exists, the guard deliberately stops execution.

begin;

-- Fresh-project application schema component.
-- Use supabase_new_project.sql for the guarded, atomic bootstrap.
-- No demo clinic, users, patients, passwords, or Auth-managed objects are seeded.

-- Abort instead of layering this fresh-project bootstrap over an existing app.
-- Also reject populated unknown public tables so an unfamiliar application
-- schema is never silently treated as an empty target.
do $guard$
declare
  application_table text;
  public_table record;
  row_count bigint;
  application_tables constant text[] := array[
    'users',
    'doctors',
    'patients',
    'appointments',
    'medications',
    'evolucao_paciente',
    'sigilous_notes',
    'financial_transactions',
    'financial_categories',
    'financial_cost_centers',
    'financial_payment_methods',
    'financial_bank_accounts',
    'financial_insurance_plans',
    'financial_repasses',
    'financial_cash_closures',
    'financial_reconciliations',
    'financial_billing_records',
    'financial_settings',
    'patient_access_enrollments',
    'patient_access_rate_limits'
  ];
begin
  foreach application_table in array application_tables loop
    if to_regclass(format('public.%I', application_table)) is not null then
      raise exception
        'Fresh-project bootstrap refused: public.% already exists. Do not run this bootstrap over an existing application schema.',
        application_table;
    end if;
  end loop;

  if exists (
       select 1
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and p.proname = any(array[
           'current_user_clinic_id',
           'bind_current_user',
           'patient_access_clinic_id',
           'patient_access_is_staff',
           'patient_access_is_clinic_admin',
           'guard_staff_user_binding_fields',
           'guard_patient_access_enrollment_mutation',
           'consume_patient_access_attempt',
           'patient_access_valid_booking_date',
           'patient_access_doctor_in_clinic',
           'guard_patient_access_identity_fields'
         ])
     )
     or to_regclass('public.patient_portal_doctors') is not null then
    raise exception
      'Fresh-project bootstrap refused: application security functions or views already exist.';
  end if;

  for public_table in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p', 'm')
      and c.relname <> 'spatial_ref_sys'
      and c.relname <> all(application_tables)
  loop
    execute format('select count(*) from public.%I', public_table.relname)
      into row_count;
    if row_count > 0 then
      raise exception
        'Fresh-project bootstrap refused: unknown populated public table %. Inventory and review the source schema before proceeding.',
        public_table.relname;
    end if;
  end loop;
end
$guard$;

-- Core tables retain the application's current public names, text IDs, JSON
-- medical-file representation, and existing snake/camel-case column contract.
create table public.users (
  id text primary key,
  username text unique not null,
  password text not null default '',
  name text not null,
  role text not null check (role in ('admin', 'doctor', 'collaborator', 'patient')),
  doctor_id text,
  "clinicId" text,
  "authUserId" uuid
);

create table public.doctors (
  id text primary key,
  name text not null,
  crm text not null,
  specialty text not null,
  email text,
  phone text,
  avatar text,
  "availableTimes" jsonb not null default '[]'::jsonb,
  "clinicId" text
);

create table public.patients (
  id text primary key,
  name text not null,
  "birthDate" text,
  gender text,
  cpf text,
  email text,
  phone text,
  address text,
  "streetName" text,
  "streetNumber" text,
  neighborhood text,
  city text,
  "zipCode" text,
  "healthInsurance" text,
  "bloodType" text,
  allergies jsonb not null default '[]'::jsonb,
  history text,
  "preExistingConditions" jsonb not null default '[]'::jsonb,
  "createdAt" text,
  "primaryDoctorId" text,
  files jsonb not null default '[]'::jsonb,
  "clinicId" text,
  "authUserId" uuid,
  "paymentValue" text,
  "paymentSender" text,
  "selfRegistered" boolean not null default false,
  "portalEnrollmentPending" boolean not null default false
);

create table public.appointments (
  id text primary key,
  "patientId" text not null,
  "doctorId" text not null,
  date text not null,
  time text not null,
  type text not null,
  status text not null,
  room text,
  "serviceValue" numeric(14,2),
  "repassRule" jsonb,
  "clinicId" text
);

create table public.medications (
  id text primary key,
  name text not null,
  dosage text,
  posology text,
  period text,
  purpose text,
  manufacturer text
);

-- MedicalRecord is currently local-only in the application; services/storage
-- does not persist it as a public table, so this bootstrap does not invent one.
create table public.evolucao_paciente (
  id uuid primary key default gen_random_uuid(),
  paciente_id text not null,
  medico_id text,
  medico_nome text,
  especialidade text,
  anotacoes text not null,
  senha_acesso text,
  data_criacao timestamptz not null default now()
);

-- patient_id is generated from the camel-case property written by current
-- services, while preserving the patient_id key used by hardened RLS.
create table public.sigilous_notes (
  id text primary key,
  "patientId" text not null,
  patient_id text generated always as ("patientId") stored,
  "authorId" text not null,
  "authorName" text not null,
  "authorSpecialty" text,
  note text not null,
  "createdAt" text not null
);

-- Full financial schema currently used by services/storage.ts and types.ts.
-- sendPaymentNotifications is the current notification setting; the source
-- application has no separate financial-email queue/table or delivery log.
create table public.financial_transactions (
  id text primary key,
  "clinicId" text not null,
  type text not null check (type in ('receita', 'despesa')),
  status text not null check (status in ('pendente', 'pago', 'vencido', 'cancelado')),
  description text not null,
  amount numeric(14,2) not null check (amount >= 0),
  "dueDate" text not null,
  "paidDate" text,
  "patientId" text,
  "doctorId" text,
  "appointmentId" text,
  "categoryId" text,
  "costCenterId" text,
  "paymentMethodId" text,
  "accountId" text,
  "insurancePlanId" text,
  "documentNumber" text,
  notes text,
  "createdAt" text not null
);

create table public.financial_categories (
  id text primary key,
  "clinicId" text not null,
  name text not null,
  type text not null check (type in ('receita', 'despesa', 'ambos')),
  color text not null default '#2563eb',
  active boolean not null default true
);

create table public.financial_cost_centers (
  id text primary key,
  "clinicId" text not null,
  name text not null,
  description text,
  active boolean not null default true
);

create table public.financial_payment_methods (
  id text primary key,
  "clinicId" text not null,
  name text not null,
  kind text not null check (kind in ('entrada', 'saida', 'ambos')),
  "feePercent" numeric(8,3) not null default 0,
  active boolean not null default true
);

create table public.financial_bank_accounts (
  id text primary key,
  "clinicId" text not null,
  name text not null,
  bank text,
  agency text,
  "accountNumber" text,
  kind text not null check (kind in ('banco', 'caixa')),
  "openingBalance" numeric(14,2) not null default 0,
  active boolean not null default true
);

create table public.financial_insurance_plans (
  id text primary key,
  "clinicId" text not null,
  name text not null,
  operator text not null,
  code text,
  "paymentTermDays" integer not null default 0,
  active boolean not null default true
);

create table public.financial_repasses (
  id text primary key,
  "clinicId" text not null,
  "doctorId" text not null,
  "patientId" text,
  "appointmentId" text,
  "referenceMonth" text not null,
  "grossAmount" numeric(14,2) not null default 0,
  percentage numeric(8,3),
  amount numeric(14,2) not null default 0,
  status text not null check (status in ('previsto', 'aprovado', 'pago')),
  "dueDate" text not null,
  "paidDate" text,
  notes text
);

create table public.financial_cash_closures (
  id text primary key,
  "clinicId" text not null,
  "accountId" text not null,
  date text not null,
  "openingBalance" numeric(14,2) not null default 0,
  "expectedBalance" numeric(14,2) not null default 0,
  "countedBalance" numeric(14,2) not null default 0,
  difference numeric(14,2) not null default 0,
  "responsibleName" text not null,
  status text not null check (status in ('aberto', 'fechado')),
  notes text
);

create table public.financial_reconciliations (
  id text primary key,
  "clinicId" text not null,
  "accountId" text not null,
  date text not null,
  description text not null,
  amount numeric(14,2) not null default 0,
  type text not null check (type in ('receita', 'despesa')),
  status text not null check (status in ('pendente', 'conciliado', 'divergente')),
  "transactionId" text
);

create table public.financial_billing_records (
  id text primary key,
  "clinicId" text not null,
  "referenceMonth" text not null,
  "patientId" text,
  "insurancePlanId" text,
  "totalAmount" numeric(14,2) not null default 0,
  "submittedAt" text,
  "dueDate" text not null,
  status text not null check (status in ('rascunho', 'enviado', 'pago', 'glosa')),
  notes text
);

create table public.financial_settings (
  "clinicId" text primary key,
  "clinicName" text not null,
  document text,
  currency text not null default 'BRL',
  "defaultPaymentMethodId" text,
  "defaultAccountId" text,
  "allowNegativeCash" boolean not null default false,
  "sendPaymentNotifications" boolean not null default true
);

create index idx_evolucao_paciente
  on public.evolucao_paciente (paciente_id, data_criacao desc);
create index idx_appointments_date on public.appointments (date);
create index idx_patients_doctor on public.patients ("primaryDoctorId");
create index idx_financial_transactions_clinic_date
  on public.financial_transactions ("clinicId", "dueDate");
create index idx_financial_transactions_clinic_status
  on public.financial_transactions ("clinicId", status);
create index idx_financial_transactions_patient
  on public.financial_transactions ("clinicId", "patientId");
create index idx_financial_transactions_appointment
  on public.financial_transactions ("clinicId", "appointmentId");
create index idx_financial_repasses_clinic_month
  on public.financial_repasses ("clinicId", "referenceMonth");
create index idx_financial_reconciliation_clinic_status
  on public.financial_reconciliations ("clinicId", status);
create index idx_financial_billing_clinic_month
  on public.financial_billing_records ("clinicId", "referenceMonth");

-- Fail closed even if this component is applied alone. The combined bootstrap
-- later installs reviewed policies and grants in the same transaction.
alter table public.users enable row level security;
alter table public.doctors enable row level security;
alter table public.patients enable row level security;
alter table public.appointments enable row level security;
alter table public.medications enable row level security;
alter table public.evolucao_paciente enable row level security;
alter table public.sigilous_notes enable row level security;
alter table public.financial_transactions enable row level security;
alter table public.financial_categories enable row level security;
alter table public.financial_cost_centers enable row level security;
alter table public.financial_payment_methods enable row level security;
alter table public.financial_bank_accounts enable row level security;
alter table public.financial_insurance_plans enable row level security;
alter table public.financial_repasses enable row level security;
alter table public.financial_cash_closures enable row level security;
alter table public.financial_reconciliations enable row level security;
alter table public.financial_billing_records enable row level security;
alter table public.financial_settings enable row level security;

revoke all on table
  public.users,
  public.doctors,
  public.patients,
  public.appointments,
  public.medications,
  public.evolucao_paciente,
  public.sigilous_notes,
  public.financial_transactions,
  public.financial_categories,
  public.financial_cost_centers,
  public.financial_payment_methods,
  public.financial_bank_accounts,
  public.financial_insurance_plans,
  public.financial_repasses,
  public.financial_cash_closures,
  public.financial_reconciliations,
  public.financial_billing_records,
  public.financial_settings
from public, anon, authenticated;
grant select, insert, update, delete
  on public.patients, public.doctors, public.appointments
  to authenticated;
grant all on table
  public.users,
  public.doctors,
  public.patients,
  public.appointments,
  public.medications,
  public.evolucao_paciente,
  public.sigilous_notes,
  public.financial_transactions,
  public.financial_categories,
  public.financial_cost_centers,
  public.financial_payment_methods,
  public.financial_bank_accounts,
  public.financial_insurance_plans,
  public.financial_repasses,
  public.financial_cash_closures,
  public.financial_reconciliations,
  public.financial_billing_records,
  public.financial_settings
to service_role;

-- Existing hardened patient-access migration, unchanged except for its outer transaction wrapper.

-- Patient portal authentication and tenant isolation.
-- Apply only after reviewing the existing clinic assignments in public.users.
-- This migration deliberately does not create a demo clinic or guess a tenant.

do $$
begin
  if to_regclass('public.users') is null
     or to_regclass('public.patients') is null
     or to_regclass('public.doctors') is null
     or to_regclass('public.appointments') is null then
    raise exception 'Expected public.users, patients, doctors, and appointments tables; apply the reviewed base schema first.';
  end if;
end
$$;

-- Retain the existing patient fields and add only the clinic/auth/contact
-- columns needed by the Edge Function. In particular, payment and address
-- values are first-class fields and are not discarded during registration.
alter table public.users
  add column if not exists "clinicId" text,
  add column if not exists "authUserId" uuid,
  add column if not exists doctor_id text;

-- The legacy offline credential column is not a cloud authentication source.
-- Keep existing values intact, but new profile inserts do not need a password.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'password'
  ) then
    alter table public.users alter column password set default '';
  end if;
end
$$;

alter table public.patients
  add column if not exists "clinicId" text,
  add column if not exists "authUserId" uuid,
  add column if not exists "birthDate" text,
  add column if not exists gender text,
  add column if not exists cpf text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists address text,
  add column if not exists "streetName" text,
  add column if not exists "streetNumber" text,
  add column if not exists neighborhood text,
  add column if not exists city text,
  add column if not exists "zipCode" text,
  add column if not exists "healthInsurance" text,
  add column if not exists "bloodType" text,
  add column if not exists allergies jsonb not null default '[]'::jsonb,
  add column if not exists history text,
  add column if not exists "preExistingConditions" jsonb not null default '[]'::jsonb,
  add column if not exists "createdAt" text,
  add column if not exists "primaryDoctorId" text,
  add column if not exists files jsonb not null default '[]'::jsonb,
  add column if not exists "paymentValue" text,
  add column if not exists "paymentSender" text,
  add column if not exists "selfRegistered" boolean not null default false,
  add column if not exists "portalEnrollmentPending" boolean not null default false;

update public.patients
set "portalEnrollmentPending" = false
where "portalEnrollmentPending" is null;
alter table public.patients
  alter column "portalEnrollmentPending" set default false,
  alter column "portalEnrollmentPending" set not null;

alter table public.doctors
  add column if not exists "clinicId" text,
  add column if not exists "availableTimes" jsonb not null default '[]'::jsonb;

alter table public.appointments
  add column if not exists "clinicId" text,
  add column if not exists "patientId" text,
  add column if not exists "doctorId" text,
  add column if not exists date text,
  add column if not exists time text,
  add column if not exists type text,
  add column if not exists status text,
  add column if not exists room text,
  add column if not exists "serviceValue" numeric(14,2),
  add column if not exists "repassRule" jsonb;

update public.doctors set "availableTimes" = '[]'::jsonb
where "availableTimes" is null;
alter table public.doctors
  alter column "availableTimes" set default '[]'::jsonb,
  alter column "availableTimes" set not null;

-- Do not guess clinic ownership. Missing assignments can only be backfilled
-- automatically when there is exactly one clinic represented in public.users.
do $$
declare
  clinic_count integer;
  only_clinic text;
  missing_count bigint;
begin
  select count(distinct nullif(trim("clinicId"), '')), min(nullif(trim("clinicId"), ''))
    into clinic_count, only_clinic
  from public.users;

  if clinic_count > 1 then
    select count(*) into missing_count from public.patients where "clinicId" is null or trim("clinicId") = '';
    if missing_count > 0 then
      raise exception 'Ambiguous patient clinic backfill: assign clinicId to every existing patient before this migration.';
    end if;
    select count(*) into missing_count from public.doctors where "clinicId" is null or trim("clinicId") = '';
    if missing_count > 0 then
      raise exception 'Ambiguous doctor clinic backfill: assign clinicId to every existing doctor before this migration.';
    end if;
    select count(*) into missing_count from public.appointments where "clinicId" is null or trim("clinicId") = '';
    if missing_count > 0 then
      raise exception 'Ambiguous appointment clinic backfill: assign clinicId to every existing appointment before this migration.';
    end if;
  elsif clinic_count = 1 then
    update public.patients set "clinicId" = only_clinic
      where "clinicId" is null or trim("clinicId") = '';
    update public.doctors set "clinicId" = only_clinic
      where "clinicId" is null or trim("clinicId") = '';
    update public.appointments set "clinicId" = only_clinic
      where "clinicId" is null or trim("clinicId") = '';
  else
    select count(*) into missing_count
      from public.patients where "clinicId" is null or trim("clinicId") = '';
    if missing_count > 0 then
      raise exception 'No authoritative clinic association exists for patients. Populate public.users.clinicId and assign each patient before this migration.';
    end if;
    select count(*) into missing_count
      from public.doctors where "clinicId" is null or trim("clinicId") = '';
    if missing_count > 0 then
      raise exception 'No authoritative clinic association exists for doctors. Populate public.users.clinicId and assign each doctor before this migration.';
    end if;
    select count(*) into missing_count
      from public.appointments where "clinicId" is null or trim("clinicId") = '';
    if missing_count > 0 then
      raise exception 'No authoritative clinic association exists for appointments. Populate public.users.clinicId and assign each appointment before this migration.';
    end if;
  end if;

  if exists (select 1 from public.users where "clinicId" is null or trim("clinicId") = '') then
    raise exception 'public.users contains an empty clinicId; repair staff clinic assignments before continuing.';
  end if;
  if exists (select 1 from public.patients where "clinicId" is null or trim("clinicId") = '') then
    raise exception 'Some patient rows still have no clinicId.';
  end if;
  if exists (select 1 from public.doctors where "clinicId" is null or trim("clinicId") = '') then
    raise exception 'Some doctor rows still have no clinicId.';
  end if;
  if exists (select 1 from public.appointments where "clinicId" is null or trim("clinicId") = '') then
    raise exception 'Some appointment rows still have no clinicId.';
  end if;
end
$$;

alter table public.users alter column "clinicId" set not null;
alter table public.patients alter column "clinicId" set not null;
alter table public.doctors alter column "clinicId" set not null;
alter table public.appointments alter column "clinicId" set not null;

-- Never retain an old plaintext patient password field. Auth credentials live
-- exclusively in Supabase Auth; this drops only the obsolete secret column.
do $$
begin
  if exists (
    select 1
    from public.patients p
    join public.users u on u."authUserId" = p."authUserId"
    where p."authUserId" is not null
  ) then
    raise exception 'An Auth identity is linked to both a patient and a system user; resolve identity ownership before continuing.';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'patients'
      and column_name = 'patientPassword'
  ) then
    execute 'update public.patients set "patientPassword" = null';
    execute 'alter table public.patients drop column "patientPassword"';
  end if;
end
$$;

create unique index if not exists idx_users_auth_user_id
  on public.users ("authUserId") where "authUserId" is not null;
create unique index if not exists idx_patients_auth_user_id_patient_access
  on public.patients ("authUserId") where "authUserId" is not null;
create unique index if not exists idx_patients_clinic_cpf_patient_access
  on public.patients (
    "clinicId",
    (regexp_replace(cpf, '[^0-9]', '', 'g'))
  )
  where cpf is not null and regexp_replace(cpf, '[^0-9]', '', 'g') <> '';
create index if not exists idx_patients_clinic_email_patient_access
  on public.patients ("clinicId", lower(email));
create index if not exists idx_appointments_clinic_patient_patient_access
  on public.appointments ("clinicId", "patientId", date);
create index if not exists idx_appointments_clinic_doctor_date_patient_access
  on public.appointments ("clinicId", "doctorId", date);

-- An existing appointment must not straddle clinics. Stop rather than silently
-- moving clinical data if prior assignments disagree.
do $$
begin
  if exists (
    select 1
    from public.appointments a
    join public.patients p on p.id = a."patientId"
    where a."clinicId" <> p."clinicId"
  ) then
    raise exception 'Existing appointments and patients have conflicting clinic assignments; resolve these rows before continuing.';
  end if;
  if exists (
    select 1
    from public.appointments a
    join public.doctors d on d.id = a."doctorId"
    where a."clinicId" <> d."clinicId"
  ) then
    raise exception 'Existing appointments and doctors have conflicting clinic assignments; resolve these rows before continuing.';
  end if;
end
$$;

-- This helper remains staff-only: existing financial and users policies rely
-- on it, so patient identities must never resolve through this function.
create or replace function public.current_user_clinic_id()
returns text
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select u."clinicId"
  from public.users as u
  where u."authUserId" = auth.uid()
    and u.role in ('admin', 'doctor', 'collaborator')
  limit 1
$$;

-- Patient portal clinic scope is intentionally isolated from the staff-only
-- current_user_clinic_id() used by financial and users policies.
create or replace function public.patient_access_clinic_id()
returns text
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select p."clinicId"
  from public.patients as p
  where p."authUserId" = auth.uid()
  limit 1
$$;

create or replace function public.patient_access_is_staff(p_clinic_id text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.users as u
    where u."authUserId" = auth.uid()
      and u."clinicId" = p_clinic_id
      and u.role in ('admin', 'doctor', 'collaborator')
  )
$$;

create or replace function public.patient_access_is_clinic_admin(p_clinic_id text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.users as u
    where u."authUserId" = auth.uid()
      and u."clinicId" = p_clinic_id
      and u.role = 'admin'
  )
$$;

-- Safe compatibility entry point for existing staff clients: it can only
-- confirm an operator-provisioned binding, never claim by email/username.
create or replace function public.bind_current_user()
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  bound_clinic_id text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;
  select u."clinicId" into bound_clinic_id
  from public.users as u
  where u."authUserId" = auth.uid()
    and u.role in ('admin', 'doctor', 'collaborator')
  limit 1;
  if bound_clinic_id is null then
    raise exception 'Staff identity is not provisioned by a trusted operator.';
  end if;
  return bound_clinic_id;
end
$$;

revoke all on function public.current_user_clinic_id() from public, anon;
revoke all on function public.patient_access_clinic_id() from public, anon;
revoke all on function public.patient_access_is_staff(text) from public, anon;
revoke all on function public.patient_access_is_clinic_admin(text) from public, anon;
revoke all on function public.bind_current_user() from public, anon;
grant execute on function public.current_user_clinic_id() to authenticated;
grant execute on function public.patient_access_clinic_id() to authenticated;
grant execute on function public.patient_access_is_staff(text) to authenticated;
grant execute on function public.patient_access_is_clinic_admin(text) to authenticated;
grant execute on function public.bind_current_user() to authenticated;

-- Replace legacy anonymous/public user lookups. Staff can read only their
-- tenant; only clinic admins may mutate ordinary fields. Identity, role, and
-- tenant bindings remain service-role/operator managed.
do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'users'
  loop
    execute format('drop policy %I on public.users', policy_record.policyname);
  end loop;
end
$$;
alter table public.users enable row level security;
revoke all on public.users from public, anon, authenticated;
do $$
declare user_column record;
begin
  for user_column in
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'users'
  loop
    execute format('revoke select (%I) on public.users from public, anon, authenticated', user_column.column_name);
  end loop;
end
$$;
grant select (id, username, name, role, doctor_id, "clinicId", "authUserId")
  on public.users to authenticated;
grant insert, update, delete on public.users to authenticated;
grant all on public.users to service_role;

create or replace function public.guard_staff_user_binding_fields()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if tg_op = 'INSERT' and new."authUserId" is not null then
      raise exception 'Staff Auth identities can only be bound by trusted operators.';
    end if;
    if tg_op = 'UPDATE' then
      if (
        new."authUserId" is distinct from old."authUserId"
        or new."clinicId" is distinct from old."clinicId"
        or new.role is distinct from old.role
      ) then
        raise exception 'Staff identity, role, and clinic bindings can only be changed by trusted operators.';
      end if;
    end if;
    if new."clinicId" is distinct from public.current_user_clinic_id() then
      raise exception 'Staff users can only be created in the current staff clinic.';
    end if;
  end if;
  return new;
end
$$;
drop trigger if exists guard_staff_user_binding_fields on public.users;
create trigger guard_staff_user_binding_fields
  before insert or update on public.users
  for each row execute function public.guard_staff_user_binding_fields();

create policy "staff read users in own clinic"
  on public.users for select to authenticated
  using (public.patient_access_is_staff("clinicId"));
create policy "clinic admins insert users"
  on public.users for insert to authenticated
  with check (public.patient_access_is_clinic_admin("clinicId"));
create policy "clinic admins update users"
  on public.users for update to authenticated
  using (public.patient_access_is_clinic_admin("clinicId"))
  with check (public.patient_access_is_clinic_admin("clinicId"));
create policy "clinic admins delete users"
  on public.users for delete to authenticated
  using (public.patient_access_is_clinic_admin("clinicId"));

-- Financial tables may have been created structurally without the RLS section
-- from the old schema. Every existing financial table is made staff-only.
do $$
declare
  target_table text;
  policy_record record;
  financial_tables text[] := array[
    'financial_transactions',
    'financial_categories',
    'financial_cost_centers',
    'financial_payment_methods',
    'financial_bank_accounts',
    'financial_insurance_plans',
    'financial_repasses',
    'financial_cash_closures',
    'financial_reconciliations',
    'financial_billing_records',
    'financial_settings'
  ];
begin
  foreach target_table in array financial_tables loop
    if to_regclass(format('public.%I', target_table)) is not null then
      if not exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = target_table
          and column_name = 'clinicId'
      ) then
        raise exception 'Financial table public.% is missing clinicId; repair tenant assignment before enabling access.', target_table;
      end if;
      execute format('alter table public.%I enable row level security', target_table);
      for policy_record in
        select policyname from pg_policies
        where schemaname = 'public' and tablename = target_table
      loop
        execute format('drop policy %I on public.%I', policy_record.policyname, target_table);
      end loop;
      execute format(
        'create policy %I on public.%I for all to authenticated using (public.patient_access_is_staff("clinicId")) with check (public.patient_access_is_staff("clinicId"))',
        'staff clinic access ' || target_table,
        target_table
      );
      execute format('revoke all on public.%I from public, anon', target_table);
      execute format('grant select, insert, update, delete on public.%I to authenticated', target_table);
      execute format('grant all on public.%I to service_role', target_table);
    end if;
  end loop;
end
$$;

-- Clinical data with a patient key is clinic-scoped through that patient's
-- authoritative row. Medication catalog access is staff-only because this
-- legacy table has no clinic column. No patient role gets these policies.
do $$
declare
  policy_record record;
  table_exists boolean;
begin
  if to_regclass('public.medications') is not null then
    execute 'alter table public.medications enable row level security';
    for policy_record in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = 'medications'
    loop
      execute format('drop policy %I on public.medications', policy_record.policyname);
    end loop;
    execute 'revoke all on public.medications from public, anon';
    execute 'grant select, insert, update, delete on public.medications to authenticated';
    execute 'grant all on public.medications to service_role';
    execute $sql$
      create policy "staff only medication catalog"
      on public.medications for all to authenticated
      using (public.current_user_clinic_id() is not null)
      with check (public.current_user_clinic_id() is not null)
    $sql$;
  end if;

  if to_regclass('public.evolucao_paciente') is not null then
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'evolucao_paciente'
        and column_name = 'paciente_id'
    ) then
      raise exception 'public.evolucao_paciente lacks paciente_id; repair patient ownership before enabling access.';
    end if;
    execute 'alter table public.evolucao_paciente enable row level security';
    for policy_record in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = 'evolucao_paciente'
    loop
      execute format('drop policy %I on public.evolucao_paciente', policy_record.policyname);
    end loop;
    execute 'revoke all on public.evolucao_paciente from public, anon';
    execute 'grant select, insert, update, delete on public.evolucao_paciente to authenticated';
    execute 'grant all on public.evolucao_paciente to service_role';
    execute $sql$
      create policy "staff clinic access to patient evolution"
      on public.evolucao_paciente for all to authenticated
      using (
        exists (
          select 1 from public.patients p
          where p.id = "paciente_id"
            and p."clinicId" = public.current_user_clinic_id()
            and public.patient_access_is_staff(p."clinicId")
        )
      )
      with check (
        exists (
          select 1 from public.patients p
          where p.id = "paciente_id"
            and p."clinicId" = public.current_user_clinic_id()
            and public.patient_access_is_staff(p."clinicId")
        )
      )
    $sql$;
  end if;

  table_exists := to_regclass('public.sigilous_notes') is not null;
  if table_exists then
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'sigilous_notes'
        and column_name = 'patient_id'
    ) then
      raise exception 'public.sigilous_notes lacks patient_id; repair patient ownership before enabling access.';
    end if;
    execute 'alter table public.sigilous_notes enable row level security';
    for policy_record in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = 'sigilous_notes'
    loop
      execute format('drop policy %I on public.sigilous_notes', policy_record.policyname);
    end loop;
    execute 'revoke all on public.sigilous_notes from public, anon';
    execute 'grant select, insert, update, delete on public.sigilous_notes to authenticated';
    execute 'grant all on public.sigilous_notes to service_role';
    execute $sql$
      create policy "staff clinic access to patient sigilous notes"
      on public.sigilous_notes for all to authenticated
      using (
        exists (
          select 1 from public.patients p
          where p.id = patient_id
            and p."clinicId" = public.current_user_clinic_id()
            and public.patient_access_is_staff(p."clinicId")
        )
      )
      with check (
        exists (
          select 1 from public.patients p
          where p.id = patient_id
            and p."clinicId" = public.current_user_clinic_id()
            and public.patient_access_is_staff(p."clinicId")
        )
      )
    $sql$;
  end if;
end
$$;

-- Pending ownership exists only in a private service-managed table until the
-- patient proves control of the verified Auth identity by signing in.
create table if not exists public.patient_access_enrollments (
  patient_id text primary key references public.patients(id) on delete cascade,
  clinic_id text not null,
  auth_user_id uuid not null unique,
  nonce_hash text not null check (nonce_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
alter table public.patient_access_enrollments enable row level security;
revoke all on table public.patient_access_enrollments from public, anon, authenticated;
grant select, insert, update, delete on table public.patient_access_enrollments to service_role;

create or replace function public.guard_patient_access_enrollment_mutation()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Patient enrollment ownership is managed only by trusted server operations.';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  if not exists (
    select 1 from public.patients p
    where p.id = new.patient_id
      and p."clinicId" = new.clinic_id
      and p."authUserId" is null
  ) then
    raise exception 'Pending enrollment must point to an unlinked patient in the same clinic.';
  end if;
  return new;
end
$$;
drop trigger if exists guard_patient_access_enrollment_mutation
  on public.patient_access_enrollments;
create trigger guard_patient_access_enrollment_mutation
  before insert or update or delete on public.patient_access_enrollments
  for each row execute function public.guard_patient_access_enrollment_mutation();

-- The fixed-window buckets contain keyed hashes only, never IP addresses or
-- CPF values. The atomic service-only RPC prevents concurrent requests from
-- bypassing a limit.
create table if not exists public.patient_access_rate_limits (
  bucket_hash text primary key,
  window_started_at timestamptz not null,
  attempts integer not null check (attempts > 0)
);
alter table public.patient_access_rate_limits enable row level security;
revoke all on table public.patient_access_rate_limits from public, anon, authenticated, service_role;

create or replace function public.consume_patient_access_attempt(
  p_bucket_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  attempt_count integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Not authorized';
  end if;
  if p_bucket_hash !~ '^[0-9a-f]{64}$'
     or p_limit < 1 or p_limit > 100
     or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'Invalid rate-limit parameters';
  end if;

  delete from public.patient_access_rate_limits
  where window_started_at < clock_timestamp() - interval '24 hours';

  insert into public.patient_access_rate_limits as buckets
    (bucket_hash, window_started_at, attempts)
  values (p_bucket_hash, clock_timestamp(), 1)
  on conflict (bucket_hash) do update
    set attempts = case
      when buckets.window_started_at <= clock_timestamp()
        - make_interval(secs => p_window_seconds) then 1
      else buckets.attempts + 1
    end,
    window_started_at = case
      when buckets.window_started_at <= clock_timestamp()
        - make_interval(secs => p_window_seconds) then clock_timestamp()
      else buckets.window_started_at
    end
  returning attempts into attempt_count;

  return attempt_count <= p_limit;
end
$$;

revoke all on function public.consume_patient_access_attempt(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_patient_access_attempt(text, integer, integer)
  to service_role;

create or replace function public.patient_access_valid_booking_date(p_date text)
returns boolean
language plpgsql
stable
set search_path = pg_catalog
as $$
declare
  parsed date;
begin
  if p_date is null or p_date !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    return false;
  end if;
  parsed := p_date::date;
  return parsed >= current_date;
exception when others then
  return false;
end
$$;
revoke all on function public.patient_access_valid_booking_date(text) from public, anon;
grant execute on function public.patient_access_valid_booking_date(text) to authenticated;

-- RLS hides the doctors table from patient roles, so appointment validation
-- checks doctor membership through this narrowly scoped, non-data-returning
-- helper instead of granting patients direct doctors-table access.
create or replace function public.patient_access_doctor_in_clinic(
  p_doctor_id text,
  p_clinic_id text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select p_clinic_id = public.patient_access_clinic_id()
    and exists (
      select 1 from public.patients p
      where p."authUserId" = auth.uid()
        and p."clinicId" = p_clinic_id
    )
    and exists (
      select 1 from public.doctors d
      where d.id = p_doctor_id
        and d."clinicId" = p_clinic_id
    )
$$;
revoke all on function public.patient_access_doctor_in_clinic(text, text) from public, anon;
grant execute on function public.patient_access_doctor_in_clinic(text, text) to authenticated;

-- Protect tenant/Auth/status bindings and lock CPF/e-mail once enrollment
-- starts. Ordinary staff edits to names, phone, and address remain allowed.
create or replace function public.guard_patient_access_identity_fields()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if tg_op = 'INSERT' and (
      new."authUserId" is not null or new."portalEnrollmentPending"
    ) then
      raise exception 'Patient Auth identities can only be linked by trusted server operations.';
    end if;
    if tg_op = 'UPDATE' then
      if (
        new."authUserId" is distinct from old."authUserId"
        or new."clinicId" is distinct from old."clinicId"
        or new."portalEnrollmentPending" is distinct from old."portalEnrollmentPending"
      ) then
        raise exception 'Patient Auth and clinic bindings can only be changed by trusted server operations.';
      end if;
      if (
        old."authUserId" is not null
        or exists (
          select 1 from public.patient_access_enrollments e
          where e.patient_id = old.id
        )
      ) and (
        new.cpf is distinct from old.cpf
        or new.email is distinct from old.email
      ) then
        raise exception 'Patient CPF and email are locked after Auth enrollment begins.';
      end if;
    end if;
  end if;
  return new;
end
$$;
drop trigger if exists guard_patient_access_identity_fields on public.patients;
create trigger guard_patient_access_identity_fields
  before insert or update on public.patients
  for each row execute function public.guard_patient_access_identity_fields();

-- Replace patient/appointment/doctor policies. The users, financial, and
-- legacy clinical tables were tightened explicitly above; all other policies
-- remain untouched.
do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('patients', 'appointments', 'doctors')
  loop
    execute format(
      'drop policy %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end
$$;

alter table public.patients enable row level security;
alter table public.appointments enable row level security;
alter table public.doctors enable row level security;

create policy "patient access staff clinic patients"
  on public.patients for all to authenticated
  using (public.patient_access_is_staff("clinicId"))
  with check (public.patient_access_is_staff("clinicId"));
create policy "patient access own patient read"
  on public.patients for select to authenticated
  using (
    "authUserId" = auth.uid()
    and "clinicId" = public.patient_access_clinic_id()
  );

create policy "patient access staff clinic doctors"
  on public.doctors for all to authenticated
  using (public.patient_access_is_staff("clinicId"))
  with check (public.patient_access_is_staff("clinicId"));

create policy "patient access staff clinic appointments"
  on public.appointments for all to authenticated
  using (public.patient_access_is_staff("clinicId"))
  with check (public.patient_access_is_staff("clinicId"));
create policy "patient access own appointment read"
  on public.appointments for select to authenticated
  using (
    "clinicId" = public.patient_access_clinic_id()
    and exists (
      select 1 from public.patients p
      where p.id = "patientId"
        and p."clinicId" = "appointments"."clinicId"
        and p."authUserId" = auth.uid()
    )
  );
create policy "patient access own appointment insert"
  on public.appointments for insert to authenticated
  with check (
    id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and
    "clinicId" = public.patient_access_clinic_id()
    and status = 'Agendado'
    and type in ('Consulta', 'Retorno', 'Procedimento', 'Telemedicina')
    and time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    and public.patient_access_valid_booking_date(date)
    and room is null
    and "serviceValue" is null
    and "repassRule" is null
    and exists (
      select 1 from public.patients p
      where p.id = "patientId"
        and p."clinicId" = "appointments"."clinicId"
        and p."authUserId" = auth.uid()
    )
    and public.patient_access_doctor_in_clinic("doctorId", "clinicId")
  );

-- Patients may discover only these non-clinical doctor fields. Direct access
-- to public.doctors remains staff-only.
create or replace view public.patient_portal_doctors
with (security_barrier = true)
as
  select d.id, d.name, d.crm, d.specialty, d."clinicId", d."availableTimes"
  from public.doctors d
  where d."clinicId" = public.patient_access_clinic_id()
    and exists (
      select 1 from public.patients p
      where p."authUserId" = auth.uid()
        and p."clinicId" = d."clinicId"
    );
revoke all on public.patient_portal_doctors from public, anon;
grant select on public.patient_portal_doctors to authenticated;

-- Remove any anonymous/open access from the explicitly protected tables.
revoke all on public.patients, public.appointments, public.doctors from anon;

commit;

