# Como editar um aluno

## Passos
1. Na lista da turma, clicar em **Editar** no cartão do aluno.
2. O site abre a rota `aluno/editar-aluno/` com o `alunoId` do cadastro.
3. Conferir o código exibido após `#`, que continua apenas como referência.
4. Alterar apenas os campos editáveis: nome, celular, turma e status.
5. Salvar as alterações e aguardar o retorno para a tela principal após a confirmação do backend.
6. O envio usa a ação `updatealuno` (normalizada em minúsculas) e replica os parâmetros na query string para sobreviver ao redirecionamento do Apps Script.
