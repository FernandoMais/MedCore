-- ============================================================
-- MedCore Pro - Migração do módulo financeiro
-- ============================================================
-- Execute este arquivo no Supabase Dashboard > SQL Editor.
--
-- Esta migração é idempotente: pode ser executada novamente sem
-- apagar dados existentes.
--
-- IMPORTANTE:
-- 1. Faça um backup antes de executar em produção.
-- 2. A etapa estrutural abaixo é compatível com o cliente atual.
-- 3. O bloco de RLS estrito no final está comentado de propósito.
--    O aplicativo atual usa usuários locais + anon key e ainda não
--    envia o clinicId como claim JWT. Ativar RLS sem esse vínculo
--    bloquearia a sincronização do aplicativo.
-- ============================================================

begin;

create extension if not exists pgcrypto;

-- Compatibilidade com usuários e agenda já existentes
alter table if exists public.users
  add column if not exists "clinicId" text;

update public.users
set "clinicId" = 'clinic-demo-001'
where "clinicId" is null;

alter table if exists public.users
  alter column "clinicId" set default 'clinic-demo-001';

alter table if exists public.users
  alter column "clinicId" set not null;

alter table if exists public.appointments
  add column if not exists "serviceValue" numeric(14,2);

alter table if exists public.appointments
  add column if not exists "repassRule" jsonb;

-- ============================================================
-- Tabelas financeiras
-- ============================================================

create table if not exists public.financial_transactions (
  id text primary key,
  "clinicId" text not null default 'clinic-demo-001',
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
  "createdAt" text not null default to_char(now(), 'YYYY-MM-DD')
);

create table if not exists public.financial_categories (
  id text primary key,
  "clinicId" text not null default 'clinic-demo-001',
  name text not null,
  type text not null check (type in ('receita', 'despesa', 'ambos')),
  color text not null default '#2563eb',
  active boolean not null default true
);

create table if not exists public.financial_cost_centers (
  id text primary key,
  "clinicId" text not null default 'clinic-demo-001',
  name text not null,
  description text,
  active boolean not null default true
);

create table if not exists public.financial_payment_methods (
  id text primary key,
  "clinicId" text not null default 'clinic-demo-001',
  name text not null,
  kind text not null check (kind in ('entrada', 'saida', 'ambos')),
  "feePercent" numeric(8,3) not null default 0,
  active boolean not null default true
);

create table if not exists public.financial_bank_accounts (
  id text primary key,
  "clinicId" text not null default 'clinic-demo-001',
  name text not null,
  bank text,
  agency text,
  "accountNumber" text,
  kind text not null check (kind in ('banco', 'caixa')),
  "openingBalance" numeric(14,2) not null default 0,
  active boolean not null default true
);

create table if not exists public.financial_insurance_plans (
  id text primary key,
  "clinicId" text not null default 'clinic-demo-001',
  name text not null,
  operator text not null,
  code text,
  "paymentTermDays" integer not null default 0,
  active boolean not null default true
);

create table if not exists public.financial_repasses (
  id text primary key,
  "clinicId" text not null default 'clinic-demo-001',
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

alter table if exists public.financial_repasses
  add column if not exists "patientId" text;

alter table if exists public.financial_repasses
  add column if not exists "appointmentId" text;

create table if not exists public.financial_cash_closures (
  id text primary key,
  "clinicId" text not null default 'clinic-demo-001',
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

create table if not exists public.financial_reconciliations (
  id text primary key,
  "clinicId" text not null default 'clinic-demo-001',
  "accountId" text not null,
  date text not null,
  description text not null,
  amount numeric(14,2) not null default 0,
  type text not null check (type in ('receita', 'despesa')),
  status text not null check (status in ('pendente', 'conciliado', 'divergente')),
  "transactionId" text
);

create table if not exists public.financial_billing_records (
  id text primary key,
  "clinicId" text not null default 'clinic-demo-001',
  "referenceMonth" text not null,
  "patientId" text,
  "insurancePlanId" text,
  "totalAmount" numeric(14,2) not null default 0,
  "submittedAt" text,
  "dueDate" text not null,
  status text not null check (status in ('rascunho', 'enviado', 'pago', 'glosa')),
  notes text
);

create table if not exists public.financial_settings (
  "clinicId" text primary key default 'clinic-demo-001',
  "clinicName" text not null,
  document text,
  currency text not null default 'BRL',
  "defaultPaymentMethodId" text,
  "defaultAccountId" text,
  "allowNegativeCash" boolean not null default false,
  "sendPaymentNotifications" boolean not null default true
);

-- Índices para consultas por tenant e telas operacionais
create index if not exists idx_financial_transactions_clinic_date
  on public.financial_transactions ("clinicId", "dueDate");

create index if not exists idx_financial_transactions_clinic_status
  on public.financial_transactions ("clinicId", status);

create index if not exists idx_financial_transactions_patient
  on public.financial_transactions ("clinicId", "patientId");

create index if not exists idx_financial_transactions_appointment
  on public.financial_transactions ("clinicId", "appointmentId");

create index if not exists idx_financial_repasses_clinic_month
  on public.financial_repasses ("clinicId", "referenceMonth");

create index if not exists idx_financial_reconciliation_clinic_status
  on public.financial_reconciliations ("clinicId", status);

create index if not exists idx_financial_billing_clinic_month
  on public.financial_billing_records ("clinicId", "referenceMonth");

commit;

-- ============================================================
-- VALIDAÇÃO PÓS-MIGRAÇÃO
-- Execute estas consultas separadamente depois do commit.
-- ============================================================
--
-- select table_name
-- from information_schema.tables
-- where table_schema = 'public'
--   and table_name like 'financial_%'
-- order by table_name;
--
-- select "clinicId", count(*) as total
-- from public.financial_transactions
-- group by "clinicId"
-- order by "clinicId";
--
-- select count(*) as transactions_without_tenant
-- from public.financial_transactions
-- where "clinicId" is null;

-- ============================================================
-- RLS ESTRITO POR CLÍNICA — aplicar somente após configurar
-- auth.jwt()->>'clinic_id' ou função equivalente no Supabase Auth.
-- ============================================================
--
-- do $$
-- declare
--   t text;
-- begin
--   for t in select unnest(array[
--     'financial_transactions',
--     'financial_categories',
--     'financial_cost_centers',
--     'financial_payment_methods',
--     'financial_bank_accounts',
--     'financial_insurance_plans',
--     'financial_repasses',
--     'financial_cash_closures',
--     'financial_reconciliations',
--     'financial_billing_records',
--     'financial_settings'
--   ])
--   loop
--     execute format('alter table public.%I enable row level security', t);
--     execute format('drop policy if exists "tenant select" on public.%I', t);
--     execute format('drop policy if exists "tenant insert" on public.%I', t);
--     execute format('drop policy if exists "tenant update" on public.%I', t);
--     execute format('drop policy if exists "tenant delete" on public.%I', t);
--     execute format(
--       'create policy "tenant select" on public.%I for select using ("clinicId" = (auth.jwt() ->> ''clinic_id''))',
--       t
--     );
--     execute format(
--       'create policy "tenant insert" on public.%I for insert with check ("clinicId" = (auth.jwt() ->> ''clinic_id''))',
--       t
--     );
--     execute format(
--       'create policy "tenant update" on public.%I for update using ("clinicId" = (auth.jwt() ->> ''clinic_id'')) with check ("clinicId" = (auth.jwt() ->> ''clinic_id''))',
--       t
--     );
--     execute format(
--       'create policy "tenant delete" on public.%I for delete using ("clinicId" = (auth.jwt() ->> ''clinic_id''))',
--       t
--     );
--   end loop;
-- end $$;