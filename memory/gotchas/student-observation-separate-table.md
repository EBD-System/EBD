# Observação do aluno não deve ser salva em /people

## Problema
A edição do aluno podia parecer funcionar na tela, mas a observação voltava ao valor antigo após recarregar.

## Causa
O formulário de aluno atualizava `/api/v1/people/:id`, que persiste `ebd_pessoa.observacao`, enquanto a lista e a edição de alunos usam `ebd_aluno.observacao`.

## Solução
Persistir a observação do aluno em um endpoint próprio do módulo de alunos (`PUT /api/v1/students/:id/observation`) e manter `/people/:id` apenas para dados cadastrais da pessoa.

## Data
2026-08-03
