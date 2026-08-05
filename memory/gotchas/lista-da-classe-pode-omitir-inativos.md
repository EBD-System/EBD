# A listagem da classe pode omitir alunos inativos

## Problema
A aba **Inativos** da chamada pode ficar vazia mesmo depois de um aluno ser inativado corretamente.

## Causa
Alguns payloads da classe trazem apenas os alunos ativos. Se o front depender de um único `GET /classes/:id/students` e filtrar localmente, os inativos nunca entram na lista.

## Solução
- Buscar ativos e inativos com filtros de status quando disponíveis;
- usar `GET /students?classId=:id&status=ativo` e `GET /students?classId=:id&status=inativo` como caminho principal;
- aplicar fallbacks para `GET /students/inactive` e, por último, `GET /classes/:id/students`;
- mesclar os resultados por vínculo aluno-classe antes de renderizar as abas.
