# Novo projeto Supabase preservando os dados

Este roteiro descreve a transferência; ele **não comprova uma transferência
de dados executada**. O progresso autorizado está registrado em
`docs/SUPABASE_MIGRATION_STATUS.md`. Não altere a conexão do aplicativo antes
das conferências abaixo.

## 1. Preparar a origem e impedir perda de dados

1. Confirme qual projeto Supabase o aplicativo realmente usa.
2. Faça backup completo do banco e guarde em local privado, fora do repositório.
3. Exporte também o backup do aplicativo em cada navegador/dispositivo que
   possa ter alterações locais ainda não sincronizadas. Um dump do Supabase
   **não inclui** localStorage. Não limpe os navegadores.
4. Um operador autorizado deve reconciliar os backups locais com o banco por
   IDs; nunca importar todos indiscriminadamente ou duplicar cobranças.
5. Faça uma janela de manutenção para a cópia definitiva: suspenda novos
   cadastros, consultas, lançamentos e alterações tanto na nuvem quanto nos
   navegadores. Suspenda agendadores, webhooks e filas que possam escrever ou
   enviar e-mails. Os backups usados precisam refletir esse mesmo momento.
6. Anote as referências dos projetos antigo e novo. Não compartilhe senhas,
   chaves, dumps de pacientes ou links de recuperação em chat.

Execute `supabase/new-project/00_source_inventory.sql` no SQL Editor da
**origem**. É uma consulta de inventário, sem alterações. Confira tabelas,
colunas, contagens, clínicas, vínculos Auth, CPFs e referências de arquivos.
As contagens não contêm cadastros individuais, mas ainda devem ser guardadas
de forma privada.

**Se aparecerem tabelas/colunas personalizadas, dados sem clínica, CPF
duplicado ou vínculos conflitantes, interrompa e revise antes de importar.**
Não escolha uma clínica arbitrária nem exclua registros para fazer o SQL passar.

## 2. Escolher a forma de cópia

### Se a origem estiver pausada

Confira as opções exibidas no painel do projeto antigo antes de executar
qualquer ação. A documentação atual do Supabase permite retomar projetos
dentro da janela de restauração; fora dela, pode ser necessário baixar os
backups disponíveis do banco e dos objetos Storage.

- Não exclua o projeto antigo: excluir também pode remover os backups.
- Se houver download de backups, guarde os arquivos de forma privada. Essa
  cópia não inclui alterações ainda locais nos navegadores.
- Não retome a origem sem avaliar sincronizações, agendadores, webhooks e
  demais operações externas. Aplicativos ainda ligados a ela podem reconectar.
- O destino já preparado com a estrutura protegida **não deve receber um dump
  completo do schema antigo por cima**. Primeiro revise o inventário e prepare
  a importação somente de dados descrita na opção B.

Veja [pausa e retomada](https://supabase.com/docs/guides/platform/free-project-pausing)
e [recuperação após a janela de retomada](https://supabase.com/docs/guides/troubleshooting/restore-project-after-90-days-pause).
O caminho da segunda página conserva um nome antigo; siga as informações
atuais do conteúdo e do painel, não deduza o prazo pelo endereço.

### Opção A: restauração do Supabase para um novo projeto

Se estiver disponível na sua conta, o Supabase oferece:

**Database → Backups → Restore to a New Project.**

Confira o resumo de custos/recursos mostrado pelo Supabase antes de aceitar.
Essa funcionalidade depende dos requisitos de plano e backup do provedor.

A restauração copia o banco, incluindo contas Auth e senhas já criptografadas,
IDs, permissões antigas e a chave raiz de criptografia. Portanto:

- Não é um banco já atualizado: as proteções atuais precisam ser aplicadas
  **no novo projeto**, após revisar o inventário.
- Não use `supabase_new_project.sql` em um banco clonado/populado. Esse arquivo
  é exclusivo de um projeto vazio.
- Antes de copiar, confira agendadores, webhooks e extensões de operações
  externas. Eles podem executar assim que o clone nasce. Se não houver como
  garantir que não enviem e-mails, cobranças ou outras operações duplicadas,
  use uma restauração lógica supervisionada, não o clone.
- Não conecte o aplicativo nem divulgue as chaves do destino enquanto as
  permissões antigas não forem substituídas e auditadas.
- No destino revisado, execute `supabase_patient_access_migration.sql`.
  Não execute o antigo `supabase_schema.sql`.

**Não são automaticamente copiados:** arquivos e configurações do Storage,
Edge Functions, configurações de Auth/SMTP, URLs, API keys e demais configurações
de serviços. Essas etapas continuam obrigatórias.

### Opção B: projeto vazio com estrutura nova e importação de dados

1. Crie um projeto vazio no painel Supabase.
2. Não crie pacientes ou usuários Auth de teste antes da importação: IDs e
   e-mails existentes poderiam conflitar.
3. Execute **somente no destino vazio** `supabase_new_project.sql`.
4. Compare o inventário da origem com a estrutura do destino.
5. Um operador deve preparar uma importação **apenas de dados**, preservando
   IDs, clínicas, datas, vínculos e JSON. Não restaure o schema, políticas,
   funções, privilégios ou papéis SQL antigos por cima da estrutura protegida.
6. Colunas diferentes, tabelas extras, campos antigos de senha e restrições
   novas exigem um mapeamento explícito. Um dump com `COPY` de uma coluna
   inexistente não é compatível. Não ignore os erros de importação.
7. Faça a importação em transação com interrupção no primeiro erro. Use
   privilégios de operador somente no destino, nunca a chave pública do app.
   As proteções de identidade verificam `auth.role()`; uma conexão SQL de
   operador sem contexto de serviço não consegue importar esses vínculos.
   Execute `03_operator_import_context.sql` dentro da mesma transação dos
   arquivos **de dados revisados**, conforme o exemplo abaixo.

O arquivo novo cobre a estrutura conhecida no código deste aplicativo. Ele
**não adivinha** alterações manuais no banco real. Se houver customizações,
elas devem ser incorporadas e protegidas antes da transferência.

Não há um comando de importação universal seguro sem conhecer o inventário
real. Um operador pode usar `pg_dump` e `psql`, conforme a documentação oficial,
com versões compatíveis com os servidores e credenciais fornecidas por fluxo
seguro. Use a conexão direta ou o Session Pooler recomendado pelo Supabase,
não o Transaction Pooler para esse trabalho.

Após revisar/mapejar os arquivos e confirmar que a conexão segura do `psql`
aponta exclusivamente para o **destino**, o operador pode usar este formato:

```sh
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file supabase/new-project/03_operator_import_context.sql \
  --file .migration-backups/auth-data-revisado.sql \
  --file .migration-backups/public-data-mapeado.sql
```

Forneça a conexão por configuração privada do cliente PostgreSQL, com TLS.
Não execute esse comando com uma conexão padrão que possa apontar à origem.
O exemplo não exporta/mapeia dados: os dois arquivos precisam estar prontos,
compatíveis e revisados. Dados Auth entram antes dos vínculos públicos.
O contexto de serviço usa `SET LOCAL`, expira no fim da transação e não altera
as proteções para usuários do aplicativo. Não desabilite gatilhos ou RLS para
contornar inconsistências. Se houver erro, toda essa importação é revertida.

No schema novo, `sigilous_notes.patient_id` é uma coluna gerada: omita essa
coluna da lista `COPY`/`INSERT` e preserve o valor correspondente do JSON.
Compare também os **foreign keys e demais restrições** da origem, não somente
nomes de colunas e contagens. Não remova vínculos ou constraints para forçar
um dump incompatível.

Se existirem Vault, colunas criptografadas ou chaves externas, uma cópia lógica
exige tratamento da chave de criptografia. Não copie valores criptografados
sem validar que continuam legíveis no destino.

## 3. Preservar contas e acesso

- `public.users` é perfil da equipe, **não** substitui `auth.users`.
- Para preservar senhas já cadastradas no Supabase Auth, migre as contas e
  tabelas relacionadas do esquema Auth pelo procedimento suportado pelo
  Supabase. Preserve UUIDs, identidades, metadados e fatores de autenticação.
  Não copie senhas em texto simples e não edite hashes manualmente.
- Se for a opção A, os dados Auth são incluídos na restauração. Na opção B,
  precisam de uma transferência separada, conferida por operador.
- As versões/esquemas gerenciados de Auth precisam ser compatíveis. Não
  sobrescreva migrations internas do serviço com as do projeto antigo.
- Um projeto com novas chaves de assinatura pode exigir novo login. Isso é
  esperado; não reutilize segredos antigos apenas para evitar novo login.
- Confira `public.users.authUserId`, `clinicId`, papel e o vínculo do
  administrador. Nunca crie vínculos de equipe a partir do e-mail de paciente.
- Contas apenas locais da equipe e pacientes sem conta Auth exigem tratamento
  separado. Pacientes antigos podem receber o link administrativo para criar
  acesso após a configuração; a senha antiga local não deve ser migrada.

### Cadastros de pacientes ainda pendentes

O hash privado do cadastro pendente depende da chave `service_role` do
projeto. Copiar `patient_access_enrollments` sem recalcular esse hash pode
impedir recuperação/login antes do primeiro acesso.

O utilitário `scripts/rehash-patient-enrollments.mjs` verifica os vínculos
somente no **destino** e recalcula apenas `nonce_hash`. Não cria contas, não
troca senhas, não escolhe uma nova identidade e não modifica a origem.

Um operador deve fornecer por ambiente seguro:

- `MIGRATION_TARGET_SUPABASE_URL`: URL canônica do projeto novo.
- `MIGRATION_TARGET_SERVICE_ROLE_KEY`: a chave **service_role legada do destino**,
  exatamente a usada pela variável integrada `SUPABASE_SERVICE_ROLE_KEY` da
  Edge Function. Não use uma chave diferente, mesmo que tenha privilégios
  equivalentes; ela produziria outro HMAC.

Essas variáveis são para o utilitário de operador, nunca variáveis `VITE_*`.
Não cole os valores no código, terminal compartilhado, chat ou SQL Editor.
Não substitua as configurações normais do aplicativo nessa etapa.

Simulação, sem alterar dados:

```sh
node scripts/rehash-patient-enrollments.mjs \
  --source-ref REF_DO_PROJETO_ANTIGO \
  --target-ref REF_DO_PROJETO_NOVO
```

Somente após conferir o destino, ainda em manutenção:

```sh
node scripts/rehash-patient-enrollments.mjs \
  --source-ref REF_DO_PROJETO_ANTIGO \
  --target-ref REF_DO_PROJETO_NOVO \
  --apply
```

O resultado mostra contagens, nunca nonces, e-mails ou chaves. Vínculo
inconsistente interrompe a operação. Se uma escrita falhar, mudanças anteriores
no destino podem ter sido feitas; confira e repita a simulação. A correção é
reexecutável. Não habilite acesso concorrente durante o procedimento.
Uma inscrição privada que já tenha `patients.authUserId` vinculado é
inconsistente com o gatilho de inscrição pendente: a simulação a rejeita antes
de escrever qualquer hash. Faça uma revisão separada dessa inscrição antiga,
sem desvincular o paciente nem excluir identidades automaticamente.

## 4. Preservar arquivos

1. Confira se os documentos estão embutidos em `patients.files` como `data:`,
   em Supabase Storage ou em outro serviço.
2. Dados `data:` são preservados se o JSON completo for importado corretamente.
3. No Storage, copie os **bytes reais**, não apenas `storage.objects`.
4. Recrie os buckets com a mesma privacidade, limites e tipos permitidos;
   revise as permissões de acesso. Não torne exames públicos para facilitar.
5. Compare contagens e integridade do conteúdo dos arquivos.
6. Revise as referências em `patients.files` e demais registros. URLs absolutas
   do projeto antigo continuam apontando para ele. URLs assinadas precisam
   ser geradas novamente no destino; trocar apenas o domínio não funciona.
7. Teste abertura/download dos documentos no app com usuário autorizado.

**Não desative nem exclua a origem enquanto houver arquivo ou referência
dependendo dela.** O utilitário de hashes não copia arquivos nem corrige URLs.
Se houver arquivos em Storage, essa fase requer uma cópia dedicada por
operador; ela não foi executada ou automatizada nesta preparação.

## 5. Configurar os serviços no destino

Siga `docs/PATIENT_ACCESS_SETUP.md`, mas sempre no **novo projeto**:

- Deploy da Edge Function `patient-access` e demais funções usadas no sistema.
- Configurações `PATIENT_CLINIC_ID` e `PATIENT_APP_ORIGINS`.
- Auth por e-mail/senha, confirmação e URL allowlist.
- SMTP autorizado para envio real.
- Confirmação de cadastro com `{{ .ConfirmationURL }}`.
- Recuperação com `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery`.
- Realtime, integrações, tarefas agendadas e demais configurações, se existirem.

Evite dois projetos enviando a mesma cobrança/e-mail. Não ative agendadores,
filas ou funções externas até definir claramente qual projeto é o ativo.

## 6. Conferir antes de trocar a conexão

Execute `supabase/new-project/02_target_verification.sql` no destino e compare
com o inventário da origem. As consultas não corrigem dados automaticamente.

Critérios obrigatórios:

- Mesmas contagens de registros que devem ser preservados.
- IDs e relacionamentos preservados, sem consultas órfãs, CPFs duplicados ou
  vínculo Auth de paciente usado por equipe.
- Totais de receitas, despesas, saldos e repasses conciliados por clínica e
  período. Contagens iguais sozinhas não comprovam integridade.
- Prontuários, evoluções, notas sigilosas e documentos acessíveis corretamente.
- Login real da equipe e permissões correspondentes à clínica.
- Cadastro/confirmar e-mail, login CPF/senha, recuperação antes/depois do
  primeiro acesso, reset administrativo e agendamento do paciente.
- Teste negativo com dois pacientes e clínicas diferentes, incluindo chamadas
  diretas às APIs; não basta ocultar botões.
- Nenhum perfil baixado contendo senhas internas.
- E-mails realmente recebidos. Resposta genérica de recuperação não prova entrega.

Se uma conferência falhar, **não troque a conexão**.

## 7. Troca controlada e retorno

1. Guarde a configuração anterior em local seguro. Não a exponha no repositório.
2. Atualize a URL e a chave pública do projeto Supabase no fluxo seguro de
   configuração do aplicativo. Não use service_role no navegador.
3. Verifique tanto o ambiente de testes quanto o aplicativo publicado; ambos
   devem usar a configuração pretendida.
4. Garanta que cache local/sessões/dados pendentes da origem não sejam enviados
   automaticamente ao destino. Reconcile backups locais **antes** de permitir
   a primeira sincronização com a conexão nova.
5. Faça os testes finais e só então reabra o sistema para uso.
6. Mantenha o projeto antigo protegido e em manutenção durante a conferência.

Se precisar voltar **antes de novas escritas**, restaure a conexão antiga.
Se já houver novas escritas no destino, reconciliar esses dados é obrigatório
antes de voltar: trocar apenas a URL pode perder atendimentos e financeiro.
Não mantenha dois projetos recebendo alterações independentes sem um processo
explícito de reconciliação.

## Referências oficiais

- [Backup e restauração](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Restaurar para novo projeto](https://supabase.com/docs/guides/platform/clone-project)
- [Migrar contas Auth](https://supabase.com/docs/guides/troubleshooting/migrating-auth-users-between-projects)

## Verificação desta preparação

O bootstrap e as duas consultas de auditoria passaram em PostgreSQL temporário,
com Auth e papéis Supabase simulados. Foram testadas a recusa de execução em
schema existente, as restrições de leitura de credenciais, a separação de
clínicas/pacientes e a importação autorizada em transação. Também foram
conferidos o reset do contexto após COMMIT e o rollback de uma importação com
erro. O utilitário de hashes passou em seis testes Node com dados fictícios.

Para regenerar o SQL combinado após mudanças revisadas na base ou migração:

```sh
node scripts/build-supabase-new-project.mjs
```

Esse comando gera um arquivo local; não conecta nem aplica SQL a banco algum.

A origem real, o destino real, os dados, os papéis/plataforma hospedados,
Storage, SMTP e o fluxo de produção ainda exigem validação autorizada. Não
trate o pacote local como uma migração concluída.