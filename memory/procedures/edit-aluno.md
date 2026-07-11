# Como editar um aluno

## Passos
1. Na lista da turma, clicar em **Editar** no cartão do aluno.
2. O site abre a rota `aluno/editar-aluno/` com a chave de edição baseada no nome atual do aluno.
3. Conferir o código exibido após `#`, que continua apenas como referência.
4. Alterar apenas os campos editáveis: nome, celular, turma e status.
5. Salvar as alterações e aguardar o retorno para a tela principal após a confirmação do backend.
6. O envio usa a ação `updatealuno` (normalizada em minúsculas) e repete os parâmetros na query string e no corpo `application/x-www-form-urlencoded` para o Apps Script receber os dados corretamente.
7. O cliente também envia `acao` como alias de compatibilidade e faz nova tentativa via GET se a atualização responder `Ação inválida`.
