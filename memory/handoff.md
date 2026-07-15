# Handoff

Antes de responder ou alterar o projeto, consulte primeiro a memória consolidada.

Pontos centrais:

- A base oficial de dados é PostgreSQL.
- O frontend consome somente a API HTTP do backend.
- Não existe mais banco fake local no frontend.
- O navegador usa localStorage para rascunhos, snapshots consolidadas de chamadas, sessão de acesso e estado da interface.
- A navegação principal usa um roteador cliente com sessão persistida no navegador.
- O parâmetro `?code=` continua só como compatibilidade temporária.
- O login deve ser tratado como camada de acesso; a sessão precisa carregar identidade e perfis, e as páginas internas devem confiar nessa sessão, não na URL.
- As rotas `/login`, `/turma`, `/turma/:id`, `/chamada`, `/abrir-chamada` e `/inativos` já existem no shell principal.
- As telas de lista podem pedir `init(view=turmas)` ou `init(view=inativos)` para evitar carregar a chamada inteira; a rota de chamada ainda usa o fluxo completo para preservar estabilidade.
- O modo `restricted` também pode editar alunos; apenas o modo `self` segue bloqueado para edição.
- A edição de aluno acontece em uma página dedicada em `aluno/editar-aluno/`.
- O cadastro de aluno fica em `aluno/adicionar-aluno/` e não inclui cadastro de nova turma.
- Existe agora uma página pública de cadastro em `cadastro/` para criar acesso sem depender da sessão interna.
- O cadastro público envia `POST /auth/register` em JSON ao backend.
- A tela de login usa `POST /auth/login` em JSON e grava a sessão autenticada retornada pelo backend.
- O subpath do GitHub Pages deve ser preservado em toda navegação cliente.
