# Sessão 2026-07-22 — Salvamento da chamada exclui inativos

## O que foi alterado
`src/modules/chamada/pages/chamada.js` passou a:
- salvar apenas os alunos ativos/elegíveis para a chamada aberta;
- bloquear a edição de presença dos cards inativos;
- contar pendências e resumo apenas para o conjunto salvável;
- manter a validação de `id_aluno_classe` apenas no lote realmente enviado ao backend.

## Conhecimento consolidado
- A listagem da chamada pode conter mais alunos do que o backend materializa na chamada aberta.
- Os cards inativos são úteis para consulta, mas não pertencem ao `PATCH` da chamada.
- A fonte de verdade do salvamento continua sendo o snapshot/vínculo real da chamada aberta.

## Próximos passos
- Manter o filtro de elegibilidade sempre que novas rotinas de salvamento forem adicionadas à tela.
