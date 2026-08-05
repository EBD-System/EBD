# Decisão: envelope único para respostas da API

## Decisão

Todas as rotas HTTP da API passam a responder com um envelope único de sucesso e um envelope único de erro.

- Sucesso: `ok: true`, `message` claro e `data` com o payload útil.
- Erro: `ok: false`, `message` claro e `error` com `stage` e `statusCode`.

## Motivo

O contrato uniforme reduz divergência entre rotas, facilita consumo pelo frontend e evita respostas diferentes para a mesma situação.

## Data

2026-07-17
