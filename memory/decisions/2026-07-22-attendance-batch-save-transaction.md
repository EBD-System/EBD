# Decisão: salvamento em lote da chamada com transação única

## Decisão

O salvamento oficial da chamada passou a aceitar atualização em lote via `PATCH /api/v1/attendance/:callId`, recebendo `students[]` e aplicando todas as alterações dentro de uma única transação no repository. Quando a linha do aluno ainda não existe em `ebd_chamada_aluno`, o backend tenta materializá-la antes de atualizar, desde que o aluno pertença à turma da chamada e esteja ativo.

## Motivo

O frontend já agrega todas as alterações antes de salvar. Enviar uma requisição por aluno criava risco de gravação parcial, aumentava a latência e dificultava qualquer compensação confiável no cliente. Além disso, o lote pode chegar com alunos que ficaram elegíveis após a abertura da chamada, então o backend precisa tolerar a ausência da linha materializada.

## Data

2026-07-22
