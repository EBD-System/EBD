# Página 404 interna com paths locais

## Problema
A página interna de 404 em `src/modules/errors/pages/not-found/index.html` pode quebrar CSS, JS e navegação quando usa caminhos absolutos do próprio projeto.

## Causa
Esse arquivo vive dentro de `src/modules/errors/pages/not-found/`, então os recursos do mesmo diretório devem ser referenciados localmente. O link de retorno também precisa subir até a raiz do projeto.

## Solução
- usar `./error.css` e `./error.js` para os assets da própria página;
- apontar o botão de retorno para `../../../../../index.html`, que leva à tela inicial do projeto a partir desse caminho.
