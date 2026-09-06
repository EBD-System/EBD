# Consulta financeira por período com ofertas individuais

## Regra
O submódulo **Financeiro** deve consultar o backend em `GET /api/v1/reports/financial-period`, com aliases compatíveis `financial`, `financeiro` e `financeiro-period`.

A consulta aceita `startDate`, `endDate` e `classId` opcional, e o frontend deve renderizar o consolidado a partir de `summary.total_ofertas`, `summary.total_lancamentos`, `periodo` e `entries`.

## Aplicação
Aplica-se a `src/modules/relatorios/financeiro/index.html` e ao service compartilhado `src/modules/relatorios/services/relatorios.service.js`.
