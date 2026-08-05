# Decisão: transferência de aluno usa fluxo próprio

## Decisão

A transferência de aluno entre turmas passa a ser executada por uma função SQL específica (`fn_ebd_transferir_aluno`) e por um endpoint dedicado no backend (`PUT /api/v1/students/:id/transfer`). O fluxo não reutiliza a matrícula original para mudar de turma.

## Motivo

A matrícula continua sendo o fluxo de primeira inclusão do aluno. A transferência precisa encerrar o vínculo ativo anterior, abrir o novo vínculo e preservar o histórico sem criar um novo aluno.

## Data

2026-07-19
