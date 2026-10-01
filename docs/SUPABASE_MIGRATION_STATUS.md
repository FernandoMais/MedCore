# Situação da transferência Supabase

## Decisão atual: começar do zero

Em 01/10/2026, o usuário autorizou iniciar o aplicativo novo sem importar
os registros antigos. A reconciliação/importação descrita abaixo passou
a ser histórica, não a próxima etapa autorizada.

O código e as melhorias existentes serão mantidos. O projeto antigo,
o backup fornecido e o armazenamento antigo do navegador não serão apagados.
A instalação limpa usa outra chave de armazenamento, sem copiar dados antigos
ou dados de demonstração. O login dessa instalação exige Supabase Auth e
um perfil de equipe vinculado pelo operador à clínica nova.

Conferência somente leitura do destino: 20 tabelas protegidas por RLS,
zero registros do aplicativo, zero contas Auth e zero objetos Storage.
O utilitário `scripts/setup-fresh-admin.mjs --check` confirmou esse estado.
`--apply-admin` exige conexão nova, credenciais fornecidas por Secrets e
destino ainda vazio; cria somente o primeiro administrador e confere login/RLS.

**Concluído:** conexão do aplicativo substituída pelo formulário seguro e
primeiro administrador criado no Auth com perfil vinculado à clínica nova.
Login, vínculo de clínica e bloqueio da leitura de senhas foram conferidos
no Supabase real. O teste de navegador autenticado confirmou o painel com
Cloud Online, uma conta de equipe e todas as coleções clínicas/financeiras
vazias, sem chamadas ao projeto antigo. Só as configurações iniciais da clínica
foram persistidas; nenhum registro antigo ou de demonstração foi importado.
O armazenamento antigo foi preservado no teste isolado.

Ativação remota do portal e serviços de e-mail continuam com suas próprias
etapas de configuração/validação. Não importar o backup sem nova autorização.

Os testes unitários passaram e a construção de produção foi conferida.
O operador de criação inicial não deve ser repetido em uma clínica já iniciada:
sua proteção exige destino vazio antes de criar a conta.

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

## Concluído: análise do backup fornecido

O usuário forneceu um `.gz` do banco antigo. A compressão é íntegra e o
conteúdo é um dump PostgreSQL em texto SQL, com aproximadamente 3,2 MB
descomprimidos. A análise foi somente leitura, sem execução do dump.

Contagens das seções COPY encontradas no arquivo:

| Tabela | Registros |
| --- | ---: |
| `public.patients` | 6 |
| `public.doctors` | 5 |
| `public.appointments` | 18 |
| `public.users` | 5 |
| `auth.users` | 0 |
| `storage.objects` | 0 |

Há três arquivos de pacientes embutidos como URLs `data:` no JSON. Não foram
encontrados vínculos órfãos entre os quatro conjuntos públicos nem IDs ou CPFs
normalizados duplicados. Os perfis têm quatro papéis `doctor` e um `admin`.
Cinco dos seis CPFs não passam na validação de dígitos verificadores; três
pacientes não possuem e-mail. Esses valores não foram exibidos nem corrigidos.

O arquivo contém somente quatro tabelas públicas. Não contém tabelas
financeiras, de evolução ou de notas sigilosas. Isso **não comprova ausência**
desses dados no aplicativo ou em registros posteriores; os dados locais ainda
precisam ser conferidos.

O nome do arquivo indica 20/09/2026; não há cabeçalho de início/fim do dump que
confirme a data. A data de download não é a data dos dados copiados.

Compatibilidade a resolver antes da importação:

- As quatro tabelas antigas não possuem `clinicId`; a clínica não pode ser
  atribuída arbitrariamente. O usuário confirmou que todos os registros
  pertencem a uma única clínica; o identificador existente ainda precisa
  ser conciliado com os dados locais.
- `users.doctorId` precisa de mapeamento explícito para `users.doctor_id`.
- Os timestamps extras `appointments.createdAt`, `users.createdAt` e
  `doctors.updatedAt` devem ser preservados, não descartados silenciosamente.
- Os cinco perfis antigos não equivalem a contas Supabase Auth. O dump não
  fornece contas Auth ou senhas Auth para transferir.
- CPFs inválidos/e-mails ausentes precisam de revisão antes de habilitar
  cadastro/login dos pacientes; a migração não deve inventar esses dados.

Nenhum registro do backup foi importado. Nenhum conteúdo individual ou senha
foi publicado no chat. O arquivo comprimido está excluído do versionamento.

## Dados adicionais confirmados

O usuário confirmou que há dados adicionais no aplicativo fora do dump
fornecido. Portanto, esse dump não é a única fonte autorizada para a
transferência. É necessário obter cópias locais dos navegadores/dispositivos
relevantes e conciliar os conjuntos por IDs antes de importar ou trocar a conexão.

O problema do botão de backup foi aceito como trabalho separado e está
aguardando execução. A coleta alternativa não deve modificar o armazenamento
local, restaurar arquivos ou alterar contas/permissões.

## Ainda não concluído

- Backup e reconciliação dos dados locais em cada navegador/dispositivo.
- Conferência do banco atual e reconciliação do backup fornecido com os dados locais.
- Transferência dos registros e das contas Auth, preservando IDs e hashes.
- Cópia e conferência de arquivos, se existirem.
- Configuração de Edge Functions, Auth, SMTP e demais serviços no destino.
- Testes reais de login, recuperação, permissões e entrega de e-mails.
- Troca da conexão, tanto em desenvolvimento quanto no aplicativo publicado.

**A conexão do aplicativo permanece inalterada.** Não execute o bootstrap
novamente no destino já preparado. Siga o roteiro
`docs/SUPABASE_NEW_PROJECT_MIGRATION.md` para as próximas etapas.