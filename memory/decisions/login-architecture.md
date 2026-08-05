# Arquitetura híbrida de login

## Decisão
O projeto usa dois modos compatíveis:

- **Local**: Express com Node.js continua servindo a aplicação durante o desenvolvimento.
- **Produção estática**: o front-end é copiado para `docs/` para publicação no GitHub Pages.

## Front-end
A UI fica em arquivos estáticos em `src/` e usa caminhos relativos para CSS e JS, o que permite publicação em subcaminhos do GitHub Pages sem depender de servidor Node.

## Navegação pós-login
Após autenticação bem-sucedida, o usuário é redirecionado para `src/modules/dashboard/pages/home/index.html`, que funciona como a primeira tela do dashboard.

## Servidor local
O Express deve servir o diretório raiz do projeto, para que os caminhos usados no GitHub Pages também funcionem no localhost. Rotas curtas como `/chamada` são aceitas como atalhos para páginas do módulo, mas a navegação principal continua baseada nos caminhos reais em `src/modules/...`.

## API
A base da API é resolvida automaticamente no navegador:

- local: `http://localhost:3000/api/v1`
- produção/GitHub Pages: `https://ebd-fj9u.onrender.com/api/v1`

## Data
2026-07-20
