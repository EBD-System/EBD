# Handoff

Antes de responder ou alterar o projeto, consulte primeiro a memória consolidada.

Pontos centrais:

- A base oficial de dados continua sendo PostgreSQL.
- O frontend agora usa a API HTTP do backend como caminho padrão.
- O arquivo `backend/exampleDb.json` segue como seed do modo fake local, que só deve ser ativado manualmente.
- A interface web ainda pode falar com o modo fake quando `DEV_FAKE_DATABASE = true`.
- O navegador usa localStorage para rascunhos, snapshots consolidadas de chamadas, sessão de acesso e estado do banco fake.
- A navegação principal usa um roteador cliente com sessão persistida no navegador.
- O parâmetro `?code=` continua só como compatibilidade temporária.
- O login deve ser tratado como camada de acesso; a sessão precisa carregar identidade e perfis, e as páginas internas devem confiar nessa sessão, não na URL.
- As rotas `/login`, `/turma`, `/turma/:id`, `/chamada`, `/abrir-chamada` e `/inativos` já existem no shell principal.
- As telas de lista podem pedir `init(view=turmas)` ou `init(view=inativos)` para evitar carregar a chamada inteira; a rota de chamada ainda usa o fluxo completo para preservar estabilidade.
- O modo `restricted` também pode editar alunos; apenas o modo `self` segue bloqueado para edição.
- A edição de aluno acontece em uma página dedicada em `aluno/editar-aluno/`.
- O cadastro de aluno fica em `aluno/adicionar-aluno/` e não inclui cadastro de nova turma.
- O subpath do GitHub Pages deve ser preservado em toda navegação cliente.

## Banco fake local
- `DEV_FAKE_DATABASE` habilita o modo fake no frontend.
- O seed precisa usar uma URL absoluta resolvida em `EXAMPLE_DB_URL`; não depender de caminho relativo da rota atual.
- Se o armazenamento local estiver vazio por uma carga inicial mal sucedida, o runtime deve voltar ao seed do JSON.
- A carga de turmas e páginas de aluno aceita tanto o contrato normalizado `turmas` quanto coleções cruas vindas do PostgreSQL (`classes`, `data` ou `rows`); a interface normaliza tudo antes de renderizar.
