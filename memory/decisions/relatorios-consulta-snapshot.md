# Consulta de relatórios por período com snapshot imutável

## Decisão
O módulo de Relatórios deve pesquisar por intervalo de datas em uma única consulta, armazenar o resultado em um snapshot imutável na memória da tela e liberar os downloads apenas após uma resposta positiva. O relatório geral deve reutilizar o snapshot já carregado e não deve ler o DOM para montar o payload.

## Motivo
Isso mantém a futura geração de PDF estável, evita reconsultar o backend desnecessariamente e separa a exibição da fonte canônica dos dados.

## Data
2026-08-04

## Atualização (mesmo dia)
O mock foi retirado. `relatorios.service.js` agora consulta `GET {API_BASE_URL}/reports/period?startDate&endDate` com `Authorization: Bearer <token>`, usando `APP_API_CLIENT` (mesmo padrão de erro de `classes.js`). O snapshot imutável passou a ser o `data` retornado pelo backend, não mais um objeto gerado no frontend.

## Atualização (2026-08-04 — PDF do legado)
O botão **Enviar** chegou a gerar o PDF no próprio frontend, a partir do snapshot em memória, usando `jsPDF` carregado na página. Esse fluxo foi substituído pela atualização posterior que removeu a pré-visualização e passou a baixar o PDF diretamente. O layout do legado segue como referência visual histórica: barra superior escura, cartões de resumo e listagem paginada das atividades.


## Atualização (2026-08-04 — resumo direto e download-only)
O card de resultado passou a ser o ponto canônico de exibição do relatório no frontend. O módulo normaliza as datas antes de exibir o conteúdo, mostra o resumo completo dentro do próprio painel e o fluxo de download foi separado em **Baixar Relatório** e **Presenças**. A pré-visualização em `iframe` foi removida.


## Atualização (2026-08-04 — cards por turma)
Após a consulta por período, o frontend agrupa as atividades por turma, carrega o resumo completo de cada turma a partir da API de resumo da classe (com fallback para o grupo agregado) e monta o total do período somando os cards renderizados. O snapshot continua sendo a fonte canônica para o envio do PDF.

## Atualização (2026-08-04 — cards por turma e total)
O snapshot preservado após a consulta continua sendo a fonte canônica do módulo, mas a interface passou a agrupar as atividades por turma, renderizar cards por turma e montar um card total consolidado a partir do mesmo snapshot. O envio do PDF permanece desligado da leitura do DOM e usa o snapshot já carregado.


## Atualização (2026-08-05 — total exibido)
O snapshot continua sendo a fonte canônica do módulo, mas o campo `Total` mostrado nos cards deve ser derivado de `Presentes + Visitantes`. O campo `Matriculados` continua vindo de `total_alunos` para representar a base ativa da turma.

## Atualização (2026-08-08 — downloads separados)
O snapshot continua sendo a fonte canônica do relatório geral, mas o fluxo de PDF foi dividido: **Baixar Relatório** gera apenas o consolidado por classes e **Presenças** usa o endpoint detalhado para baixar somente o detalhamento de presença.
