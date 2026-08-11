# Sessão 2026-08-08 — PDF de relatórios separado

## O que foi alterado
- O módulo de Relatórios passou a ter dois downloads independentes:
  - **Baixar Relatório**: gera somente o consolidado por classes;
  - **Presenças**: gera somente o detalhamento de presença.
- O PDF do relatório geral deixou de anexar as páginas de presença no mesmo arquivo.

## Conhecimento consolidado
- O backend de presença continua sendo consultado por `GET /reports/period/pdf`, mas agora apenas pelo fluxo separado de presenças.
- O relatório geral deve continuar baseado no snapshot consolidado da busca, sem incorporar o detalhamento de presença.

## Próximos passos
- Validar no navegador se os dois botões aparecem habilitados após a busca.
- Confirmar se os nomes dos arquivos baixados ficaram coerentes com cada tipo de PDF.
