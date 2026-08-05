# Sessão 2026-08-05 — Data de negócio viva na chamada

## O que foi alterado
- A tela de chamada deixou de congelar `attendanceDate` no estado inicial.
- As consultas de snapshot e de resumo passaram a calcular a data de negócio no momento da requisição.
- O `POST /attendance/open` não recebe mais data do cliente.
- O fallback UTC foi removido da função de data da chamada.

## Conhecimento consolidado
- A tela de chamada não deve tratar a data como snapshot permanente quando a página fica aberta por muito tempo.
- A data de consulta precisa ser recalculada em cada request para acompanhar a virada do dia em `America/Bahia`.

## Próximos passos
- Manter qualquer nova requisição da tela de chamada alinhada com a mesma função de data de negócio.
