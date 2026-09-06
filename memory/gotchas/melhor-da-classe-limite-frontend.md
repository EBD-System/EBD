# Gotcha — Melhor da Classe e o normalizador de ranking

## Problema
O endpoint de **Melhor da Classe** pode retornar todos os alunos corretamente, mas o frontend compartilhava `normalizeRankingList()`, que aplicava `.slice(0, 10)` e descartava os itens excedentes antes da renderização.

## Solução
O fluxo `fetchClassStudentsRanking()` deve usar um normalizador próprio (`normalizeClassStudentsRankingList()`), sem truncamento. Os normalizadores de rankings que são realmente "Top 10" continuam com o limite explícito.

## Aplicação
Aplica-se ao service `src/modules/relatorios/services/relatorios.service.js` e ao artefato publicado em `docs/src/modules/relatorios/services/relatorios.service.js`.
