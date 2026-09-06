# Sessão 2026-08-04

## O que foi alterado
- A tela de chamada continua enviando o resumo consolidado em `PUT /attendance/:callId/summary`.
- O frontend agora depende do backend devolver `visitantes` persistido para manter o valor exibido após salvar.
- Os cards de classe passaram a ler `visitantes` como parte do resumo consolidado.

## Conhecimento consolidado
- O campo `visitantes` do resumo não deve ser tratado como valor descartável; ele precisa voltar no payload salvo.
- O detalhe nominal de visitantes continua separado no backend, mas não substitui o resumo consolidado.

## Próximos passos
- Manter o contrato de leitura e escrita do resumo alinhado ao backend.


## Atualização
- A tela de classes passou a reconhecer `oferta`/`valor_oferta` no resumo consolidado e a exibir o valor formatado em BRL no card e no relatório geral.
