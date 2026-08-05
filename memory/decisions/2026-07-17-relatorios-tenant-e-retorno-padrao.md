# Decisão: relatórios agregados escopados por tenant e retorno padronizado

## Decisão

As consultas de relatórios e resumos agregados devem ser sempre filtradas por `id_cadastro` resolvido no JWT. O contrato oficial dos relatórios passa a usar um envelope uniforme com `relatorio`, `id_cadastro`, `data_referencia`, `total_itens` e `itens`.

## Motivo

Isso evita relatório global do banco inteiro, reduz risco de vazamento entre cadastros e dá um formato único para presença, visitantes, ofertas e aniversariantes.

## Data

2026-07-17

## Atualização

Foi adicionado o endpoint autenticado `GET /api/v1/reports/period`, que consolida um snapshot de período com `periodo`, `consultedAt`, `summary` e `activities`, mantendo o escopo por `id_cadastro` e o envelope padronizado.

## Atualização (2026-08-05)

O snapshot de período continua expondo `total_alunos` como a base de matriculados/ativos da turma na data consultada. No card consolidado do frontend, o campo `Total` deve ser calculado como `presentes + visitantes` (onde `presentes` já engloba `atrasado`). Ver `memory/gotchas/relatorio-periodo-total-alunos.md`.

## Atualização (2026-08-04 — período com campos extras)
O snapshot de período passou a expor também `biblias` e `revistas` no `summary` e em cada item de `activities`, mantendo o escopo por `id_cadastro` e o envelope padronizado.
