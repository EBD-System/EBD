# Sessão 2026-08-04

## O que foi alterado
- A chamada passou a persistir `visitantes` em `public.ebd_chamada.visitantes` junto com `oferta`, `biblias` e `revistas`.
- O backend ganhou uma migração de startup para criar a coluna `visitantes` quando ela ainda não existir.
- O resumo da chamada e o ranking de visitantes passaram a ler o total consolidado da coluna persistida.
- O cadastro nominal de visitantes continua em `ebd_chamada_visitante`.

## Conhecimento consolidado
- O resumo da chamada precisa preservar o valor digitado em `visitantes` após o salvamento.
- `ebd_chamada_visitante` segue como tabela de detalhe; a coluna `visitantes` é a fonte consolidada para leitura do resumo.

## Próximos passos
- Manter os endpoints de resumo e os dumps SQL alinhados com a coluna `visitantes`.
