# Sessão 2026-07-21 — Mensagens de erro centralizadas

## O que foi alterado
- Criação do cliente compartilhado `src/shared/services/api-client.js` para leitura padronizada de respostas, criação de erros e resumo de falhas em lote.
- As telas de login, classes e chamada passaram a consumir esse cliente para mostrar mensagens de erro consistentes.
- O Express local agora expõe `src/app/config/error.js` com base no `.env`, permitindo ligar/desligar o modo detalhado com `errorDevelopmentMode`.
- O resumo de falhas em lote foi ajustado para preservar o detalhe bruto do backend sem duplicar o prefixo `HTTP ...`.
- O arquivo `.env` de desenvolvimento define `NODE_ENV=development` e `errorDevelopmentMode=true`.

## Conhecimento consolidado
- Erros de backend não devem mais ser montados de forma espalhada nos módulos de página.
- O modo detalhado deve ficar disponível apenas quando `errorDevelopmentMode=true`; em produção, a interface precisa continuar com mensagens simples.
- O resumo de falhas em lote da chamada deve sair do utilitário compartilhado para manter o formato consistente e manter o detalhe do backend quando o modo de desenvolvimento estiver ativo.

## Próximos passos
- Se surgir outro módulo com `fetch`, ele deve reutilizar `src/shared/services/api-client.js` para não duplicar regras de erro.
