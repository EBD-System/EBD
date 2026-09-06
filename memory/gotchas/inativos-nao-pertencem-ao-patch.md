# Alunos inativos não entram no PATCH da chamada aberta

## Problema
A tela de chamada pode listar alunos ativos e inativos ao mesmo tempo, mas a chamada aberta no backend só materializa os vínculos que existem naquele dia. Se o frontend enviar alunos inativos junto com os ativos, o backend pode falhar ao procurar um `id_aluno_classe` que não existe em `ebd_chamada_aluno`.

## Causa
A lista visual da classe é maior do que o conjunto efetivo de registros da chamada aberta.

## Solução
- Tratar os cards inativos como informativos/read-only para o salvamento da chamada aberta;
- filtrar o `PATCH /attendance/:callId` para apenas os alunos elegíveis da chamada;
- validar o vínculo somente para os registros que realmente vão compor o lote enviado ao backend.
