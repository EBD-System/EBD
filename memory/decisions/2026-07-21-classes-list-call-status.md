# Listagem de classes com status de chamada

## Decisão
A listagem autenticada de classes passou a consumir `public.fn_ebd_classes_do_cadastro(id_cadastro, date)` em vez de montar o SELECT manualmente no repositório.

## Motivo
A função SQL centraliza o cálculo de `total_alunos_ativos` e adiciona `chamada_ja_feita`, `id_chamada` e `chamada_fechada` sem duplicar lógica no backend.

## Data
2026-07-21
