# Configuração compartilhada em um único módulo

## Regra
`APP_CONFIG`, `APP_STORAGE_KEYS`, `APP_AUTH_STORAGE` e `APP_API_CLIENT` devem ser definidos apenas nos módulos compartilhados oficiais e consumidos pelas páginas. As páginas não devem redeclarar bases de API, chaves de storage ou clientes HTTP inline.

## Aplicação
- `src/app/config/config.js` concentra os flags de ambiente e a lógica de visibilidade do front;
- `src/app/config/api.js` concentra a base da API;
- `src/app/config/storage.js` concentra as chaves e utilitários de sessão;
- `src/shared/services/api-client.js` concentra parsing e erros da API;
- os módulos de tela devem usar `window.APP_CONFIG`, `window.APP_STORAGE_KEYS`, `window.APP_AUTH_STORAGE` e `window.APP_API_CLIENT`.
- quando o servidor local estiver disponível, `process.env.developmentMode` pode ser injetado em `window.APP_RUNTIME_CONFIG` antes de `config.js`, e esse valor tem precedência sobre o que estiver no arquivo e sobre os padrões internos.

## Prioridade das fontes de configuração
1. `process.env` injetado em `window.APP_RUNTIME_CONFIG`;
2. valores ajustados no próprio `src/app/config/config.js`;
3. padrões internos do código.
