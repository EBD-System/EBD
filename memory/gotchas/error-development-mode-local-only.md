# Modo detalhado de erro

## Problema
Mensagens detalhadas de backend só aparecem quando `errorDevelopmentMode=true`.

## Causa
O `server.js` local expõe `src/app/config/error.js` dinamicamente com base no `.env`; já o build estático para GitHub Pages usa o arquivo padrão com `errorDevelopmentMode=false`.

## Solução
- Para depuração local, defina `NODE_ENV=development` e `errorDevelopmentMode=true` no `.env` e rode o Express.
- Para publicação, mantenha o padrão `false` para evitar mensagens técnicas demais para o usuário final.
- O resumo de falhas em lote não deve remover informação útil do backend; ele só deve evitar o prefixo `HTTP ...` repetido quando a mensagem já vier detalhada.
