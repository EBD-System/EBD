# Sessão 2026-08-10 — bloqueio de Relatórios para Financeiro e correção do extrato

- O hub de Relatórios passou a esconder os submódulos não financeiros quando o token pertence ao perfil `Financeiro`.
- Os submódulos `melhor-aluno-geral`, `melhores-classes`, `melhor-da-classe` e `presencas` passaram a abrir o diálogo reutilizável de permissão ao receber HTTP 403, em vez de seguir apenas com alerta/redirect.
- O extrato financeiro em PDF teve o bug de paginação corrigido: `drawFinancePage` agora recebe metadados válidos de página e o rodapé não depende de `meta` indefinido.
- O PDF financeiro continua consolidado a partir do JSON do backend, com `Total Geral` repetido no topo das páginas seguintes e título `Extrato Financeiro EBD`.
- O botão **Baixar Extrato** permanece no submódulo financeiro e agora usa o contrato estável do backend sem depender do DOM da tela.
