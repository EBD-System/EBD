# Armadilha: navegação perde o basename no GitHub Pages

## Problema
Ao entrar na aplicação hospedada em `/EBD`, redirects manuais como `/login` ou `/chamada` podem levar o navegador para a raiz do domínio e quebrar o deploy.

## Causa
O caminho interno foi construído sem respeitar o basename do projeto.

## Solução
Centralizar a construção de URLs em um helper basename-aware e usar `DEV_BYPASS_AUTH` apenas como exceção temporária de desenvolvimento.
