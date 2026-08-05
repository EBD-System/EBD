# reportTitle ausente no HTML de Relatórios

## Problema
Clicar em "Buscar" no módulo de Relatórios lançava `Cannot set properties of null (setting 'textContent')` e a busca quebrava antes de renderizar qualquer coisa.

## Causa
`relatorios.js` faz `document.getElementById('reportTitle')` e depois escreve `reportTitle.textContent` em `renderReport` e em `clearReport`. O `index.html` do módulo nunca teve um elemento com `id="reportTitle"`, então a constante ficava `null`. Isso já existia antes da integração com o backend (não foi introduzido pela troca do mock).

## Solução (aplicada em 2026-08-04)
Adicionar um `<h3 id="reportTitle" class="report-title">` dedicado, logo no início de `#reportContent` em `index.html`, com o CSS correspondente (`.report-title` em `relatorios.css`, `grid-column: 1 / -1`).

Não reaproveitar o `<h3 class="preview-card__title">Prévia do relatório</h3>` do card da tabela para essa finalidade — esse texto é a legenda fixa da tabela, e `renderReport`/`clearReport` sobrescrevem `reportTitle.textContent` com o título dinâmico do relatório (`report.title` ou o fallback "Relatório carregado"); reaproveitar o elemento apagaria a legenda da tabela.

Ao alterar `relatorios.js`, sempre conferir os `getElementById` contra os `id` existentes em `index.html` antes de assumir que o elemento existe.
