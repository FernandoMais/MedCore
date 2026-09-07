-- ============================================================
-- MedCore Pro - Esquema do banco no Supabase
-- Execute este script inteiro no Supabase SQL Editor
-- ============================================================

-- Tabela de usuários do sistema (login interno)
create table if not exists public.users (
  id text primary key,
  username text unique not null,
  password text not null,
  name text not null,
  role text not null check (role in ('admin','doctor','collaborator','patient')),
  doctor_id text,
  "clinicId" text not null default 'clinic-demo-001'
);

-- Tabela de médicos
create table if not exists public.doctors (
  id text primary key,
  name text not null,
  crm text not null,
  specialty text not null,
  email text,
  phone text,
  avatar text,
  "availableTimes" jsonb default '[]'::jsonb
);

-- Tabela de pacientes
create table if not exists public.patients (
  id text primary key,
  name text not null,
  "birthDate" text,
  gender text,
  cpf text,
  email text,
  phone text,
  address text,
  "healthInsurance" text,
  "bloodType" text,
  allergies jsonb default '[]'::jsonb,
  history text,
  "preExistingConditions" jsonb default '[]'::jsonb,
  "createdAt" text,
  "primaryDoctorId" text,
  files jsonb default '[]'::jsonb
);

-- Tabela de agendamentos
create table if not exists public.appointments (
  id text primary key,
  "patientId" text not null,
  "doctorId" text not null,
  date text not null,
  time text not null,
  type text not null,
  status text not null,
  room text
);
alter table public.appointments add column if not exists "serviceValue" numeric(14,2);
alter table public.appointments add column if not exists "repassRule" jsonb;

-- Cadastro de medicamentos
create table if not exists public.medications (
  id text primary key,
  name text not null,
  dosage text,
  posology text,
  period text,
  purpose text,
  manufacturer text
);

-- Evolução clínica do paciente (prontuário)
create table if not exists public.evolucao_paciente (
  id uuid primary key default gen_random_uuid(),
  paciente_id text not null,
  medico_id text,
  medico_nome text,
  especialidade text,
  anotacoes text not null,
  senha_acesso text,
  data_criacao timestamptz not null default now()
);

create index if not exists idx_evolucao_paciente on public.evolucao_paciente (paciente_id, data_criacao desc);
create index if not exists idx_appointments_date on public.appointments (date);
create index if not exists idx_patients_doctor on public.patients ("primaryDoctorId");

-- ============================================================
-- Módulo financeiro
-- Todas as entidades financeiras carregam clinicId.
-- A aplicação sempre filtra pelo clinicId do usuário antes de
-- calcular, exibir ou exportar dados. Ao ativar autenticação
-- multi-tenant, substitua as políticas abertas por políticas
-- baseadas no claim da clínica da sessão.
-- ============================================================

create table if not exists public.financial_transactions (
  id text primary key,
  "clinicId" text not null,
  type text not null check (type in ('receita','despesa')),
  status text not null check (status in ('pendente','pago','vencido','cancelado')),
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

create table if not exists public.financial_categories (
  id text primary key,
  "clinicId" text not null,
  name text not null,
  type text not null check (type in ('receita','despesa','ambos')),
  color text not null default '#2563eb',
  active boolean not null default true
);

create table if not exists public.financial_cost_centers (
  id text primary key,
  "clinicId" text not null,
  name text not null,
  description text,
  active boolean not null default true
);

create table if not exists public.financial_payment_methods (
  id text primary key,
  "clinicId" text not null,
  name text not null,
  kind text not null check (kind in ('entrada','saida','ambos')),
  "feePercent" numeric(8,3) default 0,
  active boolean not null default true
);

create table if not exists public.financial_bank_accounts (
  id text primary key,
  "clinicId" text not null,
  name text not null,
  bank text,
  agency text,
  "accountNumber" text,
  kind text not null check (kind in ('banco','caixa')),
  "openingBalance" numeric(14,2) not null default 0,
  active boolean not null default true
);

create table if not exists public.financial_insurance_plans (
  id text primary key,
  "clinicId" text not null,
  name text not null,
  operator text not null,
  code text,
  "paymentTermDays" integer not null default 0,
  active boolean not null default true
);

create table if not exists public.financial_repasses (
  id text primary key,
  "clinicId" text not null,
  "doctorId" text not null,
  "referenceMonth" text not null,
  "grossAmount" numeric(14,2) not null default 0,
  percentage numeric(8,3),
  amount numeric(14,2) not null default 0,
  status text not null check (status in ('previsto','aprovado','pago')),
  "dueDate" text not null,
  "paidDate" text,
  notes text
);
alter table public.financial_repasses add column if not exists "patientId" text;
alter table public.financial_repasses add column if not exists "appointmentId" text;

create table if not exists public.financial_cash_closures (
  id text primary key,
  "clinicId" text not null,
  "accountId" text not null,
  date text not null,
  "openingBalance" numeric(14,2) not null default 0,
  "expectedBalance" numeric(14,2) not null default 0,
  "countedBalance" numeric(14,2) not null default 0,
  difference numeric(14,2) not null default 0,
  "responsibleName" text not null,
  status text not null check (status in ('aberto','fechado')),
  notes text
);

create table if not exists public.financial_reconciliations (
  id text primary key,
  "clinicId" text not null,
  "accountId" text not null,
  date text not null,
  description text not null,
  amount numeric(14,2) not null default 0,
  type text not null check (type in ('receita','despesa')),
  status text not null check (status in ('pendente','conciliado','divergente')),
  "transactionId" text
);

create table if not exists public.financial_billing_records (
  id text primary key,
  "clinicId" text not null,
  "referenceMonth" text not null,
  "patientId" text,
  "insurancePlanId" text,
  "totalAmount" numeric(14,2) not null default 0,
  "submittedAt" text,
  "dueDate" text not null,
  status text not null check (status in ('rascunho','enviado','pago','glosa')),
  notes text
);

create table if not exists public.financial_settings (
  "clinicId" text primary key,
  "clinicName" text not null,
  document text,
  currency text not null default 'BRL',
  "defaultPaymentMethodId" text,
  "defaultAccountId" text,
  "allowNegativeCash" boolean not null default false,
  "sendPaymentNotifications" boolean not null default true
);

create index if not exists idx_financial_transactions_clinic_date
  on public.financial_transactions ("clinicId", "dueDate");
create index if not exists idx_financial_transactions_clinic_status
  on public.financial_transactions ("clinicId", status);
create index if not exists idx_financial_repasses_clinic_month
  on public.financial_repasses ("clinicId", "referenceMonth");
create index if not exists idx_financial_reconciliation_clinic_status
  on public.financial_reconciliations ("clinicId", status);

-- ============================================================
-- Row Level Security (políticas abertas para anon key)
-- Ajuste depois conforme sua necessidade de segurança.
-- ============================================================
alter table public.users enable row level security;
alter table public.doctors enable row level security;
alter table public.patients enable row level security;
alter table public.appointments enable row level security;
alter table public.medications enable row level security;
alter table public.evolucao_paciente enable row level security;

do $$
declare t text;
begin
  for t in select unnest(array['users','doctors','patients','appointments','medications','evolucao_paciente'])
  loop
    execute format('drop policy if exists "anon all access" on public.%I', t);
    execute format('create policy "anon all access" on public.%I for all using (true) with check (true)', t);
  end loop;
end $$;
