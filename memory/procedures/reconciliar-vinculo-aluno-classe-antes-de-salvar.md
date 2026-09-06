# Reconciliar vínculo aluno-classe antes de salvar

## Passos
1. Carregue o snapshot atual da chamada (`GET /classes/:id/attendance?date=...` ou equivalente).
2. Para cada aluno sem `id_aluno_classe` no estado local, tente resolver o vínculo usando os identificadores retornados pela API (`id_aluno`, `id_pessoa`, `studentId` e aliases compatíveis).
3. Se o snapshot devolver o vínculo, atualize o estado local com `id_aluno_classe` antes de montar os `PATCH`.
4. Se o vínculo continuar ausente após a reconciliação, interrompa o salvamento e exiba erro explícito.
5. Nunca invente `studentClassId` com índice de lista, matrícula ou posição visual.
