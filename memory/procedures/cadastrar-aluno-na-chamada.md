# Cadastrar aluno pela tela de chamada

## Passos
1. Abrir a tela da classe já selecionada.
2. Clicar em `Adicionar Aluno`.
3. Preencher o nome do aluno e, se desejar, os demais campos opcionais.
4. Enviar o formulário.
5. O front cria a pessoa em `POST /people`.
6. Em seguida, o front chama `POST /students/enroll` com `idPessoa` e `idClasse`.
7. O novo aluno é inserido na lista visual da tela quando o cadastro conclui com sucesso.
8. A tela permanece na aba **Ativos** e a lista é atualizada sem recarregar a página.

## Observações
- O campo de nome é o único obrigatório.
- Campos vazios não devem ser enviados.
- Se o token não existir ou expirar, o fluxo volta para a tela de login.

## Observação adicional
Quando a listagem de alunos já estiver carregada, o novo registro deve aparecer no conjunto ativo exibido no momento.
