# Armadilhas conhecidas

## `data_chamada` pode vir como `Date`/timestamp do PostgreSQL

**Problema:** a mutação da presença e a reabertura da chamada podem ser bloqueadas mesmo quando a chamada pertence ao mesmo dia civil de hoje.

**Causa:** o PostgreSQL pode devolver `data_chamada` como `Date`/timestamp, e comparar esse valor diretamente com a string ISO de `todayISO()` falha por diferença de tipo ou por diferença de fuso/horário.

**Solução:** antes de validar, normalizar `data_chamada` para `YYYY-MM-DD` no fuso `America/Bahia` e comparar apenas ano, mês e dia. Isso vale para a alteração de presença e para a reabertura da chamada.
