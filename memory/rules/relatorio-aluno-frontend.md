# Relatório do Aluno no frontend

## Regra
O submódulo **Relatório do Aluno** deve ficar na vitrine de Relatórios logo abaixo de **Melhor da Classe** e usar o padrão visual de período adotado pelo Financeiro.

O fluxo deve:
1. carregar as turmas automaticamente ao abrir a página;
2. manter `< SELECIONE >` como opção inicial;
3. ao selecionar uma turma, consultar `GET /api/v1/classes/:id/students`;
4. permitir busca local pelo nome do aluno;
5. exibir `Nome do aluno`, `Classe` e `BAIXAR`;
6. no `BAIXAR`, consultar `GET /api/v1/reports/student-report` com `studentId`, `startDate` e `endDate`;
7. gerar o PDF no frontend a partir do payload retornado, sem usar o DOM como fonte de dados;
8. se `GET /api/v1/reports/student-report` retornar erro transitório `404/405/500/502/503` ou um payload sem `aluno`, o frontend deve tentar o detalhamento de presenças do período (`GET /api/v1/reports/period/pdf`) e reconstruir o relatório individual a partir das linhas do aluno;
9. se o payload individual trouxer resumo de presença mas `meses` vazio, o frontend deve tratar isso como resposta incompleta, tentar o detalhamento do período e manter uma linha para cada mês do intervalo, inclusive meses sem chamadas; em período de um único mês, o resumo pode preencher a linha quando não houver linha detalhada;
9. se o `jsPDF` não estiver disponível, o botão `BAIXAR` deve usar o gerador PDF nativo de fallback do frontend.

## Conteúdo do relatório
O PDF individual deve apresentar:
- nome e classe do aluno;
- período consultado;
- total de presenças, atrasos e ausências;
- percentual de presença do período;
- detalhamento mensal com chamadas, presenças, atrasos, ausências e percentual de presença.

## Integração
O frontend não altera controller, service, repository, validator ou SQL do backend para esse fluxo. O contrato do backend já existente é suficiente.

## Aplicação
Aplica-se a:
- `src/modules/relatorios/relatorio-aluno/index.html`
- `src/modules/relatorios/pages/relatorio-aluno.js`
- `src/modules/relatorios/pages/relatorio-aluno.css`
- `src/modules/relatorios/services/relatorios.service.js`
- `src/modules/relatorios/pages/index.html`
