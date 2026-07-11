# Armadilha: POST do Apps Script pode virar GET

## Problema
Algumas requisições enviadas ao Web App do Google Apps Script retornam via redirecionamento e o corpo do POST pode não chegar ao destino final.

## Causa
O navegador segue o redirecionamento e a etapa final pode executar `doGet`, não `doPost`, preservando a query string mas descartando o body.

## Solução
Enviar `action` e demais parâmetros também na query string, aceitar as mesmas rotas em `doGet` e `doPost`, repetir `acao` como alias de compatibilidade, e repetir como GET quando o POST de atualização de aluno retornar `Ação inválida`.


## Observação adicional
Se o navegador exibir `Failed to fetch` ao cadastrar aluno ou turma, o cliente deve repetir a requisição como GET na mesma URL publicada do Apps Script, porque alguns deploys respondem melhor à rota publicada do que ao POST feito via `fetch`.
