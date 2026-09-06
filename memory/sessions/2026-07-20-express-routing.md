# Sessão 2026-07-20

## O que foi alterado
O Express local foi ajustado para servir o diretório raiz do projeto e não apenas `src/`, preservando os caminhos estáticos usados no GitHub Pages. Também foram adicionados atalhos locais para rotas como `/dashboard` e `/chamada`.

## Conhecimento consolidado
- O caminho real do dashboard continua sendo `src/modules/dashboard/pages/home/index.html`.
- O localhost precisa responder com os mesmos arquivos estáticos que o GitHub Pages expõe.
- Rotas curtas de módulo podem existir como conveniência local, mas não substituem a estrutura baseada em arquivos.

## Próximos passos
Expandir a navegação do dashboard aos poucos, reaproveitando o mesmo padrão de páginas estáticas.
