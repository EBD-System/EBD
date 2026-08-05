# Sessão 2026-07-21 — Lista de alunos por status

## O que foi alterado
A tela de chamada passou a carregar os alunos da classe selecionada e renderizar a lista separada em duas abas: **Ativos** e **Inativos**. A interface agora abre por padrão nos alunos ativos e alterna entre os filtros sem recarregar a página. O botão `Adicionar Aluno` e o formulário de cadastro foram mantidos.

## Conhecimento consolidado
- A listagem da chamada pode vir de `GET /classes/:id/students`.
- A interface deve normalizar a resposta antes de renderizar, porque a API pode devolver array direto ou listas aninhadas.
- O status visual do aluno precisa ficar em verde para ativos e em vermelho para inativos.
- O motivo da inativação deve ser mostrado apenas quando a API fornecer o dado; quando não vier no payload principal, o front tenta usar o histórico de status.

## Próximos passos
Se o backend expuser um campo definitivo para o motivo de inativação, simplificar o fallback e eliminar consultas desnecessárias ao histórico.
