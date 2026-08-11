# Sessão 2026-08-10 — rankings da tela de Classes para Secretaria

## O que foi alterado
- Nenhuma mudança funcional foi necessária em `frontend/src/modules/classe/pages/classes.js`.
- O frontend já solicitava `presence-ranking` e `offers-ranking` corretamente; o erro 403 vinha da autorização backend.
- Com o backend liberando essas duas rotas para `CLASSES_VIEW`, a tela de Classes deixa de abrir o diálogo de erro durante a sincronização dos rankings.

## Conhecimento consolidado
- O relatório geral e os rankings exibidos dentro de Classes fazem parte do fluxo do módulo Classes.
- O bloqueio do módulo Relatórios para `Secretaria` não deve ser aplicado às APIs auxiliares que a tela de Classes usa internamente.
