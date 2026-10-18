# Carregar alunos da classe por status

## Passos
1. Abrir a tela de chamada com `classId` e `className` na query string.
2. Validar a existência de token em `sessionStorage`.
3. Consumir a lista de ativos com `GET /students?classId=:id&status=ativo`.
4. Consumir a lista de inativos com `GET /students?classId=:id&status=inativo`; para a etapa de consulta prévia do popup de cadastro, o fallback permitido é `GET /students/inactive?classId=:id`, sempre com o ID da turma.
4.1. Não usar `GET /students/inactive` sem `classId` para preencher o popup de cadastro, pois ele precisa mostrar somente alunos vinculados à turma atual.
5. Quando o backend não suportar os filtros por status, usar `GET /classes/:id/students` apenas como fallback e normalizar a resposta antes de separar os registros.
6. Mesclar os resultados por vínculo aluno-classe, preservando o registro inativo quando houver duplicidade entre listas.
6.1. Durante a mesclagem, nunca sobrescrever um `id_aluno_classe` válido com valor vazio vindo de outra resposta; o vínculo não pode ser perdido no merge.
7. Exibir a aba **Ativos** por padrão.
8. Alternar entre as abas sem recarregar a página.
9. Para alunos inativos, consultar primeiro `GET /students/inactive-reasons?ids=...` com os `id`s confiáveis dos alunos visíveis; se o lote não devolver a razão, consultar `GET /students/:id/status-history` apenas como fallback.
10. Quando um status de presença é alterado na tela, atualizar apenas o card afetado e manter os contadores e o resumo sincronizados.
11. Na aba **Inativos**, perfis Administrador e Secretaria podem usar **Ativar todos os alunos**; a ação chama `PUT /classes/:id/students/activate-all` com o ID real da turma e JSON `{}` sem observação, pede confirmação e recarrega os dados após sucesso.

## Observação
Se o backend não devolver o motivo da inativação nem no payload principal nem no histórico de status, o front deve mostrar apenas o fallback visual disponível.

O endpoint de ativação em lote é responsável por alterar somente alunos inativos com vínculo ativo à turma indicada. O frontend não deve substituir esse fluxo por chamadas individuais nem remover/alterar vínculos de outras turmas.
