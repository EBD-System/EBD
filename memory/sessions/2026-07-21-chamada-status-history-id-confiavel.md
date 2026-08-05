# Sessão 2026-07-21 — Histórico de status com id confiável

## O que foi alterado
A tela de chamada parou de inventar `id` de aluno quando o payload não traz um identificador explícito. O carregamento do `status-history` agora depende apenas do `id` autoritativo recebido da API.

## Conhecimento consolidado
- `GET /students/:id/status-history` não deve ser chamado com `id` derivado de posição da lista.
- Se o backend não enviar `id` confiável, o front deve degradar a exibição do motivo da inativação em vez de tentar consultar o histórico.
- O fallback de observação do próprio payload continua válido quando existir.

## Próximos passos
Manter essa regra também em qualquer novo fluxo que dependa de histórico por aluno.
