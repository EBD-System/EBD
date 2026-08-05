# Decisão: tenant resolvido pelo JWT nas rotas autenticadas

## Decisão

Nas rotas autenticadas, o `id_cadastro` oficial passa a vir do JWT/`req.user` e do contexto autenticado setado pelo middleware. Entradas de tenant por `query`, `body` ou headers do frontend deixaram de ser consideradas para consultas e mutações sensíveis. O fallback legado por objeto `cadastro` também foi removido.

## Motivo

Isso reduz a superfície de spoofing de tenant, evita dependência de parâmetros controlados pelo cliente e garante que pessoas, alunos, classes, chamadas e relatórios sejam sempre escopados ao cadastro do usuário autenticado.

## Data

2026-07-17
