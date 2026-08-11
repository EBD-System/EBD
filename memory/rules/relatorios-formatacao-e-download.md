# Formato de exibição dos relatórios

## Regra
Datas exibidas no módulo de Relatórios devem ser normalizadas antes de aparecer na tela ou no PDF. Valores apenas com data devem ser exibidos como `dd/mm/yyyy`. Valores com data e hora devem ser exibidos como `dd/mm/yyyy - hh:mm`. Se a origem não trouxer hora, o hífen não deve ser exibido.

O botão **Baixar Relatório** deve baixar o PDF do relatório geral diretamente, sem pré-visualização em `iframe`, usando apenas os cards consolidados do período. O botão **Presenças** deve baixar um PDF separado contendo somente as páginas detalhadas de presença do período.

## Aplicação
Aplica-se ao painel de resultado do frontend e ao arquivo PDF gerado a partir do snapshot da consulta.


## Atualização (2026-08-08 — separação do PDF por tipo)
Os downloads do módulo de Relatórios foram separados em dois botões: **Baixar Relatório** gera apenas o relatório geral consolidado por classes e **Presenças** gera apenas o detalhamento de presença.

## Atualização (2026-08-04 — cards por turma)
O painel de resultado passou a renderizar um card total e cards individuais por turma, usando o mesmo formato textual nas linhas internas: `Matriculados`, `Ausentes`, `Presentes`, `Visitantes`, `Total`, `Bíblias`, `Revistas` e `Ofertas`.

## Atualização (2026-08-04 — cards por turma e total)
Os cards de Relatórios devem mostrar, na ordem, `Matriculados`, `Ausentes`, `Presentes`, `Visitantes`, `Total`, `Bíblias`, `Revistas` e `Ofertas`. Em `Ausentes`, zero deve aparecer como `Não houve`; nos demais contadores, zero deve aparecer como `0`.

## Atualização (2026-08-04 — ofertas monetárias)
O campo `Ofertas` deve ser exibido como moeda brasileira (`R$`), inclusive quando o valor consolidado for zero.

## Atualização (2026-08-04 — visibilidade do resultado)
A seção de resultado deve permanecer oculta até existir um relatório válido. Depois de uma consulta bem-sucedida, a área volta a aparecer com o conteúdo carregado; consultas inválidas ou sem resultado devem recolher a seção novamente.


## Atualização (2026-08-05 — estado visual do relatório geral)
No módulo de Classes, o bloco do **Relatório Geral** deve ficar em vermelho enquanto existir qualquer classe sem chamada registrada. Quando houver alguma classe com `presentes = 0`, o aviso correspondente deve aparecer em amarelo. Essa indicação é apenas de cor; não deve depender de ocultar ou exibir elementos.


## Atualização (2026-08-05 — total da turma)
O campo `Total` dos cards do relatório deve representar `Presentes + Visitantes`. O campo `Matriculados` continua representando a base ativa da turma (`total_alunos`) e não deve ser reutilizado para calcular o total exibido.

## Atualização (2026-08-06 — alerta do Relatório Geral)
Quando o bloco **Relatório Geral** ficar em vermelho por existir alguma classe sem chamada registrada, o texto de status deve informar exatamente: `Existe classe com alunos sem presenças.`


## Atualização (2026-08-09 — vitrine de módulos e data única)
A página principal de Relatórios virou um hub de navegação para submódulos. O fluxo funcional de Presenças ficou em `src/modules/relatorios/presencas/index.html` e deve trabalhar com uma única data selecionada pelo usuário; quando a API exigir intervalo, o frontend replica a mesma data para `startDate` e `endDate`.

## Atualização (2026-08-10 — extrato financeiro)
O submódulo `relatorios/financeiro` ganhou o botão **Baixar Extrato**. O PDF precisa sair com o título `Extrato Financeiro EBD`, incluir o período solicitado no cabeçalho, repetir o bloco de `Total Geral` no topo de cada página e listar apenas campos úteis ao usuário a partir do JSON do backend (`summary` + `entries`), sem expor metadados técnicos.


## Atualização (2026-08-10 — extrato financeiro corrigido)
O PDF financeiro deve receber metadados de paginação válidos em cada página; o rodapé usa `pageNumber/totalPages` e o renderer não pode assumir que o objeto `meta` existe sem fallback.
