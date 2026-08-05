# Sessão 2026-07-21 — CallId da chamada na URL

## O que foi alterado
`src/modules/chamada/pages/chamada.js`:
- A tela passou a ler `callId` da query string (`?callId=...`) em vez de `sessionStorage`.
- Sempre que `POST /attendance/open` ou o snapshot retornam um `callId` válido, a URL é atualizada com `history.replaceState`.
- O fluxo de abertura da chamada acontece antes do salvamento, para garantir que o front use o identificador válido do dia atual.

`src/app/config/storage.js`:
- removida a chave de `attendanceCallId`; esse identificador não deve mais ser persistido em cache local.

## Conhecimento consolidado
- `callId` de chamada é contextual ao dia/turma e não deve ser reaproveitado de forma persistente fora da URL da tela atual.
- O frontend precisa abrir a chamada e sincronizar o `callId` na query string antes de salvar presença.
- Se ainda houver `400`, a mensagem tende a vir da validação do backend para data/chamada, não do cache do front.

## Próximos passos
- Testar o fluxo abrindo uma classe, conferir se a URL recebe `?callId=...` e validar o salvamento com `PATCH /attendance/:callId/students/:studentClassId`.
