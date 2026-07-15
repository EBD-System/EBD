# Fonte de dados

## Decisão

O PostgreSQL continua sendo a fonte oficial de dados do sistema. Para desenvolvimento local e demonstração, existe um modo de banco fake no frontend controlado por `DEV_FAKE_DATABASE`.

## Motivo

A base do projeto segue descrita em `backend/backend.sql`, mas o frontend agora consegue operar sem o servidor real quando o modo fake está ativo. Esse modo usa `backend/exampleDb.json` como seed e mantém o estado mutável no navegador.

## Observação

Quando `DEV_FAKE_DATABASE = true`, a camada `api.js` desvia as consultas e salvamentos para o banco fake local. Quando `false`, o fluxo volta a usar a API HTTP que conversa com o PostgreSQL.

## Data

2026-07-14
