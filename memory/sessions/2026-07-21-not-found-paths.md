# Sessão 2026-07-21 — correção da página 404 interna

## O que foi alterado
A página interna de erro 404 passou a carregar `error.css` e `error.js` com caminhos locais e o link “Voltar para o início” passou a apontar para a raiz do projeto.

## Conhecimento consolidado
- arquivos dentro de `src/modules/errors/pages/not-found/` devem usar referências relativas ao próprio diretório para os assets internos;
- o retorno correto dessa tela é a `index.html` da raiz do projeto, não a própria página de erro.

## Próximos passos
Manter essa mesma convenção caso a página de erro seja duplicada ou movida para outro local.
