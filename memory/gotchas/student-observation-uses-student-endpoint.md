# A edição do aluno salva observação no endpoint de aluno

## Problema
Editar a observação na tela de aluno podia não persistir e, ao limpar o campo, o valor anterior reaparecia.

## Causa
A tela estava enviando a observação para a atualização cadastral da pessoa e reaproveitando o valor antigo quando o campo vinha vazio.

## Solução
- Atualizar a pessoa apenas com os dados cadastrais.
- Persistir `observacao` em `PUT /students/:id/observation`.
- Tratar string vazia como remoção válida da observação ao aplicar a mutação local.

## Data
2026-08-03
