# Regras de roteamento da API

## Regra

Toda nova funcionalidade HTTP deve ser adicionada somente em `src/routes/v1`.

## Aplicação

- `src/routes/index.js` foi removido.
- `src/app.js` mantém `/api/v1` como contrato oficial exclusivo.
- Não existe mais compatibilidade em `/api` e `/`.
- A implementação interna deve ser organizada por módulos em `src/modules/<modulo>/`.
