# Sessão 2026-07-21 — Correção de caminhos estáticos

## O que foi alterado
Os `index.html` das páginas de classe e chamada passaram a referenciar `app/config` e `shared/services` com a profundidade correta (`../../../`), eliminando a busca por arquivos inexistentes.

## Conhecimento consolidado
- `src/modules/classe/pages/index.html` e `src/modules/chamada/pages/index.html` ficam a três níveis de `src/`, então os assets compartilhados devem usar `../../../app/...` e `../../../shared/...`.
- O problema não é de bundling; é apenas de path relativo no HTML.

## Próximos passos
Manter essa convenção ao criar novas páginas sob `src/modules/*/pages/` para evitar 404 silencioso em scripts compartilhados.
