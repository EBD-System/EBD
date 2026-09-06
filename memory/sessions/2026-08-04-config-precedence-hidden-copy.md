# Sessão 2026-08-04 — Precedência de configuração e copys ocultas

## O que foi alterado
- `src/app/config/config.js` passou a centralizar `developmentMode`, a lista de módulos visíveis no modo reduzido e as copys da página de classes.
- `server.js` continua injetando `process.env.developmentMode` antes do carregamento do config estático.
- A página de classes agora usa os textos compartilhados do config e mantém as frases solicitadas em um bloco oculto.

## Conhecimento consolidado
- A precedência prática ficou: `process.env.developmentMode` no servidor local > `src/app/config/config.js` > fallback embutido no código.
- As frases de apoio da página de classes devem vir do config compartilhado para evitar hardcode espalhado.

## Próximos passos
- Ajustar o `process.env.developmentMode` apenas no ambiente local quando for necessário filtrar a navegação.
