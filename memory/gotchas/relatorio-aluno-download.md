# Relatório do Aluno — fallback de download

## Problema
O `GET /reports/student-report` pode retornar erro 5xx mesmo quando o detalhamento de presenças do mesmo período está disponível. Além disso, o carregamento externo do `jsPDF` pode falhar no navegador.

## Solução
O service `fetchStudentReport(...)` tenta primeiro o endpoint individual. Para `404`, `405`, `500`, `502` ou `503`, ou quando a resposta válida não contém `aluno`, ele usa `fetchPeriodPdfDetails(...)` e reconstrói o relatório do aluno filtrando por `id_aluno`/aliases, turma e, como fallback, nome. `atrasado` conta como presença e entra separado no total de atrasos.

Na camada de página, se `window.jspdf.jsPDF` estiver indisponível, o download usa um gerador PDF nativo mínimo, sem dependência externa.

## Aplicação
- `src/modules/relatorios/services/relatorios.service.js`
- `src/modules/relatorios/pages/relatorio-aluno.js`
- `test/relatorios-service.test.js`
