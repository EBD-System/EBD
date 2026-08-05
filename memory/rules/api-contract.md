# Contrato oficial da API

## Regra

A superfície oficial da API é `/api/v1`. As rotas em `/` e `/api` foram removidas e não fazem mais parte do contrato.

## Regra

Todas as respostas seguem o envelope padronizado do projeto:
- sucesso: `ok`, `message`, `data`
- erro: `ok`, `source`, `stage`, `message`, `error`

## Regra

O tenant oficial das rotas autenticadas é sempre `id_cadastro` do JWT. Não usar `query`, `body` ou headers do frontend como fonte de verdade para tenant.

## Regra

JWTs usados em rotas autenticadas devem conter `id_cadastro` válido.

## Aplicação

Tokens sem tenant canônico são rejeitados com 401 antes de qualquer leitura de contexto autenticado.

## Regra

As permissões são centralizadas por perfil:
- pessoas e alunos: `Administrador`, `Secretaria`
- chamada administrativa: `Administrador`, `Secretaria`
- chamada operacional: `Administrador`, `Secretaria`, `Professor`
- ofertas: `Administrador`, `Secretaria`, `Financeiro`

## Regra

Toda rota deve validar `params`, `query` ou `body` antes de chegar ao service.


## Regra

A exposição de motivos de inatividade de alunos deve preferir resposta em lote:
- listagens de alunos podem incluir `inactive_reason`
- a consulta autenticada em lote usa `GET /api/v1/students/inactive-reasons?ids=...`

## Aplicação

Evitar requisições por aluno quando a interface precisar exibir o motivo de inatividade para vários registros.

## Regra

O endpoint `POST /api/v1/students/enroll` deve devolver a matrícula já enriquecida com o vínculo ativo do aluno, mantendo `id_aluno` no nível superior e expondo `id_aluno_classe` e os principais campos do vínculo/aluno para consumo do frontend.

## Aplicação

Evitar depender de uma consulta extra logo após a matrícula para obter o vínculo recém-criado.

## Regra

O resumo da chamada possui escrita dedicada em `PUT`/`PATCH /api/v1/attendance/:callId/summary`, com os campos `oferta`, `visitantes`, `biblias` e `revistas`.

## Aplicação

O backend deve devolver o resumo salvo com `visitantes` persistido em `ebd_chamada`, para que o frontend não descarte o valor digitado após salvar.

## Regra

A contagem consolidada de visitantes do resumo é persistida em `ebd_chamada.visitantes`. A tabela `ebd_chamada_visitante` continua responsável pelos registros nominais.

## Aplicação

O detalhamento nominal complementa o resumo, mas não substitui o valor consolidado usado pelas telas e relatórios.
