# Resposta enriquecida na matrícula de aluno

## Decisão

O endpoint `POST /api/v1/students/enroll` passou a devolver, além de `id_aluno`, o registro enriquecido do aluno recém-matriculado, incluindo `id_aluno_classe`, `id_pessoa`, `id_classe`, `classe`, `matricula`, `status` e demais campos já resolvidos pelo backend.

## Motivo

O frontend precisa do vínculo ativo imediatamente após a matrícula para seguir o fluxo sem depender de outra consulta de turma/chamada, e a resposta antiga devolvia apenas o identificador do aluno.

## Data

2026-07-22
