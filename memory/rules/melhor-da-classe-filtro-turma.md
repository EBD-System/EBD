# Filtro por turma e período no Melhor da Classe

## Regra
O submódulo **Melhor da Classe** deve carregar as turmas do backend e exibir apenas os alunos da turma selecionada. A consulta também exige `startDate` e `endDate`, com formulário visual seguindo o padrão do Financeiro.

A seleção inicial deve mostrar exatamente `&lt; SELECIONE &gt;` e, enquanto nenhuma busca válida for concluída, a tabela permanece vazia com estado introdutório. O ranking deve ser consultado com `classId`, `startDate` e `endDate`, sem limite de quantidade: todos os alunos da turma retornados pela consulta devem ser exibidos.

## Aplicação
Aplica-se à tela `src/modules/relatorios/melhor-da-classe/index.html`, ao page controller `src/modules/relatorios/pages/melhor-da-classe.js` e ao service compartilhado `src/modules/relatorios/services/relatorios.service.js`.
