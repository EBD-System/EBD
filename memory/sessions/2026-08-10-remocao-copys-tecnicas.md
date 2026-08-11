# Sessão 2026-08-10 — remoção de textos técnicos da interface

## O que foi alterado
- Removidas/reformuladas mensagens visíveis que citavam `API`, `backend`, `endpoint`, `tenant`, autenticação técnica ou "ranking real".
- Mantida intacta a lógica de consumo dos endpoints e os contratos de dados; a alteração foi apenas de strings exibidas ao usuário.
- Simplificados textos dos módulos de Relatórios, Classes, Dashboard e Chamada para linguagem de usuário final.
- Removida a letra `P` do selo visual da página de Presenças.

## Conhecimento consolidado
- A interface não deve expor detalhes de implementação como API, backend, endpoint, tenant ou autenticidade dos dados em textos destinados ao usuário comum.
- Erros internos podem continuar usando metadados técnicos no código, mas a mensagem exibida deve preferir uma descrição funcional e compreensível.
