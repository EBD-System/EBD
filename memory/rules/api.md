# Regras da API

- Toda resposta do backend deve ser JSON.
- A ação `health` deve continuar disponível para verificação de disponibilidade.
- A chamada só deve ser salva com todos os alunos marcados.
- Presentes e atrasados contam como presença.
- A ação `updateAluno` deve existir para editar o cadastro de alunos no backend.
- O código exibido após `#` na edição do aluno é somente leitura na interface e não pode ser alterado pelo usuário.
- As ações enviadas ao Apps Script devem ser normalizadas para minúsculas no cliente.
- Em Web Apps do Google Apps Script, requisições POST podem cair em um redirecionamento GET; por isso, ações de escrita também precisam ser aceitas por `doGet` quando a ação vier na query string.
