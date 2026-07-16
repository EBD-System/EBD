# Editar aluno

## Passos

1. Abrir a página dedicada de edição do aluno.
2. Carregar a lista de classes via `GET /api/classes` com `Authorization: Bearer <token>` e os dados atuais pelo identificador lógico definido pela interface.
3. Enviar a atualização para a API HTTP do backend usando `application/x-www-form-urlencoded`.
4. Preservar turma e status atuais quando esses campos não vierem no payload.
5. Atualizar o histórico local após a confirmação da resposta e sincronizar a listagem.
