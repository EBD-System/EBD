# Batch de motivos de inatividade de alunos

## Decisão

A API de alunos passou a expor os motivos de inatividade em duas frentes complementares:

- listagens de alunos agora incluem o campo `inactive_reason`, preenchido a partir de `ebd_aluno.motivo_desligamento` e, como fallback, do último status `inativo` no histórico;
- a rota autenticada `GET /api/v1/students/inactive-reasons?ids=1,2,3` retorna os motivos de inatividade em lote para um conjunto de alunos.

## Motivo

Isso elimina a necessidade de uma requisição por aluno quando o frontend precisa exibir motivos de inatividade, reduz latência e mantém o contrato simples para consumo em massa.

## Data

2026-07-22
