# Decisão: status da chamada com observação em transação na API

## Decisão

A mutação de presença passou a ser tratada na API com atualização transacional de `status` e `observacao`, validando tenant, data da chamada, estado de fechamento e vínculo do aluno à classe antes do update.

## Motivo

A função de PostgreSQL existente não persiste observação na troca de status, então o repository precisa assumir essa responsabilidade para não perder o texto informado pelo usuário e para manter as regras de negócio íntegras.

## Data

2026-07-17
