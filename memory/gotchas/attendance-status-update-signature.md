# Armadilha na atualização de status da chamada

## Problema
A função `fn_ebd_alterar_status_chamada` do PostgreSQL não persiste `observacao` da presença.

## Causa
A assinatura antiga só aceita `(id_chamada, id_aluno_classe, status)`, então qualquer observação enviada pela API seria descartada se o fluxo dependesse apenas dela.

## Solução
O fluxo oficial da API deve atualizar `status` e `observacao` no repository, em transação, e usar a função do banco apenas como referência de regra de negócio quando necessário.

## Armadilha complementar

## Problema
O PATCH da chamada pode retornar `Registro da chamada não encontrado no tenant atual.` mesmo quando a linha existe em `ebd_chamada_aluno`.

## Causa
O lookup estava exigindo vínculo `ativo` em `ebd_aluno_classe`, o que bloqueava a atualização de registros históricos quando o vínculo já não estava ativo, mas a linha da chamada ainda precisava ser editada.

## Solução
Para atualizar presença, localizar primeiro a linha da chamada pelo par `id_chamada + id_aluno_classe` e evitar filtrar por `ac.ativo = TRUE` no repository. A regra de status do aluno continua valendo por `ebd_aluno.status`.

