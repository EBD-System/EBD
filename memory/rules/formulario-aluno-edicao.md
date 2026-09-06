# Regra do formulário de aluno na chamada

## Regra
Ao editar um aluno, o campo **Data de início** deve permanecer visível, mas bloqueado para alteração. O formulário também deve exibir um toggle de status ativo/inativo e esse toggle deve ser o meio suportado para ativar ou inativar o aluno.

## Aplicação
- no modo de edição, **Data de início** fica desabilitado apenas para edição manual;
- o toggle de status deve refletir o estado atual do aluno;
- a edição persiste os dados cadastrais em `PUT /people/:id`;
- ativação e inativação usam `PUT /students/:id/activate` e `PUT /students/:id/inactivate`;
- o botão **Excluir aluno** usa inativação como fallback porque não há DELETE no backend.
