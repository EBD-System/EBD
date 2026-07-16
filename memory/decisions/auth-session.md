# Sessão de autenticação e fallback legado

## Decisão
A camada de acesso da interface usa uma sessão persistida no navegador como fonte principal de autenticação. Essa sessão deve carregar `userId`, `login`, `nome`, `perfis`, `accessMode`, `token`, `createdAt` e `updatedAt`. O código de acesso legado fica apenas como compatibilidade temporária; o login oficial vem de `POST /auth/login` em JSON e a sessão salva deve reutilizar os dados devolvidos pelo backend. A sessão consolidada também carrega `idCadastro`/`id_cadastro` quando o backend ou o JWT já expõem o tenant.

## Motivo
Isso separa login, sessão e autorização. O frontend deixa de depender de query string para identificar o usuário e passa a reutilizar o estado autenticado entre rotas, enquanto a autorização sensível continua no servidor. A mesma sessão também fornece o token Bearer usado automaticamente nas requisições protegidas do backend.

## Data
2026-07-16
