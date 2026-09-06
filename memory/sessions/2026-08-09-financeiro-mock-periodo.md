# Sessão 2026-08-09 — Financeiro com mock de período

## O que foi alterado
- O submódulo `relatorios/financeiro` deixou de ser um placeholder e passou a usar um mock funcional no mesmo padrão visual de `melhores-classes`.
- A interface agora possui `Data inicial`, `Data final`, seleção de turma com `< SELECIONE >` e botão **Buscar**.
- O resultado mostra o total consolidado do período no topo e lista os lançamentos individuais em verde para conferência da soma.

## Conhecimento consolidado
- O módulo financeiro deve operar por consulta única, recebendo todos os lançamentos de uma vez e permitindo filtro local por período e turma.
- O valor individual das ofertas precisa permanecer visualmente destacado em verde para leitura rápida.

## Próximos passos
- Conectar o mock ao backend quando o contrato de retorno do relatório financeiro estiver fechado.
