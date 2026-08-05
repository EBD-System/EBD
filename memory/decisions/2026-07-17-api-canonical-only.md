# Decisão: API apenas com rotas canônicas e autenticadas

## Decisão

A API passou a expor somente a superfície canônica em `/api/v1`. As rotas legadas de compatibilidade em `/` e `/api`, os aliases em português e o endpoint público de registro foram removidos.

## Motivo

A base está sendo endurecida para reconstrução do frontend, reduzindo superfície legada, rotas genéricas e mutações públicas sem autenticação.

## Data

2026-07-17
