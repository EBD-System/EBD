# Cadastrar aluno pela tela de chamada

## Passos
1. Abrir a tela da classe já selecionada.
2. Clicar em `Adicionar Aluno`; o modal consulta primeiro os alunos inativos vinculados àquela turma.
3. Se o aluno já estiver listado, usar `Ativar`; o frontend chama `PUT /students/:id/activate` e atualiza a lista.
4. Se o aluno não estiver listado, clicar em `Criar Novo Aluno` para exibir o formulário existente.
5. Preencher o nome do aluno e, se desejar, os demais campos opcionais.
6. Enviar o formulário.
7. O front cria a pessoa em `POST /people`.
8. Em seguida, o front chama `POST /students/enroll` com `idPessoa` e `idClasse`.
9. O novo aluno é inserido na lista visual da tela quando o cadastro conclui com sucesso.
10. A tela permanece na aba **Ativos** e a lista é atualizada sem recarregar a página.

## Observações
- O campo de nome é o único obrigatório.
- Campos vazios não devem ser enviados.
- Se o token não existir ou expirar, o fluxo volta para a tela de login.

## Observação adicional
Quando a listagem de alunos já estiver carregada, o novo registro deve aparecer no conjunto ativo exibido no momento.

## Consulta prévia de inativos

A etapa inicial deve consultar `GET /students?classId=:id&status=inativo` e pode usar `GET /students/inactive?classId=:id` como fallback. Nunca usar `/students/inactive` sem `classId` nessa etapa, pois a lista deve ser da turma aberta.
