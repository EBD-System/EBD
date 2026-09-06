# Sessão 2026-07-21 — Inativos carregados separadamente

## O que foi alterado
A tela de chamada deixou de depender de um único payload da classe para montar as abas. Agora o front busca ativos e inativos por status, faz fallbacks quando necessário e mescla os registros antes de renderizar.

## Conhecimento consolidado
- O endpoint da classe pode vir incompleto e omitir alunos inativos.
- A aba **Inativos** precisa de carga própria; não deve depender apenas de filtragem local sobre a resposta de ativos.
- O front deve preservar a prioridade do registro inativo quando o mesmo vínculo aparecer em mais de uma resposta.

## Próximos passos
Se o backend estabilizar um endpoint definitivo para a lista de inativos por classe, simplificar os fallbacks e remover consultas redundantes.
