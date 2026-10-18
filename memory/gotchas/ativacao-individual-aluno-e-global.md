# Ativação individual altera o status do aluno globalmente

## Problema
A nova etapa do popup lista inativos vinculados à turma atual, mas a ação individual de ativar não é específica do vínculo aluno-turma.

## Causa
O endpoint existente é `PUT /students/:id/activate`, que recebe o ID do aluno (`id_aluno`), e o serviço chama a função de ativação do aluno. Ele não recebe `id_aluno_classe` nem `classId`.

## Solução
- Na etapa de consulta, filtrar a listagem por `classId` e `status=inativo`.
- Para ativar, usar o ID do aluno retornado pela listagem e o endpoint já existente.
- Não apresentar a ativação individual como uma operação limitada a um único vínculo de turma. Se no futuro for necessária ativação estritamente por vínculo, será preciso contrato/backend específico.
