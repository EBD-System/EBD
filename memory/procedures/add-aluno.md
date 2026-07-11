# Como cadastrar um aluno

## Passos
1. Na página principal, preencher o formulário **Novo aluno** com nome, celular opcional e turma.
2. Enviar o formulário para disparar a ação `addAluno` no backend.
3. O Apps Script grava o aluno diretamente na aba `Cadastro`.
4. Depois do retorno, o frontend atualiza os dados da turma e limpa os campos do formulário.
5. Para teste manual no editor do Apps Script, ajustar `adicionarAlunoManual()` com a turma desejada e executar a função.
