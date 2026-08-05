# Como cadastrar um aluno

## Passos
1. Abra a página dedicada **Adicionar Aluno** em `aluno/adicionar-aluno/`.
2. Preencha o nome do aluno, o celular opcional e a data de nascimento opcional.
3. A turma deve ser escolhida manualmente: o seletor começa em `< SELECIONE >` e o envio é bloqueado enquanto a turma não for escolhida.
4. Envie o formulário para disparar a ação `addAluno` no backend.
5. O Apps Script grava o aluno diretamente na aba `Cadastro`, sem exigir cadastro de nova turma nessa tela.
6. Depois do retorno, o frontend limpa os campos e volta o seletor de turma para `< SELECIONE >`.
7. O botão **Cancelar** usa a mesma navegação do botão **Voltar**.
8. O celular é formatado em tempo real pelo helper `formatToBrPhone`, no padrão brasileiro de DDD + celular.

