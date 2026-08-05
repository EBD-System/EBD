# Caminhos estáticos nas páginas de classe e chamada

## Problema
Os arquivos `src/modules/classe/pages/index.html` e `src/modules/chamada/pages/index.html` podem tentar carregar `app/config` e `shared/services` com profundidade excessiva, gerando 404 no navegador.

## Causa
Essas páginas ficam em `src/modules/<modulo>/pages/`, então os assets compartilhados devem subir apenas três níveis até `src/`.

## Solução
Usar caminhos relativos no formato `../../../app/...` e `../../../shared/...` nesses dois HTMLs.
