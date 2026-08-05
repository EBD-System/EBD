# Salvamento da chamada em lote

## Decisão
O fluxo canônico de salvamento da chamada usa `PATCH /attendance/:callId` com `students[]`. O envio individual por aluno continua apenas como compatibilidade histórica, não como caminho principal.

## Motivo
O salvamento em lote reduz tráfego, evita rajadas de requisições por aluno e alinha o frontend ao backend que processa a chamada de forma transacional.

## Data
2026-07-22
