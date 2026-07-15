# Usar o banco fake local

## Passos

1. Manter `DEV_FAKE_DATABASE` como `false` no uso normal com backend PostgreSQL.
2. Ativar `window.DEV_FAKE_DATABASE = true` apenas para desenvolvimento offline ou teste isolado.
3. Garantir que `EXAMPLE_DB_URL` continue apontando para `backend/exampleDb.json`.
4. Abrir a aplicação; o seed inicial é carregado e o estado mutável fica salvo no navegador.
5. Quando quiser voltar ao banco real, desligar o modo fake e deixar a API HTTP do backend responder normalmente.

## Observação de carregamento
- O seed deve ser acessado por `EXAMPLE_DB_URL`, resolvido a partir da raiz do site.
- Se o modo fake abrir sem turmas, limpe o armazenamento local do projeto para descartar um snapshot antigo vazio.
