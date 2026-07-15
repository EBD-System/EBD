# Fonte de dados

## Decisão

O PostgreSQL é a fonte oficial de dados do sistema. O modo fake continua existindo apenas como alternativa local controlada por `window.DEV_FAKE_DATABASE = true`.

## Motivo

A integração principal passou a usar a API HTTP do backend para ler e gravar no PostgreSQL. O arquivo `backend/exampleDb.json` ficou como seed do banco fake local e não como fonte oficial de produção.

## Observação

Quando `DEV_FAKE_DATABASE = false`, o frontend usa a API do backend. Quando `true`, a camada `api.js` desvia para o banco fake local usando `backend/exampleDb.json` como seed inicial.

## Data

2026-07-15
