# PATCH de presença exige id_aluno_classe

## Problema
Ao clicar em **Salvar Chamada**, o envio individual `PATCH /attendance/:callId/students/:studentClassId` pode acertar o aluno errado ou retornar `404` quando o front inventa o `studentClassId` a partir de `id_matricula`, `id`, `index + 1` ou outro fallback não confiável. No fluxo em lote, o mesmo problema aparece se algum item de `students[]` chegar sem vínculo válido.

## Causa
O identificador do vínculo aluno-classe precisa vir da API como `id_aluno_classe` (ou alias equivalente do mesmo vínculo). Se o frontend reaproveitar um identificador de matrícula ou uma posição da lista, o path do `PATCH` deixa de apontar para o registro correto.

## Solução
- Tratar `id_aluno_classe` como obrigatório para o fluxo de chamada.
- Bloquear explicitamente o salvamento quando qualquer aluno não trouxer o vínculo.
- Nunca usar `id_matricula`, `id` ou posição da lista como substituto do `studentClassId`.
- No batch `PATCH /attendance/:callId`, cada item de `students[]` precisa carregar o vínculo correto.
- Na criação de aluno na tela de chamada, também exigir que o backend devolva o vínculo antes de inserir o novo item na lista.
