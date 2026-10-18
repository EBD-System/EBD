# Sessão 2026-10-16 — Ativação em lote na chamada

## Alterações
- Adicionado, na aba **Inativos** da chamada, o botão **Ativar todos os alunos**, visível a perfis Administrador e Secretaria.
- A ação confirma a operação, chama `PUT /classes/:id/students/activate-all` e recarrega a lista; feedback de sucesso/erro é exibido na própria área.
- Adicionado teste estático para a posição e o contrato da ação.

## Conhecimento consolidado
A ativação em lote deve usar o endpoint da turma, que restringe a alteração a alunos inativos com vínculo ativo nessa classe. O frontend não deve ativar alunos indiscriminadamente nem enviar observação quando não informada.

## Próximos passos
Confirmar no ambiente integrado o nome exato do campo de contagem retornado pelo backend, caso seja necessário ajustar as variações reconhecidas pelo frontend.
