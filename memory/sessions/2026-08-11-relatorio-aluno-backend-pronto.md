# Sessão 2026-08-11 — contrato backend do Relatório do Aluno

## O que foi preparado
- Endpoint autenticado `GET /api/v1/reports/student-report` com `studentId`, `startDate` e `endDate`.
- Resposta com identificação do aluno, classe, resumo e série mensal de presença.
- `atrasado` entra como presença no percentual.
- Consulta de alunos da classe permanece em `GET /api/v1/classes/:id/students`.

## Próximo passo do frontend
Criar o submódulo abaixo de “Melhor da Classe” com período, seleção de classe, busca de aluno e botão `BAIXAR` que consuma o relatório.
