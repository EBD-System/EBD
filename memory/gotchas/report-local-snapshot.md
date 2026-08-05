# Armadilha: relatório não pode confiar no snapshot local

## Problema
O PDF podia sair com dados divergentes quando o navegador tinha um snapshot local antigo ou incorreto.

## Causa
A montagem do relatório usava o estado do frontend, que pode ficar diferente da planilha quando há rascunho local, cache ou salvamento anterior inconsistente.

## Solução
Antes de gerar o PDF, recarregar os dados do backend/planilha com `preferLocal: false` e montar o relatório a partir dessa resposta.
