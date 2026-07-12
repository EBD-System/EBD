# Handoff

Antes de responder ou alterar o projeto, consulte primeiro a memória consolidada.

Pontos centrais:

- A fonte oficial continua sendo o Google Sheets via Apps Script.
- O navegador usa localStorage para rascunhos e também para snapshots consolidadas de chamadas salvas por data/turma.
- A chamada do dia exige marcação completa antes do salvamento.
- O endpoint `health` existe para checagem rápida do backend e deve expor `version` e `deployedAt`.
- Decisões arquiteturais devem ficar em arquivos curtos dentro de `memory/`.
- A edição de aluno acontece em uma página dedicada em `aluno/editar-aluno/`.
- O botão **Editar** leva para essa rota com a chave de edição baseada no nome atual do aluno.
- O fluxo de edição grava alterações diretamente na aba `cadastro` da planilha.
- As ações enviadas ao Apps Script são normalizadas para minúsculas no cliente.
- O cliente envia POST como `application/x-www-form-urlencoded`; o espelhamento completo na query string só deve acontecer quando houver fallback real por GET.
- O salvamento de chamada (`saveCall`) não deve repetir `rowsJson` na URL, porque isso pode quebrar o envio em turmas grandes.
- O Web App do Apps Script pode redirecionar POST para GET; por isso, salvamentos precisam ter `action` também na query string e o backend deve aceitar a mesma rota em `doGet`.
- O modo `restricted` também pode editar alunos; apenas o modo `self` segue bloqueado para edição.
- Na edição de aluno, o campo `Status` está visível, mas fica desativado temporariamente na interface.
- A página de edição também ganhou ação de exclusão do aluno, confirmada antes do envio ao backend.
- No layout mobile da edição, **Voltar** fica no canto esquerdo do cabeçalho e **Excluir Aluno** permanece à direita.

- O carregamento inicial do frontend usa `apiGet` com timeout, e agora também consulta snapshots locais salvas antes de cair para a planilha quando a data já foi salva no navegador.
- O envio de atualização de aluno só faz fallback automático para GET quando o POST retorna explicitamente `Ação inválida`; outros erros precisam aparecer sem mascaramento.
- A edição de aluno agora pode preservar turma e status atuais quando esses campos não vierem preenchidos no payload.

- O cadastro de aluno usa a ação `addAluno` e grava diretamente na aba `Cadastro` da planilha.
- Para testes manuais no Apps Script, existe `adicionarAlunoManual()` como helper editável.
- O backend resolve a aba de cadastro de forma case-insensitive, então `Cadastro` e `cadastro` passam a apontar para a mesma planilha quando já existir uma delas.
- O cliente passou a repetir como `GET` as ações `addAluno`, `addTurma` e `updatealuno` quando o `POST` falha com `Failed to fetch` ou `Ação inválida`, porque o Web App do Apps Script responde melhor nesse fallback.

- O cadastro de aluno ganhou uma página dedicada em `aluno/adicionar-aluno/`, acessível por um botão na tela principal.
- Essa tela de inclusão não exibe cadastro de nova turma; apenas nome, celular, data de nascimento opcional e turma.
- A inclusão de aluno não depende de um código de acesso específico; qualquer modo pode cadastrar aluno.
- O backend de inclusão agora aceita `dataNascimento` opcional e grava também o mês na planilha.
- O fluxo de inclusão de aluno continua gravando na aba `Cadastro` e mantém o helper `adicionarAlunoManual()` para testes no Apps Script.

- O dashboard principal não exibe mais o gráfico incorporado do Google Sheets.
- Na tela de ações da chamada, o botão de salvar ocupa a faixa inteira e os botões de relatório foram renomeados para `Relatório Turma` e `Relatório Geral`.
- Na página dedicada de inclusão de aluno, a turma fica pré-selecionada quando houver opções e o envio fica bloqueado enquanto não existir turma cadastrada.

- A página dedicada de inclusão de aluno agora inicia a turma em `< SELECIONE >`, exige escolha explícita antes do envio, mantém **Cancelar** e **Voltar** apontando para a mesma navegação e usa a formatação brasileira de celular via `formatToBrPhone`.

- Na edição de aluno, o topo perdeu o bloco de código/turma atual; o código interno continua visível apenas no formulário.
- O botão destrutivo **Excluir Aluno** foi movido para o topo, ao lado de **Voltar**.
- O campo de celular da edição agora usa `formatToBrPhone` também enquanto o usuário digita, e o botão **Cancelar** do formulário segue a mesma navegação de retorno do **Voltar**.

- Foi adicionado um console de diagnóstico visível na chamada e nas páginas de aluno; ele distingue erros de `FRONTEND` e `BACKEND` para facilitar suporte e depuração.
- O console de diagnóstico foi ajustado para ficar visível apenas no acesso `50292230`; em outros acessos, os erros continuam aparecendo só no feedback vermelho.
- Erros sem prefixo no cliente devem ser registrados como `FRONTEND` no console de diagnóstico, enquanto respostas `ok: false` do backend continuam como `BACKEND`.

- O botão **Salvar** grava uma snapshot local da chamada da turma/data; relatórios e busca por data devem priorizar esse armazenamento e usar a planilha apenas como fallback.
- O fluxo de salvar chamada depende do helper local `nowIso()` em `src/js/services/api.js`; sem ele, a snapshot local falha com erro de referência.
