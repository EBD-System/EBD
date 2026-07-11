# Regras da API

- Toda resposta do backend deve ser JSON.
- A ação `health` deve continuar disponível para verificação de disponibilidade.
- A chamada só deve ser salva com todos os alunos marcados.
- Presentes e atrasados contam como presença.
- A ação `updateAluno` deve existir para editar o cadastro de alunos no backend.
- O código exibido após `#` na edição do aluno é somente leitura na interface e não pode ser alterado pelo usuário.
- Usuários com acesso `restricted` também podem editar cadastro de aluno; apenas o modo `self` continua bloqueado.
- As ações enviadas ao Apps Script devem ser normalizadas para minúsculas no cliente.
- O cliente deve enviar POST como `application/x-www-form-urlencoded` para o Apps Script, repetindo os parâmetros na query string para melhorar a compatibilidade com `doGet`/`doPost`.
- Se o POST de atualização de aluno voltar com `Ação inválida`, o cliente pode repetir a mesma requisição como GET.
- O cliente também envia `acao` junto com `action` para aumentar a compatibilidade com deploys do Apps Script.
- A chave usada na edição do aluno é o nome atual do cadastro, não um ID separado em planilha.
- Quando a turma ou o status não vierem no payload de edição, o backend deve preservar os valores atuais do aluno.
- A ação `addAluno` deve existir para incluir novos alunos diretamente na aba `Cadastro`.
- A aba de cadastro é resolvida de forma case-insensitive; `Cadastro` e `cadastro` são tratados como o mesmo destino quando a planilha já existir.
- Quando o `POST` para `addAluno`, `addTurma` ou `updateAluno` falhar com `Failed to fetch` ou `Ação inválida`, o cliente pode repetir a mesma requisição via `GET` na URL publicada do Apps Script.
