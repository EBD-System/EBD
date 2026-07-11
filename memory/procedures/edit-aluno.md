# Como editar um aluno

## Passos
1. Na lista da turma, clicar em **Editar** no cartão do aluno.
2. O site abre a rota `aluno/editar-aluno/` com a chave de edição baseada no nome atual do aluno.
3. Conferir o código exibido após `#`, que continua apenas como referência.
4. Alterar nome, celular e turma normalmente; o campo de status continua visível apenas como referência e fica bloqueado na tela.
5. O código interno do aluno fica visível somente na página de edição.
6. Salvar as alterações e aguardar o retorno para a tela principal após a confirmação do backend.
7. O envio usa a ação `updatealuno` (normalizada em minúsculas) e repete os parâmetros na query string e no corpo `application/x-www-form-urlencoded` para o Apps Script receber os dados corretamente.
8. O cliente também envia `acao` como alias de compatibilidade e só faz nova tentativa via GET se a atualização responder explicitamente `Ação inválida`.
9. Para excluir o aluno, usar o botão **Excluir aluno** no topo, confirmar a ação e aguardar o retorno para a tela principal.
10. Para validar a implantação, consultar `health` no Web App e conferir `version` e `deployedAt` na resposta.
