# Regras da API

- Toda resposta do backend deve ser JSON.
- A ação `health` deve continuar disponível para verificação de disponibilidade.
- A chamada só deve ser salva com todos os alunos marcados.
- Presentes e atrasados contam como presença.
- A ação `updateAluno` deve existir para editar o cadastro de alunos no backend.
- O código exibido após `#` na edição do aluno é somente leitura na interface e não pode ser alterado pelo usuário.
- Usuários com acesso `restricted` também podem editar cadastro de aluno; apenas o modo `self` continua bloqueado.
- As ações enviadas ao Apps Script devem ser normalizadas para minúsculas no cliente.
- O cliente deve enviar POST como `application/x-www-form-urlencoded` para o Apps Script.
- O cliente deve repetir os parâmetros na query string apenas quando houver fallback real por GET; o salvamento de chamada (`saveCall`) não deve espelhar `rowsJson` na URL.
- Se o POST de atualização de aluno voltar com `Ação inválida`, o cliente pode repetir a mesma requisição como GET.
- O cliente também envia `acao` junto com `action` para aumentar a compatibilidade com deploys do Apps Script.
- A chave usada na edição do aluno é o nome atual do cadastro, não um ID separado em planilha.
- Quando a turma ou o status não vierem no payload de edição, o backend deve preservar os valores atuais do aluno.
- A ação `addAluno` deve existir para incluir novos alunos diretamente na aba `Cadastro`.
- O fluxo de inclusão de aluno aceita `dataNascimento` como campo opcional; quando informado, o backend grava `DATA_NASCIMENTO` e deriva o `MÊS` na mesma linha.
- A inclusão de aluno não é bloqueada por código de acesso; qualquer modo pode cadastrar aluno.
- A página dedicada de inclusão de aluno fica em `aluno/adicionar-aluno/` e não inclui cadastro de nova turma.
- A aba de cadastro é resolvida de forma case-insensitive; `Cadastro` e `cadastro` são tratados como o mesmo destino quando a planilha já existir.
- Quando o `POST` para `addAluno`, `addTurma` ou `updateAluno` falhar com `Failed to fetch` ou `Ação inválida`, o cliente pode repetir a mesma requisição via `GET` na URL publicada do Apps Script.

- As respostas de erro do backend devem incluir `source: backend` e, quando útil, `stage`; o frontend usa isso para exibir um console de diagnóstico com a origem do erro.

- O botão **Salvar** deve persistir também uma snapshot local da chamada salva, com prioridade de leitura para buscas por data e relatórios.
- Na aba base, `PRESENÇA`, `ATRASO` e `AUSÊNCIA` devem ser gravados como flags mutuamente exclusivas em cada salvamento; ao corrigir a presença de um aluno, o backend precisa zerar as colunas que não correspondem ao novo status.
