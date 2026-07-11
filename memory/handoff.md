# Handoff

Antes de responder ou alterar o projeto, consulte primeiro a memória consolidada.

Pontos centrais:

- A fonte oficial continua sendo o Google Sheets via Apps Script.
- O navegador usa localStorage apenas para rascunhos e para a camada de memória consolidada.
- A chamada do dia exige marcação completa antes do salvamento.
- O endpoint `health` existe para checagem rápida do backend.
- Decisões arquiteturais devem ficar em arquivos curtos dentro de `memory/`.

- A edição de aluno acontece em uma página dedicada em `aluno/editar-aluno/`.
- O botão **Editar** leva para essa rota com o `alunoId` do cadastro e o código após `#` continua somente leitura.
- O fluxo de edição grava alterações diretamente na aba `cadastro` da planilha.
- O envio de edição usa `updatealuno` em minúsculas e também repete a ação na query string para contornar redirecionamento do Web App.

- As ações enviadas ao Apps Script são normalizadas para minúsculas no cliente.
- Quando uma mutação retornar `Ação inválida`, conferir primeiro se a URL publicada do Apps Script recebeu a versão mais recente do backend.
