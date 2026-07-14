# Handoff

Antes de responder ou alterar o projeto, consulte primeiro a memória consolidada.

Pontos centrais:

- A base oficial de dados agora é PostgreSQL.
- O arquivo `backend/backend.sql` concentra o esquema, as funções e as regras do banco.
- A interface web ainda depende de uma API HTTP/ponte para conversar com o PostgreSQL; sem essa conexão o site não consegue operar de ponta a ponta.
- O navegador usa localStorage para rascunhos, snapshots consolidadas de chamadas e sessão de acesso.
- A navegação principal usa um roteador cliente com sessão persistida no navegador.
- O parâmetro `?code=` continua só como compatibilidade temporária.
- O login deve ser tratado como camada de acesso; a sessão precisa carregar identidade e perfis, e as páginas internas devem confiar nessa sessão, não na URL.
- As rotas `/login`, `/turma`, `/turma/:id`, `/chamada`, `/abrir-chamada` e `/inativos` já existem no shell principal.
- As telas de lista podem pedir `init(view=turmas)` ou `init(view=inativos)` para evitar carregar a chamada inteira; a rota de chamada ainda usa o fluxo completo para preservar estabilidade.
- O modo `restricted` também pode editar alunos; apenas o modo `self` segue bloqueado para edição.
- A edição de aluno acontece em uma página dedicada em `aluno/editar-aluno/`.
- O cadastro de aluno fica em `aluno/adicionar-aluno/` e não inclui cadastro de nova turma.
- O backend atual é PostgreSQL; a interface deve ser mantida genérica para qualquer ponte HTTP compatível.
