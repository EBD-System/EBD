# Handoff

Antes de responder ou alterar o projeto, consulte primeiro a memória consolidada.

Pontos centrais:

- A base oficial de dados continua sendo PostgreSQL.
- O arquivo `backend/backend.sql` concentra o esquema, as funções e as regras do banco.
- O frontend agora possui um modo de banco fake local controlado por `DEV_FAKE_DATABASE`.
- Quando o modo fake está ativo, `backend/exampleDb.json` serve como seed inicial e o estado mutável fica salvo no navegador.
- A interface web ainda pode falar com uma API HTTP/ponte para o PostgreSQL quando o modo fake estiver desligado.
- O navegador usa localStorage para rascunhos, snapshots consolidadas de chamadas, sessão de acesso e estado do banco fake.
- A navegação principal usa um roteador cliente com sessão persistida no navegador.
- O parâmetro `?code=` continua só como compatibilidade temporária.
- O login deve ser tratado como camada de acesso; a sessão precisa carregar identidade e perfis, e as páginas internas devem confiar nessa sessão, não na URL.
- As rotas `/login`, `/turma`, `/turma/:id`, `/chamada`, `/abrir-chamada` e `/inativos` já existem no shell principal.
- As telas de lista podem pedir `init(view=turmas)` ou `init(view=inativos)` para evitar carregar a chamada inteira; a rota de chamada ainda usa o fluxo completo para preservar estabilidade.
- O modo `restricted` também pode editar alunos; apenas o modo `self` segue bloqueado para edição.
- A edição de aluno acontece em uma página dedicada em `aluno/editar-aluno/`.
- O cadastro de aluno fica em `aluno/adicionar-aluno/` e não inclui cadastro de nova turma.


## Banco fake local
- `DEV_FAKE_DATABASE` habilita o modo fake no frontend.
- O seed precisa usar uma URL absoluta resolvida em `EXAMPLE_DB_URL`; não depender de caminho relativo da rota atual.
- Se o armazenamento local estiver vazio por uma carga inicial mal sucedida, o runtime deve voltar ao seed do JSON.

- O projeto roda em subpath no GitHub Pages (`/EBD/`); o roteador deve montar URLs com `APP_BASE_PATH` para não cair na raiz do domínio.
