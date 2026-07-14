# Roteador central e sessão autenticada

## Decisão
A navegação do site passou a ser tratada por um roteador central em cima do shell principal da aplicação. As rotas `/login`, `/turma`, `/turma/:id`, `/chamada`, `/abrir-chamada` e `/inativos` são resolvidas no cliente, com sessão persistida no navegador. Quando o projeto está hospedado em GitHub Pages, o roteador preserva o basename `/EBD` em todas as navegações. O parâmetro `?code=` ficou apenas como compatibilidade temporária para migração.

## Motivo
Essa estrutura separa o ponto de entrada da área interna, reduz carregamento desnecessário e permite que o login alimente uma sessão estável com identidade e perfis, sem depender da URL como verdade principal. O modo de desenvolvimento usa um bypass centralizado de autenticação para testes sem login, sem desmontar a arquitetura.

## Data
2026-07-14
