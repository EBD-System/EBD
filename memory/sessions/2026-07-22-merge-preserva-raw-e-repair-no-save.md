# Sessão 2026-07-22 — Preservação do vínculo na mesclagem e reparo final no salvamento

## O que foi alterado
`src/modules/chamada/pages/chamada.js` recebeu reforços para:
- preservar `id_aluno_classe` também em aliases do objeto e no `raw` ao mesclar alunos ativos e inativos;
- manter a chave canônica mesmo quando uma resposta parcial vier incompleta;
- executar uma última reparação do vínculo usando o snapshot da chamada antes de abortar o salvamento.

## Conhecimento consolidado
- O risco não está só no PATCH: a mesclagem local também pode apagar o vínculo se sobrescrever campos vazios.
- O estado da tela deve tratar `attendanceKey`/`studentClassId` como espelho do mesmo vínculo e manter `raw` sincronizado.
- O salvamento continua proibido sem vínculo válido; o reparo final só usa dados reais da API.

## Próximos passos
- Continuar usando o snapshot da chamada como fonte de verdade para completar vínculos ausentes antes de bloquear o envio.
