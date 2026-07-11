# Handoff

Antes de responder ou alterar o projeto, consulte primeiro a memória consolidada.

Pontos centrais:

- A fonte oficial continua sendo o Google Sheets via Apps Script.
- O navegador usa localStorage apenas para rascunhos e para a camada de memória consolidada.
- A chamada do dia exige marcação completa antes do salvamento.
- O endpoint `health` existe para checagem rápida do backend e deve expor `version` e `deployedAt`.
- Decisões arquiteturais devem ficar em arquivos curtos dentro de `memory/`.
- A edição de aluno acontece em uma página dedicada em `aluno/editar-aluno/`.
- O botão **Editar** leva para essa rota com a chave de edição baseada no nome atual do aluno.
- O fluxo de edição grava alterações diretamente na aba `cadastro` da planilha.
- As ações enviadas ao Apps Script são normalizadas para minúsculas no cliente.
- O cliente agora envia POST como `application/x-www-form-urlencoded`, além de repetir a query string e o alias `acao`, para melhorar a compatibilidade com o Apps Script.
- O Web App do Apps Script pode redirecionar POST para GET; por isso, salvamentos precisam ter `action` também na query string e o backend deve aceitar a mesma rota em `doGet`.
- O modo `restricted` também pode editar alunos; apenas o modo `self` segue bloqueado para edição.
- Na edição de aluno, o campo `Status` está visível, mas fica desativado temporariamente na interface.
- A página de edição também ganhou ação de exclusão do aluno, confirmada antes do envio ao backend.


- O carregamento inicial do frontend usa `apiGet` com timeout, para evitar overlay infinito quando o Apps Script demora ou falha.
- O envio de atualização de aluno só faz fallback automático para GET quando o POST retorna explicitamente `Ação inválida`; outros erros precisam aparecer sem mascaramento.
- A edição de aluno agora pode preservar turma e status atuais quando esses campos não vierem preenchidos no payload.

- O cadastro de aluno usa a ação `addAluno` e grava diretamente na aba `Cadastro` da planilha.
- Para testes manuais no Apps Script, existe `adicionarAlunoManual()` como helper editável.
- O backend resolve a aba de cadastro de forma case-insensitive, então `Cadastro` e `cadastro` passam a apontar para a mesma planilha quando já existir uma delas.
