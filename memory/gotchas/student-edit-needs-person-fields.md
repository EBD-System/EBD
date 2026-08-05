# Edição de aluno precisa carregar os campos da pessoa

## Problema
A edição cadastral do aluno parecia “não persistir” quando a tela era reaberta.

## Causa
O modal de edição é alimentado pelo payload de `/students`, mas esse payload precisa trazer também os campos da pessoa. Sem isso, os valores salvos em `/people/:id` não voltam a aparecer na reabertura.

## Solução
Manter `listStudents` e `getStudentById` retornando os campos cadastrais da pessoa usados pelo formulário de edição, especialmente `sexo`, `cpf`, `data_nascimento`, `telefone`, `email`, `logradouro`, `numero`, `bairro`, `cidade`, `uf` e `cep`.
Além disso, `sexo` deve voltar na forma textual da API para casar com o `<select>` da tela (`masculino`/`feminino`/`outro`).

## Data
2026-08-03
