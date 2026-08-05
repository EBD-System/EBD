# Sessão 2026-08-04

## O que foi alterado
- Corrigido o `UPDATE` de `saveCallSummary` em `src/modules/chamadas/repository.js` para persistir `visitantes` junto com `oferta`, `biblias` e `revistas`.
- Atualizada a memória consolidada para registrar que `visitantes` passou a ser persistido em `ebd_chamada.visitantes`.

## Conhecimento consolidado
- Em queries com parâmetros posicionais, não se pode deixar índices pulados ou argumentos não referenciados no array enviado ao `pg`; isso pode gerar `could not determine data type of parameter $N`.
- O resumo da chamada persiste `oferta`, `visitantes`, `biblias` e `revistas` em `ebd_chamada`; `ebd_chamada_visitante` continua guardando os registros nominais.

## Próximos passos
- Manter a mesma regra em qualquer novo fluxo de resumo ou atualização parcial da chamada.
