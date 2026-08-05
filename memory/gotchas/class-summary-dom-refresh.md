# Resumo da chamada preso em loading

## Problema
Os cards de classe podem exibir o placeholder de sincronização mesmo depois que a API responde.

## Causa
O `fetch` atualiza apenas o estado em memória. Sem um helper que reaplique o trecho de resumo no DOM do card, o HTML renderizado inicialmente permanece visível.

## Solução
Após o retorno da API, atualizar explicitamente o card correspondente via DOM usando `classId` e reaplicar o bloco de resumo ou erro no elemento `.class-card__meta`.

END
