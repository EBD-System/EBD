# Sessão 2026-07-21

## O que foi alterado
O botão `Adicionar Aluno` da tela de chamada passou a abrir um formulário completo de cadastro em pop-up. O fluxo agora cria a pessoa em `/people` e, em seguida, matricula o aluno na classe atual em `/students/enroll`, com validação visual do campo obrigatório.

## Conhecimento consolidado
- A tela de chamada recebe `classId` e `className` pela query string.
- O cadastro do aluno acontece em dois passos: primeiro a pessoa, depois a matrícula na classe.
- Apenas o nome do aluno é obrigatório no formulário; os demais campos são opcionais.
- O formulário precisa destacar campos inválidos com borda vermelha e levar o foco ao primeiro campo não preenchido.
- O diálogo de cadastro também precisa mostrar claramente em qual classe o aluno será vinculado.

## Próximos passos
Integrar a listagem real dos alunos da classe e, se necessário, alinhar com o backend quais campos opcionais são persistidos em cada etapa do cadastro.
