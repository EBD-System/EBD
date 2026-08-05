# Formato de exibição dos relatórios

## Regra
Datas exibidas no módulo de Relatórios devem ser normalizadas antes de aparecer na tela ou no PDF. Valores apenas com data devem ser exibidos como `dd/mm/yyyy`. Valores com data e hora devem ser exibidos como `dd/mm/yyyy - hh:mm`. Se a origem não trouxer hora, o hífen não deve ser exibido.

O botão **Enviar Relatório** deve baixar o PDF diretamente, sem pré-visualização em `iframe`.

## Aplicação
Aplica-se ao painel de resultado do frontend e ao arquivo PDF gerado a partir do snapshot da consulta.


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
