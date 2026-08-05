# Total do relatório de período deve usar presentes + visitantes

## Problema
O card consolidado do relatório de período mostrava `Total` igual à base de matriculados/ativos da turma ou ao somatório de `total_alunos`, o que fazia o número ficar maior do que a quantidade real de pessoas presentes com visitantes.

## Causa
O frontend reaproveitava o campo `total_alunos` do snapshot como base do `Total`. Esse campo representa a base de matriculados/ativos e não o público efetivamente presente no dia.

## Solução
No módulo de Relatórios, o card `Total` deve ser calculado como `presentes + visitantes` (`presentes` já inclui `atrasado`). O campo `Matriculados` continua vindo de `total_alunos` apenas para exibição da base ativa da turma.

No `frontend/src/modules/relatorios/pages/relatorios.js`, função `buildTurmaCards` e fallback de `buildTotalReportCard`, usar a fórmula:

```js
const total = presentes + visitantes;
```

Não usar `matriculados + visitantes` nem `total_alunos` como fonte do `Total`.
