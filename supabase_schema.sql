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
  role text not null check (role in ('admin','doctor')),
  doctor_id text
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
