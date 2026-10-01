# Situação da transferência Supabase

## Concluído: estrutura do destino

O projeto de destino confirmado pelo usuário é `zktvrcaeztmzmsdjcjsa`.
Antes da instalação, a API de administração confirmou que o projeto estava
ativo e sem tabelas do aplicativo, contas Auth ou objetos no Storage.

O arquivo `supabase_new_project.sql` foi aplicado somente nesse destino.
A conferência posterior no Supabase hospedado confirmou:

- 20 tabelas do aplicativo presentes, todas com RLS ativa.
- Nenhuma tabela/view do aplicativo com leitura concedida a `anon`.
- `authenticated` sem privilégio de leitura da coluna `users.password`.
- Nenhuma coluna `patients.patientPassword`.
- Zero contas Auth e objetos Storage: nenhum cadastro ou arquivo foi criado
  ou transferido por essa instalação.

O utilitário de operador é `scripts/bootstrap-supabase-target.mjs`. Ele compara
o destino com a origem configurada, exige um destino vazio e consulta por padrão.
Somente `--apply-bootstrap` aplica o SQL protegido. Não é um importador de dados.
Os oito testes Node dos utilitários de bootstrap e hashes passaram.

## Bloqueio: origem pausada e API indisponível

A conexão atual identifica a origem como `fddyuaotpplsnocgvhby`.
O token autorizado permite administrar o destino, mas a origem respondeu
HTTP 403 na consulta de inventário, na consulta de metadados do projeto e
no endpoint dedicado de SQL somente leitura.

O usuário confirmou posteriormente que consegue abrir esse projeto no painel
e que ele está **pausado**. O retorno 403, sozinho, não comprova que a conta
não tem acesso: é necessário conferir o estado e as opções de recuperação
no painel, além das permissões do token, antes de determinar a causa.

Por isso, **não foi possível conferir as tabelas, contagens, contas Auth ou
arquivos da origem**. Não se pode concluir que ela está vazia, que foi excluída
ou que não há dados remotos. É necessário acesso autorizado à origem ou um
backup/exportação preparado por quem administra esse projeto.

Não foram alterados registros, permissões ou configurações da origem.
O projeto antigo não foi reativado. Reativá-lo pode reconectar aplicativos,
sincronizações e rotinas existentes; a recuperação precisa ser controlada.

## Ainda não concluído

- Backup e reconciliação dos dados locais em cada navegador/dispositivo.
- Inventário e backup autorizado da origem.
- Transferência dos registros e das contas Auth, preservando IDs e hashes.
- Cópia e conferência de arquivos, se existirem.
- Configuração de Edge Functions, Auth, SMTP e demais serviços no destino.
- Testes reais de login, recuperação, permissões e entrega de e-mails.
- Troca da conexão, tanto em desenvolvimento quanto no aplicativo publicado.

**A conexão do aplicativo permanece inalterada.** Não execute o bootstrap
novamente no destino já preparado. Siga o roteiro
`docs/SUPABASE_NEW_PROJECT_MIGRATION.md` para as próximas etapas.