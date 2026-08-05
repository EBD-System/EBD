# Como editar um aluno

## Passos
1. Na lista da turma, clicar em **Editar** no cartão do aluno.
2. A página abre em `aluno/editar-aluno/` com a chave de edição baseada no nome atual do aluno.
3. O código interno continua visível apenas no bloco de referência do formulário.
4. Alterar nome, celular, turma e status normalmente.
5. O campo **Cancelar** do formulário e o botão **Voltar** do topo usam a mesma navegação de retorno.
6. No cabeçalho da edição, **Voltar** fica alinhado à esquerda e **Excluir Aluno** à direita; a exclusão exige confirmação antes do envio.
7. Salvar as alterações e aguardar o retorno para a tela principal após a confirmação do backend.
8. O envio usa a ação `updatealuno` (normalizada em minúsculas) e repete os parâmetros na query string e no corpo `application/x-www-form-urlencoded` para o Apps Script receber os dados corretamente.
9. O cliente também envia `acao` como alias de compatibilidade e só faz nova tentativa via GET se a atualização responder explicitamente `Ação inválida`.
10. O celular é formatado com `formatToBrPhone` em tempo de digitação e na montagem do valor salvo.
11. Para validar a implantação, consultar `health` no Web App e conferir `version` e `deployedAt` na resposta.
