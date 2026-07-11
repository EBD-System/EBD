# Regras da API

- Toda resposta do backend deve ser JSON.
- A ação `health` deve continuar disponível para verificação de disponibilidade.
- A chamada só deve ser salva com todos os alunos marcados.
- Presentes e atrasados contam como presença.
- A ação `updateAluno` deve existir para editar o cadastro de alunos no backend.
- O código exibido após `#` na edição do aluno é somente leitura na interface e não pode ser alterado pelo usuário.
- As ações enviadas ao Apps Script devem ser normalizadas para minúsculas no cliente.
- O cliente deve enviar POST como `application/x-www-form-urlencoded` para o Apps Script, repetindo os parâmetros na query string para melhorar a compatibilidade com `doGet`/`doPost`.
- A chave usada na edição do aluno é o nome atual do cadastro, não um ID separado em planilha.
