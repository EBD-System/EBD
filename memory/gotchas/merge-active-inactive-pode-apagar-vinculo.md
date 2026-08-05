# Mesclagem de listas pode apagar o vínculo aluno-classe

## Problema
Ao carregar alunos ativos e inativos em consultas separadas, a mesclagem final pode sobrescrever um `id_aluno_classe` válido com um campo vazio vindo de uma das respostas.

## Causa
Algumas respostas da API retornam o mesmo aluno com campos diferentes. Se o front fizer spread direto do objeto mais recente por cima do anterior, um valor vazio pode apagar o vínculo correto.

## Solução
- Ao combinar registros duplicados, preservar o primeiro `id_aluno_classe` não vazio encontrado.
- Nunca trocar um vínculo válido por `''`, `null` ou `undefined`.
- Preservar o vínculo também nos aliases do objeto (`attendanceKey`, `studentClassId`, `id_aluno_classe`, `idAlunoClasse`) e no `raw`, porque a tela pode reler qualquer uma dessas camadas depois do merge.
- Antes de salvar a chamada, validar o vínculo final já mesclado, não apenas a resposta bruta de cada endpoint.
