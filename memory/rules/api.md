# Regras da API

- Toda resposta do backend deve ser JSON.
- O backend expõe a lógica de banco; o cliente conversa somente com a API HTTP, nunca com o PostgreSQL diretamente.
- O backend principal exposto pelo projeto fica em `https://ebd-fj9u.onrender.com/api`; as rotas `/auth/login` e `/auth/register` ficam no mesmo serviço, na raiz do domínio.
- As ações enviadas pelo cliente devem ser normalizadas para minúsculas.
- As rotas gerais da API continuam usando `POST` como `application/x-www-form-urlencoded`.
- As rotas protegidas devem receber `Authorization: Bearer <token>` extraído da sessão autenticada do navegador; o frontend aplica isso de forma centralizada no serviço de requisições.
- A mesma rota pode aceitar `GET` como fallback de compatibilidade.
- A rota de compatibilidade do frontend aceita `action` ou `acao` e devolve o mesmo formato do backend.
- A ação `init` precisa retornar `turmas`, `alunos`, `callsByTurma`, `inativos`, `resumoGeral`, `baseRowsCount` e `selectedTurmaId`.
- O código exibido após `#` na edição do aluno é somente leitura na interface e não pode ser alterado pelo usuário.
- Usuários com acesso `restricted` também podem editar cadastro de aluno; apenas o modo `self` continua bloqueado.
- A chave usada na edição do aluno é o nome atual do cadastro, não um ID separado.
- Quando a turma ou o status não vierem no payload de edição, o backend deve preservar os valores atuais do aluno.
- O fluxo de inclusão de aluno aceita `dataNascimento` como campo opcional; quando informado, o backend grava `DATA_NASCIMENTO` e deriva o `MÊS` na mesma linha.
- A inclusão de aluno não é bloqueada por código de acesso; qualquer modo pode cadastrar aluno.
- A página dedicada de inclusão de aluno fica em `aluno/adicionar-aluno/` e não inclui cadastro de nova turma.
- O backend deve expor as tabelas e funções de cadastro de forma consistente com o esquema PostgreSQL; nomes legados do sistema antigo não fazem parte da base atual.
- As respostas de erro do backend devem incluir `source: backend` e, quando útil, `stage`; o frontend usa isso para exibir um console de diagnóstico com a origem do erro.
- O botão **Salvar** deve persistir também uma snapshot local da chamada salva, com prioridade de leitura para buscas por data e relatórios.
- Na chamada, `PRESENÇA`, `ATRASO` e `AUSÊNCIA` devem ser gravados como estados mutuamente exclusivos em cada salvamento; ao corrigir a presença de um aluno, o backend precisa zerar os campos que não correspondem ao novo status.
- As rotas de autenticação usam JSON: `POST /auth/register` para cadastro e `POST /auth/login` para login. O frontend deve enviar `Accept: application/json` e `Content-Type: application/json` nessas duas chamadas.
- O cadastro público deve enviar o tenant em `cadastro_nome`; o backend aceita aliases antigos, mas o frontend deve preferir a forma canônica.
- A ação `init` do backend pode receber `view` para respostas mais leves em telas de listagem, especialmente para `/turma` e `/inativos`.
- A listagem de classes/turmas em telas dedicadas deve consumir `GET /api/classes` com `Authorization: Bearer <token>` e aceitar respostas que exponham a lista em `classes` ou `turmas`.
- O frontend deve normalizar registros de turma vindos da API para `TurmaID` e `Nome`, aceitando aliases como `id_classe` e `nome`.
- Quando `init` não trouxer turmas válidas, o shell principal pode fazer fallback em `GET /api/classes` para preencher o seletor de turmas.
- Não existe mais modo fake local no frontend; toda operação passa pelo backend PostgreSQL.

- Em GitHub Pages, toda navegação cliente deve preservar o subpath base do projeto (`APP_BASE_PATH`), evitando enviar o usuário para `/<rota>` na raiz do domínio.

- Consultas de classes e chamadas devem respeitar o tenant ativo da sessão. Enquanto a migração para o JWT completo não termina, o frontend envia `x-cadastro-id` nas requisições autenticadas e `GET /api/classes` pode receber `id_cadastro` por compatibilidade.
