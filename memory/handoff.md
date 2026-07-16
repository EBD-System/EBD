# Handoff

Antes de responder ou alterar o projeto, consulte primeiro a memória consolidada.

Pontos centrais:

- A base oficial de dados é PostgreSQL.
- O frontend consome somente a API HTTP do backend. A tela de login também possui entrada estática própria em `/login/` e um alias compatível para `/login`.
- Não existe mais banco fake local no frontend.
- O navegador usa localStorage para rascunhos, snapshots consolidadas de chamadas, sessão de acesso, preferências de login e estado da interface.
- A navegação principal usa um roteador cliente com sessão persistida no navegador; a rota de login precisa continuar acessível mesmo em deploy estático.
- O parâmetro `?code=` continua só como compatibilidade temporária.
- O login deve ser tratado como camada de acesso; a sessão precisa carregar identidade e perfis, e as páginas internas devem confiar nessa sessão, não na URL.
- Existe uma camada central de requisições no frontend que injeta automaticamente o Bearer token da sessão autenticada nas chamadas protegidas; login e cadastro público continuam sem autenticação.
- Por limitação de CORS no backend, o frontend não deve depender de `x-cadastro-id`; o tenant precisa seguir no `id_cadastro` da query/body nas requisições autenticadas e, durante a migração, o backend continua aceitando o JWT como fonte principal quando disponível.
- O shell principal hidrata a sessão salva no bootstrap para que o primeiro carregamento de turmas já tenha o tenant correto disponível.
- A rota `GET /api/classes` é tenant-scoped e o frontend envia `id_cadastro` por compatibilidade adicional nas consultas autenticadas.
- As rotas `/login`, `/turma`, `/turma/:id`, `/chamada`, `/abrir-chamada` e `/inativos` já existem no shell principal.
- As telas de lista podem pedir `init(view=turmas)` ou `init(view=inativos)` para evitar carregar a chamada inteira; a rota de chamada ainda usa o fluxo completo para preservar estabilidade.
- O modo `restricted` também pode editar alunos; apenas o modo `self` segue bloqueado para edição.
- A edição de aluno acontece em uma página dedicada em `aluno/editar-aluno/`.
- O cadastro de aluno fica em `aluno/adicionar-aluno/` e não inclui cadastro de nova turma.
- As telas dedicadas de inclusão e edição de aluno passam a buscar a lista de classes diretamente em `GET /api/classes` com Bearer token, normalizando a resposta tanto em `classes` quanto em `turmas`.
- A resposta de classes pode vir com aliases do schema `ebd_classe`; o frontend normaliza `id_classe`/`nome` para `TurmaID`/`Nome` antes de renderizar os selects.
- O shell principal faz fallback em `GET /api/classes` quando o `init` não devolve turmas válidas, para evitar seletor vazio após o login.
- Existe agora uma página pública de cadastro em `cadastro/` para criar acesso sem depender da sessão interna.
- O cadastro público envia `POST /auth/register` em JSON ao backend e precisa mandar o nome do tenant em `cadastro_nome`.
- A tela de login usa `POST /auth/login` em JSON e grava a sessão autenticada retornada pelo backend.
- A tela de login foi enxugada para nome de usuário, senha, botão de entrar e botão de criar cadastro; o último nome de usuário é salvo automaticamente como preferência local.
- A tela principal ganhou um botão “Sair” que limpa a sessão local e retorna para `/login`.
- O subpath do GitHub Pages deve ser preservado em toda navegação cliente.
- O modo `self` continua ocultando a aplicação principal, mas a rota `/login` precisa escapar dessa regra para que a tela de login apareça mesmo sem sessão salva. Quando já existe sessão salva, `/login` deve redirecionar para `/chamada`.
