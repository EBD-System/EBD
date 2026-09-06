# Mapa de migração

## O que foi consolidado

- `src/public/1-page-login/*` → `src/modules/auth/pages/login/*`
- `src/public/2-dashboard/*` → `src/modules/dashboard/pages/home/*`
- `src/public/404-error/*` → `src/modules/errors/pages/not-found/*`
- `src/public/page-aluno/*` → `src/modules/aluno/pages/*`
- `src/public/page-chamada/*` → `src/modules/chamada/pages/*`

## O que foi unificado

- As páginas repetidas de `src/pages/classe/1-criancas-menores` até `6-senhoras` foram reduzidas para um único módulo `classe`.
- A lógica comum de API e chaves de sessão saiu do login e foi centralizada em `src/app/config`.

## O que deve sair do tronco do frontend

- Estruturas vazias ou herdadas de backend, como `controllers`, `middlewares` e `routes`, não entram na árvore do frontend estático.
- Arquivos duplicados ou vazios em `src/pages` devem ser substituídos pelo módulo único correspondente.

## Regra prática

Cada novo domínio deve nascer em `src/modules/<dominio>/` com pelo menos:

- `pages/`
- `services/`
- `models/`
- `validators/` quando necessário
