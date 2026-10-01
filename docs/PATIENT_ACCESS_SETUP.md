# Acesso de pacientes por CPF: implantação e pré-requisitos

Esta função Supabase Edge é configurada para uma única clínica confiável. O
corpo da requisição nunca escolhe a clínica. Não publique a service-role key no
navegador, não a coloque em uma variável Vite e não use a chave anon para
substituir as operações desta função.

## Antes de aplicar a migração

1. Inspecione o banco de produção e confirme que
   `public.users`, `public.patients`, `public.doctors` e
   `public.appointments` são as tabelas atuais.
2. Confirme que cada `public.users."clinicId"` é autoritativo e que pacientes,
   médicos e consultas existentes pertencem à clínica correta. A migração só
   infere uma clínica para associações ausentes quando há exatamente uma
   clínica em `public.users`. Com várias clínicas, atribua manualmente cada
   linha sem clínica e resolva divergências entre consulta, paciente e médico.
   A migração falha em vez de inventar uma clínica ou mover dados.
3. Verifique os vínculos de equipe existentes. Um operador confiável deve
   provisionar `users.authUserId`, `users."clinicId"` e `users.role`; a função
   `bind_current_user()` será substituída por uma consulta que apenas confirma
   um vínculo preexistente para `auth.uid()`. Ela não localiza usuários por
   e-mail/username e nunca os associa automaticamente.
4. Resolva CPFs duplicados após normalização dentro de cada clínica antes de
   aplicar a migração. A criação do índice falha em vez de escolher ou fundir
   pacientes.
5. Se `public.users` estiver vazia, provisionar o primeiro usuário de equipe e
   seu vínculo Auth requer uma operação confiável com privilégios de operador.
   Não reative políticas anônimas de leitura de usuários/senhas. O reset
   administrativo de pacientes só funciona após existir um vínculo de equipe
   autorizado.
6. Audite os `patients.authUserId` existentes e resolva UUIDs eventualmente
   associados tanto a `patients` quanto a `users`. A migração interrompe esse
   caso em vez de escolher um proprietário.
7. Se existirem tabelas financeiras, confirme que cada uma tem `clinicId`.
   Tabelas clínicas `evolucao_paciente` e `sigilous_notes` devem ter,
   respectivamente, `paciente_id` e `patient_id` válidos. A migração falha se
   não puder impor isolamento por clínica.

Aplique **somente** `supabase_patient_access_migration.sql` no Supabase SQL
Editor ou em um executor revisado. O arquivo roda em uma única transação
(`begin`/`commit`): qualquer erro interrompe todas as alterações. Não execute
cegamente o antigo `supabase_schema.sql`, que contém políticas históricas
abertas para `anon`.

A migração mantém `current_user_clinic_id()` exclusivamente para equipe
(`admin`, `doctor`, `collaborator`) e adiciona `patient_access_clinic_id()`
separadamente. Assim, uma sessão de paciente não passa por políticas
financeiras ou de usuários que usam o helper de equipe. A migração remove as
políticas e privilégios públicos/anônimos de `public.users`; equipe pode ler
usuários da própria clínica, e somente administradores da clínica podem fazer
alterações comuns. `authUserId`, clínica e papel ficam protegidos para
alteração apenas por operador confiável; paciente nunca pode criar uma linha
de equipe.

As tabelas financeiras existentes são configuradas com RLS de equipe por
`clinicId`, substituindo políticas anteriores dessas tabelas. A tabela global
`medications` fica acessível somente a sessões de equipe. `evolucao_paciente`
e `sigilous_notes`, quando existentes, são limitadas à equipe da clínica
relacionada pelo paciente; elas não têm política para papéis de paciente.
Revise outros objetos clínicos do projeto separadamente.

Na tabela `patients`, `portalEnrollmentPending` é apenas um indicador público
de estado, sem credenciais ou identificadores Auth. É gravado somente pelo
servidor: `true` durante cadastro/convite pendente e `false` depois do primeiro
vínculo bem-sucedido. A associação confidencial fica em
`patient_access_enrollments`, tabela sem acesso de `anon`/`authenticated`, com
Auth UUID e hash HMAC do nonce; o nonce aleatório bruto fica no `app_metadata`
gravado pelo service role. Nunca use o indicador público como prova de
identidade.

O gatilho de pacientes impede alterações de clínica, vínculo Auth e indicador
pendente por clientes. Depois que o cadastro/convite começa ou o Auth é
vinculado, também impede reatribuição de CPF/e-mail. Antes disso, equipe
autorizada pode corrigir CPF/e-mail. O gatilho não bloqueia edições comuns de
nome, telefone, endereço ou outros dados de contato pela equipe autorizada.
Uploads continuam fora do cadastro público.

## Configuração e implantação da Edge Function

A função usa as variáveis integradas do Supabase:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — somente no servidor
- `PATIENT_CLINIC_ID` — ID autoritativo obrigatório
- `PATIENT_APP_ORIGINS` — origens exatas permitidas, separadas por vírgula,
  por exemplo `https://portal.example.com,https://www.example.com`

Com a CLI vinculada ao projeto correto, configure **somente** as duas variáveis
personalizadas abaixo. `SUPABASE_*` são variáveis internas/reservadas do
Supabase; não tente defini-las com `supabase secrets set`.

```sh
supabase secrets set \
  PATIENT_CLINIC_ID='id-da-clinica-autoritativa' \
  PATIENT_APP_ORIGINS='https://portal.example.com'
supabase functions deploy patient-access
```

As origens aceitam esquema, host e porta opcionais, sem caminhos. Use HTTPS em
produção. A mesma lista valida CORS e `redirectTo`. A clínica enviada pelo
navegador é ignorada. Nunca exponha ou registre a service-role key; rotacione-a
se já foi publicada.

`supabase/config.toml` define `verify_jwt = false` porque cadastro, login e
recuperação são ações públicas. A ação `admin-reset` valida o Bearer token
contra Supabase Auth e exige o vínculo autoritativo em `public.users`, a clínica
configurada e um papel de equipe permitido. Não remova essa validação.

Esta implantação tem uma clínica confiável por função. Não selecione uma
clínica pelo corpo da requisição. Para várias clínicas, use implantações
separadas ou projete uma camada confiável de roteamento revisada
independentemente.

## Supabase Auth, confirmação e recuperação

- Habilite Auth por e-mail/senha, confirmação de e-mail e SMTP de produção.
  Cadastro normal cria atomicamente uma nova identidade com `admin.createUser`,
  nonce em `app_metadata` e `email_confirm=false`; se o e-mail já existir, a
  criação falha sem alterar essa identidade. Só depois de persistir o paciente
  e o vínculo privado a função chama `anon.auth.resend(type: "signup")`.
  A confirmação por e-mail é necessária antes do login.
- Para cadastro normal, mantenha no template de confirmação o link
  `<a href="{{ .ConfirmationURL }}">Confirmar meu e-mail</a>`.
  Ele valida o e-mail no Supabase e retorna ao `redirectTo` com
  `?patient-auth=confirm`. A tela de confirmação não valida OTP de cadastro;
  **não** substitua esse link por um `token_hash` de tipo `signup`.
- Configure os templates Auth de recuperação e convite para usar o destino
  validado e token hash, por exemplo:

  ```html
  <a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery">
    Redefinir senha
  </a>
  ```

  No template de convite use `type=invite`. O cadastro normal continua usando
  `{{ .ConfirmationURL }}`. O destino enviado pela aplicação deve conter o parâmetro
  apropriado, por exemplo `?patient-auth=recovery`, antes de o template
  acrescentar `&token_hash=...&type=...`.
- A tela de recuperação deve validar exclusivamente o `token_hash` com
  `verifyOtp` e o tipo Auth correspondente (`recovery` ou `invite`) e então
  permitir criar a senha. Não aceite um JWT arbitrário de fragmento nem
  transforme/reclassifique um token de outro fluxo como token de recuperação.
  Mantenha armazenamento Auth isolado para não substituir a sessão da equipe.
- Cadastre as origens e URLs de confirmação/recuperação em Site URL / Redirect
  URLs do Supabase Auth, além de incluí-las em `PATIENT_APP_ORIGINS`.
- O cadastro público cria um Auth novo com a senha escolhida pelo paciente;
  nunca reutiliza uma identidade não confirmada encontrada por e-mail e nunca
  exclui uma conta preexistente. Uma resposta de conflito é neutra e orienta
  entrar em contato com a clínica.
- Para convite administrativo de um paciente sem vínculo pendente, a função
  cria atomicamente um Auth novo com senha temporária aleatória, não conhecida
  pelo paciente, `email_confirm=false` e nonce próprio em `app_metadata`.
  Depois de gravar o vínculo privado, envia um e-mail de **recuperação**. O
  destinatário comprova controle do e-mail com o OTP de recuperação e define a
  própria senha. Não é enviado um link de confirmação de cadastro como se ele
  permitisse escolher senha.
- Recuperação de CPF pendente primeiro valida o nonce privado e a marca
  `app_metadata`, inclusive antes do primeiro login; só então envia recuperação
  ao e-mail armazenado. O endpoint público sempre responde de forma genérica,
  exista ou não um paciente. Para identidade vinculada, o reset usa o e-mail
  real armazenado. Se não houver associação privada válida, a função não
  procura Auth por e-mail nem faz vínculo por senha.
- O primeiro login válido por CPF e senha ainda verifica a associação privada
  (ou o vínculo ativo existente) antes de ligar `patients.authUserId`. Após
  vincular, remove o estado privado pendente e define
  `portalEnrollmentPending=false`.

## Contrato HTTP

Todas as ações são `POST` JSON para `/functions/v1/patient-access`.

Cadastro:

```json
{
  "action": "register",
  "patient": {
    "name": "Nome completo",
    "cpf": "529.982.247-25",
    "birthDate": "1990-01-31",
    "email": "patient@example.com",
    "phone": "(11) 99999-0000",
    "streetName": "Rua Exemplo",
    "city": "São Paulo"
  },
  "password": "Strong!Pass8",
  "redirectTo": "https://portal.example.com/patient-auth/confirm"
}
```

O cadastro aceita campos públicos do paciente, mas não aceita `id`,
`clinicId`, `authUserId`, `portalEnrollmentPending`, senha interna ou arquivos.
Exige nome, CPF válido, nascimento, e-mail, telefone, endereço e cidade.
Não aceita valor pago ou identificação de pagador; o cadastro cria somente
a conta Auth e o registro do paciente, sem consulta ou lançamento financeiro.
A senha deve ter entre
oito e 128 caracteres; use uma senha longa e exclusiva. A confirmação
da senha deve ser exigida pelo cliente. Nenhuma senha é gravada em `patients`.
Após sucesso, a resposta informa `requiresConfirmation=true` e
`confirmationEmailSent`. Se o envio falhar depois de persistir o paciente e
a associação privada, o cadastro continua salvo e a interface informa acesso
pendente de confirmação. Isso não desativa a confirmação de e-mail nem permite
login sem comprovação de identidade.

Login:

```json
{"action":"login","cpf":"529.982.247-25","password":"Strong!Pass8"}
```

Sucesso retorna somente `{"session":{"access_token":"…","refresh_token":"…"}}`.
Combinações inválidas de CPF/conta/senha têm resposta genérica; não existe
consulta pública de e-mail.

Recuperação:

```json
{"action":"recover","cpf":"529.982.247-25","redirectTo":"https://portal.example.com/patient-auth/recovery"}
```

Sempre retorna `{"message":"Solicitação recebida."}`. Para paciente não
confirmado com vínculo pendente válido, dispara recuperação antes do primeiro
login; para paciente ativo, reseta a senha associada ao e-mail armazenado. A
resposta não confirma se o paciente existe nem se um e-mail foi entregue.

Reset/convite administrativo:

```json
{"action":"admin-reset","patientId":"patient-id","redirectTo":"https://portal.example.com/patient-auth/recovery"}
```

Exige `Authorization: Bearer <staff access token>`. Somente equipe vinculada à
clínica configurada e com papel permitido pode solicitar. Se já há vínculo
pendente, a função valida sua propriedade antes de enviar recuperação; se não
há identidade, cria um Auth novo atomicamente e envia recuperação para criar a
senha inicial. Não aceita, atualiza ou apaga uma identidade existente com base
somente em e-mail ou em `identities`.

## Operação e segurança

- A migração retira a leitura de senhas internas da equipe pelo navegador:
  somente os campos públicos do perfil são consultáveis por equipe autorizada.
  A sincronização não envia senha nem altera vínculos Auth da equipe. O login
  legado/offline da equipe ainda existe no app; revise esse fluxo separadamente
  e rotacione credenciais que possam ter sido expostas pela configuração antiga.

- Os limites persistentes usam HMAC do IP recebido do gateway e do CPF
  normalizado, por ação e clínica. A tabela de rate limit não armazena IP, CPF,
  senha, token ou e-mail em texto claro. O RPC é exclusivo do service role.
- A função depende de cabeçalhos de IP encaminhados pelo gateway confiável. O
  limite independente por CPF continua ativo quando não há IP identificável.
- A busca por CPF ocorre somente pelo cliente service role no servidor. Esse
  cliente nunca pode ser reutilizado no navegador.
- A função mantém campos de endereço, mas não captura pagamentos. Uploads não são
  aceitos no cadastro (`files` deve estar vazio).
- A view `patient_portal_doctors` expõe somente `id`, `name`, `crm`,
  `specialty`, `clinicId` e `availableTimes`; papéis de paciente não leem
  diretamente `public.doctors`.
- A policy de inserção de consulta aceita apenas ID UUID, paciente e clínica
  próprios, médico da clínica, data futura ISO, hora `HH:MM`, tipo suportado e
  estado `Agendado`. Rejeita paciente/clínica divergentes, médico desconhecido,
  data inválida/passada, sala, preço ou regra de repasse definidos pelo cliente.
- Testes puros de validação podem ser executados em ambiente Deno com
  `deno test supabase/functions/patient-access/index_test.ts`.
- A função foi implantada no destino novo com clínica autoritativa, CORS e
  redirects da origem de desenvolvimento. O cadastro real foi verificado com
  registro temporário e limpeza restrita a esse registro: conta e paciente foram
  criados sem pagamento, consulta ou lançamento financeiro. SMTP de produção
  continua pendente; não anunciar acesso ativo enquanto a confirmação não puder
  ser entregue. Ao publicar o app, acrescente a origem publicada confiável às
  configurações; não aceite origens arbitrárias enviadas pelo navegador.