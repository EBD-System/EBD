# Roteador central e sessão autenticada

## Decisão
A navegação do site passou a ser tratada por um roteador central em cima do shell principal da aplicação. As rotas `/login`, `/turma`, `/turma/:id`, `/chamada`, `/abrir-chamada` e `/inativos` são resolvidas no cliente, com sessão persistida no navegador. O parâmetro `?code=` ficou apenas como compatibilidade temporária para migração.

## Motivo
Essa estrutura separa o ponto de entrada da área interna, reduz carregamento desnecessário e permite que o login autenticado pelo backend alimente uma sessão estável com identidade, perfis e token, sem depender da URL como verdade principal.

## Data
2026-07-14


## Atualização
As rotas cliente precisam ser prefixadas com `APP_BASE_PATH` derivado de `APP_BASE_URL`, para funcionar corretamente em subpaths do GitHub Pages como `/EBD/`.
