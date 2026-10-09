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

## Instalação atual: diferenças em relação às notas legadas

- Na instalação nova, o login da equipe exige autenticação Supabase real e vínculo de usuário/clínica no servidor; senhas locais e contas demonstrativas não autorizam o acesso.
- O acesso de pacientes é separado do acesso da equipe. Cadastro público coleta identidade e contato, não pagamento; recuperação usa confirmação real do token e senha de 8 a 128 caracteres.
- As descrições abaixo de login sintético, senhas locais e campos de pagamento são históricas e não descrevem o contrato da instalação nova.
- Não interpretar uma compilação aprovada como liberação para atendimento real. A revisão em `docs/revisao-ambulatorio.html` registra limites de verificação e riscos que precisam ser resolvidos antes de usar o sistema como prontuário principal.

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
- Login possui link "Esqueci minha senha": verifica se o username existe localmente e chama `supabase.auth.resetPasswordForEmail` com e-mail sintético `username@medcore.local`. Se Supabase não estiver configurado, orienta o usuário a pedir ao admin.
- `components/PatientSelfRegister.tsx`: formulário público (sem login) acessível pelo botão "Fazer meu Cadastro" da landing page. Coleta: Nome, CPF, Data de Nascimento, E-mail, Celular, Rua, Nº, Bairro, Cidade, CEP, Valor pago, Nome de quem realizou o depósito/PIX. Ao submeter, cria registro de paciente com `selfRegistered: true` diretamente no banco local (sincroniza com Supabase automaticamente). Campos opcionais de endereço detalhado foram adicionados ao tipo `Patient` (`streetName`, `streetNumber`, `neighborhood`, `city`, `zipCode`, `paymentValue`, `paymentSender`, `selfRegistered`).
- Landing page tem dois botões: "Iniciar Atendimento" (equipe) e "Fazer meu Cadastro" (pacientes/clientes).

## Informações Sigilosas (Restricted/Confidential Notes)

- Novo tipo `SigilousNote` em `types.ts`: `{ id, patientId, authorId, authorName, authorSpecialty?, note, createdAt }`.
- Campo `senhaAcesso?: string` adicionado ao tipo `User` — senha sigilosa definida pelo admin, armazenada em texto plano no registro do usuário.
- `AppDatabase` agora inclui `sigilousNotes: SigilousNote[]` (persistência local + sincronização cloud via tabela `sigilous_notes` no Supabase).
- **ConsultationRoom**: painel "Informações Sigilosas" (dark slate) aparece abaixo do histórico geral durante consultas. O profissional insere sua `senhaAcesso` (definida pelo admin); após desbloqueio, vê todas as notas sigilosas anteriores do paciente ordenadas por data (mais recentes primeiro) e pode registrar novas notas. As notas sigilosas NÃO aparecem no histórico geral (`patient.history`).
- **DoctorRegistry**: na seção "Usuários do Sistema", ao editar um usuário, o admin pode definir/gerar a `senhaAcesso` do profissional. O campo sigiloso aparece em destaque âmbar. Um badge "Sigiloso Ativo" / "Sem Senha Sigilosa" indica visualmente o estado de cada usuário.
- `storage.saveSigilousNoteToCloud()` envia notas sigilosas para a tabela `sigilous_notes` no Supabase em background.
- O fluxo de adição: `onAddSigilousNote` callback em `App.tsx` persiste localmente em `db.sigilousNotes` e chama o sync cloud.
- Histórico geral (`patient.history`) exibe blocos organizados por data com `[DATA: ...]` markers, parseados e exibidos em ordem cronológica reversa (mais recente primeiro).
- Para criar a tabela `sigilous_notes` no Supabase, adicionar ao `supabase_schema.sql`: `CREATE TABLE sigilous_notes (id TEXT PRIMARY KEY, patient_id TEXT, author_id TEXT, author_name TEXT, author_specialty TEXT, note TEXT, created_at TIMESTAMPTZ);`