# Regra do vínculo aluno-classe na chamada

## Regra
O fluxo de chamada só pode salvar presença quando o aluno vier com `id_aluno_classe` válido. O frontend não deve usar `id_matricula`, `id` nem posição da lista como substituto do `studentClassId`.

## Aplicação
- `GET /classes/:id/students` e o retorno de `POST /students/enroll` precisam fornecer o vínculo do aluno com a classe;
- antes de salvar, o frontend pode reconciliar os alunos com o snapshot atual da chamada para recuperar `id_aluno_classe` que já exista na API;
- ao mesclar respostas de listas distintas, o frontend precisa preservar o vínculo válido no objeto principal e no `raw`, porque a reconciliação pode depender de qualquer uma dessas camadas;
- o salvamento em `PATCH /attendance/:callId` com `students[]` deve falhar explicitamente se o vínculo continuar ausente depois da reconciliação; o endpoint individual `PATCH /attendance/:callId/students/:studentClassId` fica apenas como compatibilidade.
- alunos recém-cadastrados na tela de chamada só podem entrar na lista de presença depois que o backend devolver o vínculo correto;
- qualquer fallback posicional ou por matrícula é considerado inválido para a chamada.
