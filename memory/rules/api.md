# Regras da API

- Toda resposta do backend deve ser JSON.
- A ação `health` deve continuar disponível para verificação de disponibilidade.
- A chamada só deve ser salva com todos os alunos marcados.
- Presentes e atrasados contam como presença.

- A ação `updateAluno` deve existir para editar o cadastro de alunos no backend.
- O código exibido após `#` na edição do aluno é somente leitura na interface e não pode ser alterado pelo usuário.

- As ações enviadas ao Apps Script devem ser normalizadas para minúsculas no cliente.
- O backend aceita a edição de aluno por `updatealuno` e aliases históricos relacionados.
- Para evitar falha em redirecionamentos do Web App do Apps Script, as mutações também podem ser resolvidas via query string além do corpo do POST.
