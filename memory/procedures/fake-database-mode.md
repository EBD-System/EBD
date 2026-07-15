# Usar o banco fake local

## Passos

1. Manter `DEV_FAKE_DATABASE` como `true` durante o desenvolvimento sem backend real.
2. Deixar `backend/exampleDb.json` como seed inicial do banco fake.
3. Abrir a aplicação normalmente; `api.js` carrega o seed e passa a responder com dados locais.
4. Quando o PostgreSQL real estiver disponível, mudar `DEV_FAKE_DATABASE` para `false` e informar a URL da API HTTP.
5. Conferir se as respostas continuam no mesmo formato antes de desligar o modo fake.


## Observação de carregamento
- O seed deve ser acessado por `EXAMPLE_DB_URL`, que precisa apontar para `backend/exampleDb.json` a partir da raiz do site.
- Se o modo fake abrir sem turmas, limpe o armazenamento local do projeto para descartar um snapshot antigo vazio.
