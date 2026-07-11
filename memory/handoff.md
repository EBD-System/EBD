# Handoff

Antes de responder ou alterar o projeto, consulte primeiro a memória consolidada.

Pontos centrais:

- A fonte oficial continua sendo o Google Sheets via Apps Script.
- O navegador usa localStorage apenas para rascunhos e para a camada de memória consolidada.
- A chamada do dia exige marcação completa antes do salvamento.
- O endpoint `health` existe para checagem rápida do backend.
- Decisões arquiteturais devem ficar em arquivos curtos dentro de `memory/`.
- A edição de aluno acontece em uma página dedicada em `aluno/editar-aluno/`.
- O botão **Editar** leva para essa rota com a chave de edição baseada no nome atual do aluno.
- O fluxo de edição grava alterações diretamente na aba `cadastro` da planilha.
- As ações enviadas ao Apps Script são normalizadas para minúsculas no cliente.
- O cliente agora envia POST como `application/x-www-form-urlencoded`, além de repetir a query string e o alias `acao`, para melhorar a compatibilidade com o Apps Script.
- O Web App do Apps Script pode redirecionar POST para GET; por isso, salvamentos precisam ter `action` também na query string e o backend deve aceitar a mesma rota em `doGet`.
- O modo `restricted` também pode editar alunos; apenas o modo `self` segue bloqueado para edição.


- O carregamento inicial do frontend usa `apiGet` com timeout, para evitar overlay infinito quando o Apps Script demora ou falha.
- O envio de atualização de aluno faz fallback automático para GET quando o POST retorna `Ação inválida`, para contornar inconsistências de roteamento no Apps Script.
- A edição de aluno agora pode preservar turma e status atuais quando esses campos não vierem preenchidos no payload.
