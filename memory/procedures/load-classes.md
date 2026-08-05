# Carregar classes a partir da API

## Passos
1. Garantir que exista token válido em `sessionStorage` na chave `auth:token`.
2. Resolver a base da API com `window.APP_CONFIG.resolveApiBaseUrl()`.
3. Fazer `GET /classes` com o cabeçalho `Authorization: Bearer <token>`.
4. Normalizar a resposta aceitando array direto ou listas em `data`, `result` ou `items`.
5. Ler o identificador da classe a partir do banco (`id_classe`, com aliases compatíveis quando existirem) e nunca usar índice da lista como fallback.
6. Renderizar cada item como cartão clicável.
7. Exibir um indicador visual ao lado do nome da classe com base em `chamada_ja_feita`:
   - `✅` quando a chamada já foi feita;
   - `🟡` quando ainda não houve chamada.
8. Ao clicar, navegar para `src/modules/chamada/pages/index.html` levando `classId` e `className` na query string.
9. A tela de chamada deve abrir já com a classe selecionada e sem acoplar integração de alunos nesta etapa.
