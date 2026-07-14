# Armadilha: POST pode virar GET no proxy

## Problema

Algumas integrações HTTP respondem melhor quando o mesmo endpoint aceita GET além de POST. Em salvamentos grandes, duplicar `rowsJson` na query string pode estourar o tamanho da URL.

## Causa

O deploy ou o proxy intermediário pode reencaminhar a requisição ou impor limites de URL.

## Solução

Manter o lote de alunos no corpo do POST e repetir a requisição como GET apenas quando houver fallback real. Não espelhar `rowsJson` na URL.
