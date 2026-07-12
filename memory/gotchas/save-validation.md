# Armadilha: POST do Apps Script pode virar GET

## Problema

Algumas requisições enviadas ao Web App do Google Apps Script retornam via redirecionamento e o corpo do POST pode não chegar ao destino final.

## Causa

O navegador segue o redirecionamento e a etapa final pode executar `doGet`, não `doPost`, preservando a query string mas descartando o body.

## Solução

Enviar `action` e demais parâmetros também na query string, aceitar as mesmas rotas em `doGet` e `doPost`, repetir `acao` como alias de compatibilidade, e repetir como GET quando o POST de atualização de aluno retornar `Ação inválida`.

## Observação adicional

Se o navegador exibir `Failed to fetch` ao cadastrar aluno ou turma, o cliente deve repetir a requisição como GET na mesma URL publicada do Apps Script, porque alguns deploys respondem melhor à rota publicada do que ao POST feito via `fetch`.

## Armadilha: lote grande de chamada não deve ser espelhado na URL
### Problema
Ao salvar a chamada com muitos alunos, duplicar `rowsJson` na query string pode estourar o tamanho da URL antes do Apps Script processar o POST.

### Causa
O lote inteiro de presença cresce rápido demais quando é repetido no endereço da requisição junto com o corpo.

### Solução
Para `saveCall`, manter `rowsJson` somente no corpo do POST e deixar a query string mínima, com `action`/`acao` apenas.

## Armadilha: snapshot local só nasce no clique de salvar
### Problema
Rascunhos automáticos ajudam a não perder edição, mas não substituem a snapshot consolidada da chamada salva.

### Causa
O armazenamento local definitivo da chamada é criado somente quando o usuário clica em **Salvar**.

### Solução
Para recuperar uma chamada antiga ou gerar relatórios em modo resiliente, consultar primeiro `savedCallsByDate` e só depois cair para a planilha.
