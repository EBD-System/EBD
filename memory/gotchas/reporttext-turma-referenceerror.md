# Armadilha: relatório da turma falhava mesmo após migrar o PDF para `reporttext`

## Problema
Mesmo depois de o frontend passar a montar o PDF a partir de `action=reporttext`
(planilha como fonte oficial), o **Relatório Turma** continuava não vindo da
planilha na prática.

## Causa
Em `backend/backend.gs`, `getReportText_` e `sendReport_` chamavam
`buildTurmaReportText_(...)` para o escopo `turma`, mas a função só existia
definida como `buildTurmasReportText_` (plural, com "s"). Isso gerava um
`ReferenceError` no Apps Script sempre que alguém pedia relatório de turma
específica; `routeRequest_` capturava o erro e devolvia `ok: false`, então o
relatório de turma nunca chegava a ser gerado a partir da planilha.
O relatório geral (`buildGeneralReportText_`) não tinha esse problema porque o
nome da função batia com a chamada.

## Solução
Renomear a definição da função para `buildTurmaReportText_` (singular), igual
aos dois pontos onde ela é chamada. Depois de corrigir, é obrigatório
republicar uma nova versão do Web App do Apps Script — edição salva sozinha
não atualiza o deploy ativo (ver gotcha de deploy/permissão já registrada).
Para confirmar que o deploy novo está no ar, checar `action=health` e
comparar `version`/`deployedAt` com o valor mais recente do código.
