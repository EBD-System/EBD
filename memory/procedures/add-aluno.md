# Adicionar aluno

## Passos

1. Abrir a página dedicada de inclusão.
2. Preencher nome, celular, data de nascimento opcional e turma.
3. Carregar a lista de classes via `GET /api/classes` com o Bearer da sessão autenticada.
4. Normalizar a resposta para aceitar `classes` ou `turmas` e converter `id_classe`/`nome` para `TurmaID`/`Nome`.
5. Enviar a criação para a API HTTP do backend.
6. Registrar a nova matrícula sem exigir criação de nova turma nessa tela.
