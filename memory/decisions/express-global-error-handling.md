# Tratamento global de exceções no Express

## Decisão

Todos os controllers assíncronos da API devem ser montados através de `asyncHandler(...)` ou wrapper equivalente, para garantir que rejeições e exceções sejam encaminhadas ao middleware global com `next(err)`.

O middleware global de erro permanece como a última camada de resposta e deve:
- manter o `statusCode` de erros conhecidos do tipo `HttpError`;
- responder `500` para erros inesperados;
- usar o envelope oficial da API;
- não expor stack trace ao cliente.

## Motivo

O Express 4 não captura automaticamente erros lançados dentro de controllers assíncronos. Sem wrapper, uma exceção de negócio pode derrubar o processo Node durante a execução.

## Data

2026-07-17

## Complemento
Erros de parse de JSON vindos do `express.json()` são normalizados para `400` com stage `request` e mensagem genérica `Requisição inválida.` antes de chegar ao handler final.
