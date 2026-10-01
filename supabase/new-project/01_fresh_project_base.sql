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