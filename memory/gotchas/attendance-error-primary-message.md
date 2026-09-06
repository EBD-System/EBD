# Mensagem principal do backend em falhas de chamada

## Problema
No salvamento da chamada, `error.message` pode trazer uma mensagem amigável e genérica, mesmo quando o backend enviou um motivo mais específico no payload.

## Causa
`src/shared/services/api-client.js` normaliza erros para produção e usa `error.message` como texto final. A mensagem detalhada do backend fica em `error.primaryMessage` e, em alguns fluxos, também em `error.backendMessage`. Além disso, o backend pode responder com HTTP 200 e `ok:false`, o que exige tratar o payload como erro mesmo sem status HTTP de falha.

## Solução
- Quando o objetivo for logar ou exibir o motivo exato da falha de chamada, priorize `error.primaryMessage` ou `error.backendMessage`.
- Use `error.message` apenas como fallback.
- Trate `payload.ok === false` como falha de API, mesmo quando o HTTP vier com status 2xx.
- No fluxo de `PATCH /attendance/:callId` com `students[]`, isso garante que a mensagem do backend apareça no log e no feedback da tela quando houver uma falha individual.
