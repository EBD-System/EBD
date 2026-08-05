# Logging estruturado e rastreabilidade

## Decisão

A API passou a usar logs estruturados em JSON, com `request_id` por requisição e eventos explícitos apenas para:
- falhas relevantes;
- autenticação;
- matrícula de aluno;
- ações críticas de chamada;
- criação e atualização de pessoas.

## Motivo

A instrumentação precisa facilitar diagnóstico em produção sem poluir a saída com logs de leitura/listagem ou com payloads sensíveis.

## Data

2026-07-17
