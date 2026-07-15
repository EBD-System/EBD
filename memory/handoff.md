# Handoff

Antes de responder ou alterar o projeto, consulte primeiro a memória consolidada.

Pontos centrais:

- A base oficial de dados é PostgreSQL.
- O frontend consome somente a API HTTP do backend. A tela de login também possui entrada estática própria em `/login/` e um alias compatível para `/login`.
- Não existe mais banco fake local no frontend.
- O navegador usa localStorage para rascunhos, snapshots consolidadas de chamadas, sessão de acesso e estado da interface.
- A navegação principal usa um roteador cliente com sessão persistida no navegador; a rota de login precisa continuar acessível mesmo em deploy estático.
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
- A tela de login também lembra opcionalmente o nome de usuário em `localStorage` e oferece um diálogo estático para "Esqueci minha senha".
- O subpath do GitHub Pages deve ser preservado em toda navegação cliente.
- O modo `self` continua ocultando a aplicação principal, mas a rota `/login` precisa escapar dessa regra para que a tela de login apareça mesmo sem sessão salva. Quando já existe sessão salva, `/login` deve redirecionar para `/chamada`.
