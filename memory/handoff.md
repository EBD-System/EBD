# Handoff

Projeto atual: `ebd-api`.

## Estado atual

- A API oficial expõe somente `/api/v1`.
- O contrato padrão de resposta segue `ok`, `message` e `data` em sucesso, e `ok`, `message` e `error` em falha.
- A implementação canônica vive em `src/modules/<modulo>/`, com `controller`, `service`, `repository`, `routes` e `validator`.
- Os módulos ativos são `auth`, `pessoas`, `classes`, `alunos`, `chamadas` e `relatorios`.
- A autenticação usa JWT com `id_cadastro` explícito no token e o tenant das rotas autenticadas é resolvido a partir do JWT.
- O campo `sexo` de pessoa é normalizado na borda: a API aceita `nao_informado`, `masculino`, `feminino` e `outro`, a persistência grava `nao_informado`, `M`, `F` e `outro`, e as respostas voltam em formato textual da API.
- A suíte automatizada cobre login, autorização, tenant scoping, tratamento global de erros e os módulos de negócio.
- O fluxo oficial de login em testes usa `teste` / `123456` e grava JWT, usuário e payload compartilhados em `src/shared/flow-context.js` para subtestes sequenciais; o contexto compartilhado também guarda as 6 turmas padrão carregadas após a autenticação.
- A transferência de aluno entre turmas agora tem fluxo dedicado no backend em `PUT /api/v1/students/:id/transfer`, acoplado à função SQL `fn_ebd_transferir_aluno`.
- O módulo de alunos ganhou o endpoint `PUT /api/v1/students/:id/observation` para persistir `ebd_aluno.observacao`, separado da edição cadastral em `/api/v1/people/:id`.
- O módulo de relatórios ganhou `GET /api/v1/reports/period` para consolidar um snapshot de período com `periodo`, `consultedAt`, `summary` e `activities`, sempre escopado por `id_cadastro` do JWT.
- No relatório de período, `total_alunos` em cada atividade representa a contagem completa de alunos ativos da turma naquela data; não deve ser calculado apenas a partir dos presentes, senão o card fica inconsistente com os ausentes.
- O card `Total` do relatório de período no frontend deve ser calculado como `presentes + visitantes`; `Matriculados` continua vindo de `total_alunos`.
- A rota de período deve importar `validateReportsPeriodQuery` do módulo local `./validator`; importar apenas o nome sem binding quebra o boot do servidor com `ReferenceError`.
- As consultas de aluno usadas pela edição precisam expor também os dados cadastrais da pessoa (sexo, CPF, nascimento, contato e endereço), porque a tela de edição é hidratada a partir do payload de aluno.
- As consultas de aluno usadas pela edição precisam normalizar `sexo` da pessoa para a forma textual da API (`masculino`, `feminino`, `outro`, `nao_informado`), senão o select da edição fica vazio quando o banco retorna `M`/`F`.
- A validação de mutação da chamada normaliza `data_chamada` para dia civil em `America/Bahia` antes de comparar com `todayISO()`, porque o PostgreSQL pode devolver `Date`/timestamp e a comparação crua quebrava o PATCH de presença e a reabertura no mesmo dia.

## Estado atual


- A busca de motivo de inatividade de alunos foi consolidada para evitar uma requisição por aluno: `GET /api/v1/students/inactive-reasons?ids=...` responde em lote e as listagens de alunos também expõem `inactive_reason` com fallback do histórico.

- O endpoint `POST /api/v1/students/enroll` agora devolve o aluno enriquecido, incluindo `id_aluno_classe` e campos principais do vínculo, mantendo `id_aluno` no topo.

## Pontos de atenção

- Não reintroduzir superfície legada em `/` ou `/api`.
- Não depender de tenant vindo do frontend em rotas autenticadas.
- Tokens antigos sem `id_cadastro` devem ser tratados como inválidos.
- Novos testes autenticados devem reaproveitar o estado compartilhado de `src/shared/flow-context.js` quando houver sequência de subtestes, inclusive para `auth` e para as turmas padrão.
- Qualquer novo controller assíncrono deve continuar usando `asyncHandler(...)`.
- Qualquer novo fluxo que persista `sexo` de pessoa deve reutilizar a normalização canônica para não reintroduzir a divergência entre API e banco.
- Qualquer novo fluxo de transferência de aluno deve preservar o vínculo ativo anterior, abrir um novo vínculo e manter o histórico via SQL dedicado.
- Qualquer fluxo que persista `telefone` de pessoa deve normalizar para dígitos antes de gravar e respeitar o limite de 11 dígitos do banco.
- A mutação de presença e a reabertura de chamada dependem de comparação por dia civil; não reintroduzir igualdade direta entre `Date` e string ISO.
- Os resumos de chamada (`/attendance/summary` e `/attendance/classes/:classId/summary`) e o ranking de presença passaram a contar `atrasado` dentro de `presentes`; o campo `atrasados` continua existindo apenas como contagem separada, sem novo campo agregado.
- `visitantes` passou a ser uma coluna persistida em `ebd_chamada`; o resumo da chamada escreve `oferta`, `visitantes`, `biblias` e `revistas`, enquanto `ebd_chamada_visitante` continua guardando o detalhe nominal dos visitantes.
- Queries de atualização do resumo precisam manter placeholders contínuos e não enviar parâmetros órfãos ao `pg`, senão o PostgreSQL pode falhar com inferência de tipo.

- A atualização de presença agora deve localizar a linha histórica da chamada sem depender de `ebd_aluno_classe.ativo = TRUE`; o bloqueio continua apenas para chamadas fechadas, fora do dia civil atual ou alunos inativos.
- Qualquer nova resposta HTTP deve manter o envelope oficial centralizado no helper de resposta.
- O salvamento oficial da chamada agora tem endpoint em lote em `PATCH /api/v1/attendance/:callId`, com `students[]` e transação única no repository; a rota legada `PATCH /api/v1/attendance/:callId/students/:studentClassId` continua disponível por compatibilidade.
- A validação do payload em lote rejeita lista vazia, itens não-objeto e `studentClassId` duplicado antes de entrar no service.

## Próximos passos

- Continuar novos fluxos de teste a partir do auth armazenado no contexto compartilhado.
- Manter novas rotas e serviços estritamente dentro de `src/modules` e `src/routes/v1`.
- Expandir a cobertura apenas com conhecimento consolidado que mereça ficar na memória viva.

## Classes

- A listagem de classes passou a vir de `public.fn_ebd_classes_do_cadastro(id_cadastro, date)` para incluir `chamada_ja_feita`, `id_chamada` e `chamada_fechada` sem perder os campos já existentes.
- O endpoint `GET /api/v1/classes` continua autenticado e agora pode receber `date` opcional na query; quando ausente, a função SQL usa a data atual.


- O PATCH em lote de presença agora tolera linhas ausentes em `ebd_chamada_aluno` para alunos ativos da turma atual, criando o vínculo na hora da atualização antes de aplicar o status.

- O módulo de chamadas ganhou escrita dedicada para o resumo da chamada em `PUT`/`PATCH /api/v1/attendance/:callId/summary`.
- O dump SQL foi alinhado com a função `fn_ebd_registrar_oferta`, que estava ausente e quebrava a persistência da oferta.
- As consultas de resumo usam `ebd_chamada.visitantes` como total consolidado; o detalhe nominal dos visitantes continua em `ebd_chamada_visitante`.

- O servidor executa uma migração de startup para garantir a coluna `visitantes` em `ebd_chamada` quando ainda não existir.
