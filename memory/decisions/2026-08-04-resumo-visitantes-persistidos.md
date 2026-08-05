# Decisão: visitantes do resumo ficam persistidos em `ebd_chamada`

## Decisão
O campo `visitantes` do Resumo da chamada passa a ser persistido em `public.ebd_chamada.visitantes`, junto com `oferta`, `biblias` e `revistas`.

## Motivo
O frontend edita esse valor como parte do resumo da chamada e não podia perder o que foi digitado após o salvamento. A tabela `ebd_chamada_visitante` continua reservada aos registros nominais de visitantes.

## Data
2026-08-04
