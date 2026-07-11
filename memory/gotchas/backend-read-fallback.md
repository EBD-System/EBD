# Armadilha: GET do Apps Script falha após deploy

## Problema
Em alguns deploys do Web App do Apps Script, a leitura inicial pode falhar no `GET` mesmo com a URL correta.

## Causa
O endpoint publicado pode mudar de comportamento após novo deploy, ou a rota de leitura pode responder de forma diferente do esperado pelo navegador.

## Solução
O cliente faz a leitura inicial primeiro por `GET` e, se falhar, tenta novamente por `POST` com os mesmos parâmetros. Isso vale para a carga inicial da lista e para a página dedicada de edição de aluno.
