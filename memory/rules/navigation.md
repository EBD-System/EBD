# Regra de navegação

- Toda navegação interna deve preservar o basename do deploy.
- No GitHub Pages, o projeto vive sob `/EBD`; nenhuma URL interna pode ser construída como se a aplicação estivesse na raiz do domínio.
- A navegação deve usar helpers centralizados de construção de caminho, nunca concatenação manual de `window.location` ou strings absolutas soltas.

## Aplicação

Essa regra vale para redirects, guards, links, `pushState`, `replaceState`, `window.location.href` e qualquer ação que leve o usuário a outra rota da aplicação.
