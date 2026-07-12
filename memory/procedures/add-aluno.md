# Como cadastrar um aluno

## Passos
1. Abra a página dedicada **Adicionar Aluno** em `aluno/adicionar-aluno/`.
2. Preencha nome, celular opcional, data de nascimento opcional e turma.
3. Envie o formulário para disparar a ação `addAluno` no backend.
4. O Apps Script grava o aluno diretamente na aba `Cadastro`, sem exigir cadastro de nova turma nessa tela.
5. Depois do retorno, o frontend limpa os campos e mantém a turma selecionada para agilizar o próximo cadastro.
6. Para teste manual no editor do Apps Script, ajustar `adicionarAlunoManual()` com a turma desejada e executar a função.
