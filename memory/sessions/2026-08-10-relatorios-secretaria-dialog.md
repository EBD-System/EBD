# Sessão 2026-08-10 — Relatórios visível para Secretaria com bloqueio

## O que foi alterado
- O dashboard deixou de ocultar o card `Relatórios` para `Secretaria`.
- O backend continua bloqueando `Secretaria` no `GET /api/v1/reports/access`.
- Ao clicar em `Relatórios`, o hub recebe HTTP 403, oculta a shell e abre `APP_ACCESS_DENIED_DIALOG`, com retorno para o dashboard.

## Conhecimento consolidado
- Para `Secretaria`, a regra é **visibilidade sem autorização**: o módulo deve aparecer na navegação, mas a entrada deve ser recusada pelo backend e apresentada pelo diálogo padrão no frontend.
- Não usar filtro no dashboard para esconder o card quando a intenção for reproduzir o comportamento de bloqueio já usado em outros módulos.
