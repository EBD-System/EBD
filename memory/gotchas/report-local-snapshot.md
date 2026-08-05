# Armadilha: relatório não pode confiar no snapshot local

## Problema
O PDF podia sair com dados divergentes quando o navegador tinha um snapshot local antigo ou incorreto.

## Causa
A montagem do relatório usava o estado do frontend, que pode ficar diferente da planilha quando há rascunho local, cache ou salvamento anterior inconsistente.

## Solução
Antes de gerar o PDF, buscar o relatório oficial no backend com `action=reporttext` e montar o documento a partir desse texto; `preferLocal: false` não é mais suficiente porque o PDF não deve depender do estado do frontend.
