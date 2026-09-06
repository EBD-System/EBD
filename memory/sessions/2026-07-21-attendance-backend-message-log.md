# Sessão 2026-07-21 — Mensagem do backend no erro de chamada

## O que foi alterado
- `src/shared/services/api-client.js` passou a preservar a mensagem principal também em falhas sinalizadas no payload.
- `src/modules/chamada/pages/chamada.js` agora trata `payload.ok === false` como erro e continua exibindo o motivo retornado pelo backend no salvamento individual da presença.
- Os fluxos de `login` e `classes` receberam o mesmo teste de payload para não ignorar falhas de negócio com HTTP 2xx.

## Conhecimento consolidado
- Para erros de chamada, `error.message` pode ser genérico em produção.
- O texto mais fiel ao backend deve vir de `error.primaryMessage` ou `error.backendMessage`.
- O backend pode sinalizar falha por payload `{ ok:false }` mesmo sem status HTTP 4xx/5xx, então o frontend precisa converter esse envelope em exceção.
- O feedback da tela de chamada pode exibir o motivo exato do backend sem abandonar o resumo geral quando houver várias falhas.

## Próximos passos
- Reaproveitar esse padrão em outros fluxos que possam receber envelopes de erro com HTTP 2xx.
