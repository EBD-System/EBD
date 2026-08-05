# Express servindo `src/` em vez da raiz

## Problema
No localhost, rotas como `/src/modules/...` ou atalhos como `/chamada` podem cair na tela errada ou voltar para `index.html`.

## Causa
Quando o Express aponta apenas para `src/`, a raiz pública deixa de coincidir com a estrutura publicada no GitHub Pages.

## Solução
Servir o diretório raiz do projeto no desenvolvimento local e usar fallback para `404.html` em vez de redirecionar tudo para a página inicial.
