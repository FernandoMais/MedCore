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

-- Vincula a conta interna à identidade autenticada do Supabase. O vínculo é
-- criado somente pela função bind_current_user(), depois do login.
alter table public.users add column if not exists "authUserId" uuid;
create unique index if not exists idx_users_auth_user_id
  on public.users ("authUserId")
  where "authUserId" is not null;

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
-- Row Level Security
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

-- Retorna o tenant da identidade autenticada sem expor a tabela users ao
-- mecanismo de RLS da própria consulta. A associação é feita por authUserId,
-- nunca por um clinicId enviado pelo navegador.
create or replace function public.current_user_clinic_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u."clinicId"
  from public.users u
  where u."authUserId" = auth.uid()
  limit 1
$$;

-- Associa a sessão atual ao usuário interno após o signIn. O e-mail sintético
-- é usado apenas para localizar o próprio usuário; o tenant vem da linha
-- authoritative em public.users.
create or replace function public.bind_current_user()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  internal_user_id text;
  internal_clinic_id text;
  current_auth_user uuid;
begin
  current_auth_user := auth.uid();
  if current_auth_user is null then
    raise exception 'Sessão não autenticada';
  end if;

  select u.id, u."clinicId"
    into internal_user_id, internal_clinic_id
  from public.users u
  where lower(u.username) = lower(split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1))
  limit 1;

  if internal_user_id is null or internal_clinic_id is null then
    raise exception 'Usuário sem clínica autorizada';
  end if;

  update public.users
     set "authUserId" = current_auth_user
   where id = internal_user_id
     and ("authUserId" is null or "authUserId" = current_auth_user);

  if not found then
    raise exception 'Usuário já vinculado a outra sessão';
  end if;

  return internal_clinic_id;
end;
$$;

revoke all on function public.current_user_clinic_id() from public;
revoke all on function public.bind_current_user() from public;
grant execute on function public.current_user_clinic_id() to authenticated;
grant execute on function public.bind_current_user() to authenticated;

-- A tabela de usuários ainda precisa ser consultável pelo login legado, mas
-- ninguém pode alterar clinicId com a anon key. Usuários autenticados só
-- conseguem operar registros do próprio tenant; a função de vínculo acima é
-- a única exceção controlada para preencher authUserId.
drop policy if exists "anon all access" on public.users;
drop policy if exists "anonymous user lookup" on public.users;
drop policy if exists "tenant user access" on public.users;
create policy "anonymous user lookup" on public.users
  for select to anon using (true);
create policy "tenant user access" on public.users
  for all to authenticated
  using ("clinicId" = public.current_user_clinic_id() or "authUserId" = auth.uid())
  with check (
    "clinicId" = public.current_user_clinic_id()
    and ("authUserId" is null or "authUserId" = auth.uid())
  );

-- Todas as operações financeiras exigem uma sessão autenticada vinculada ao
-- mesmo tenant. Sem uma política para anon, chamadas diretas com a anon key
-- não conseguem ler nem gravar dados financeiros.
do $$
declare t text;
begin
  for t in select unnest(array[
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
  ])
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "tenant financial access" on public.%I', t);
    execute format(
      'create policy "tenant financial access" on public.%I for all to authenticated using ("clinicId" = public.current_user_clinic_id()) with check ("clinicId" = public.current_user_clinic_id())',
      t
    );
  end loop;
end $$;
