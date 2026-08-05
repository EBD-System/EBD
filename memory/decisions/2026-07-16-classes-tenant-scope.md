# Escopo tenant das classes

## Decisão
As rotas de classes continuam com os mesmos endpoints públicos, mas todas as consultas e mutações passam a ser filtradas por `id_cadastro`.

## Motivo
O schema multi-tenant guarda `id_cadastro` em `ebd_classe`, e sem esse filtro o backend mistura turmas de cadastros diferentes.

## Data
2026-07-16
