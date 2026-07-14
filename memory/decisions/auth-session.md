# Sessão de autenticação e fallback legado

## Decisão
A camada de acesso da interface usa uma sessão persistida no navegador como fonte principal de autenticação. Essa sessão deve carregar `userId`, `login`, `nome`, `perfis`, `accessMode`, `createdAt` e `updatedAt`. O código de acesso legado fica apenas como compatibilidade temporária e pode ser migrado para a sessão até o backend fornecer autenticação formal.

## Motivo
Isso separa login, sessão e autorização. O frontend deixa de depender de query string para identificar o usuário e passa a reutilizar o estado autenticado entre rotas, enquanto a autorização sensível continua no servidor.

## Data
2026-07-14
