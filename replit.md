# MedCore Pro

## Project Overview

MedCore Pro is a React + Vite clinical management web app. It includes patient, appointment, doctor, medication, reporting, export/import, consultation, Supabase sync, and Gemini-assisted clinical helper features.

## Tech Stack

- React 19 with TypeScript
- Vite 6
- Tailwind CSS 4 via `@tailwindcss/vite`
- Supabase client for cloud sync
- Google GenAI SDK for optional AI helpers

## Replit Setup

- Development server: `npm run dev`
- Preview port: `5000`
- Vite is configured with `host: "0.0.0.0"` and `allowedHosts: true` so the Replit preview proxy can load the app.
- Deployment target: static site built with `npm run build`, served from `dist`.

## Notes

- `GEMINI_API_KEY` is read by Vite and exposed to the client build for the existing Gemini service.
- Supabase URL e anon key são lidos de `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (Replit Secrets). Sem eles, o cliente cai em modo stub e a app funciona somente com armazenamento local.
- O esquema completo das tabelas está em `supabase_schema.sql` (rodar uma vez no SQL Editor do projeto).
- Consultation print mode uses body classes to show only the prescription or exam portal content during print; the main app root is hidden with visibility rather than display to avoid blank pages.
- New runtime records use `crypto.randomUUID()` for patients, files, doctors, users, appointments, and medications.
- Sensitive consultation specialties such as Psicologia and Psiquiatria require an access password before finalization; the stored value is SHA-256 hashed.
- Backup export receives the current in-memory database state so recent unsynced edits are included.
- Every successful login resets the app to the Dashboard view and clears any previously active consultation/page state.
- Three user roles (`UserRole`): `ADMIN` (full access, manages users/passwords, reports, doctors, backups), `DOCTOR` (own patients/agenda + atendimento/prontuário), `COLLABORATOR` (vê toda a clínica para editar pacientes/agenda/medicamentos, mas sem atender consultas, sem corpo clínico, sem relatórios e sem backup).
- O cadastro de profissional/usuário no `DoctorRegistry` permite escolher entre os 3 papéis. Para Médico exige CRM e Especialidade; para Colaborador/Administrador esses campos ficam ocultos e só é criado o usuário (sem registro de médico).
- O `DoctorRegistry` inclui um painel "Usuários do Sistema" onde o admin pode trocar a senha, alterar o papel e remover qualquer usuário (o usuário `admin` não pode ser removido).
- Na Agenda, o botão "Atender" só aparece para perfis Médico e Admin.
- Login usa Supabase Auth via `services/auth.ts`: valida o usuário/senha contra a tabela local (fonte de verdade dos perfis e papéis) e em seguida estabelece sessão real no Supabase com `signInWithPassword` usando e-mail sintético `username@medcore.local`. Se o usuário ainda não existir no Auth, faz `signUp` automático na primeira entrada.
- Logout chama `supabase.auth.signOut()` para encerrar a sessão.
- Cadastro de novo usuário no `DoctorRegistry` provisiona conta no Supabase Auth em background (`provisionAuthAccount`).
- `fetchFromCloud` nunca sobrescreve dados locais com arrays vazios da nuvem (corrige bug que apagava o admin quando a tabela `users` estava vazia). `initLocal` também garante que o usuário `admin` sempre exista.
- Limitação: a chave anon não permite ao admin redefinir a senha de outros usuários no Supabase Auth (precisaria de service_role em uma Edge Function). O painel "Usuários do Sistema" troca a senha **local**; o usuário deve usar a função "esqueci minha senha" do Supabase para sincronizar a senha do Auth.