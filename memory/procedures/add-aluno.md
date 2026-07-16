# Adicionar aluno

## Passos

1. Abrir a página dedicada de inclusão.
2. Preencher nome, celular, data de nascimento opcional e turma.
3. Carregar a lista de classes via `GET /api/classes` com o Bearer da sessão autenticada.
4. Enviar a criação para a API HTTP do backend.
5. Registrar a nova matrícula sem exigir criação de nova turma nessa tela.
