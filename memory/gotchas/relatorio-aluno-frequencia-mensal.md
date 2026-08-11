# Frequência mensal do Relatório do Aluno

## Correção 2026-08-11 — resposta individual incompleta

**Problema:** o endpoint `reports/student-report` pode retornar um resumo com dados de presença, mas sem `meses` ou com uma série incompleta. Gerar o PDF diretamente desse payload deixa a tabela `Frequência por mês` vazia ou incompleta.

**Solução:** quando a resposta individual vier sem série mensal, o frontend tenta reconstruir o relatório usando o detalhamento de `reports/period/pdf`. O fallback deve substituir tanto `resumo` quanto `meses` quando encontrar dados.

**Regra adicional:** a reconstrução mensal deve partir do intervalo informado e gerar uma linha para cada mês, inclusive meses sem chamadas, com métricas zeradas. Para um período contido em um único mês, caso o detalhamento também não tenha linhas, o resumo do período pode preencher essa única linha mensal porque todo o intervalo pertence ao mesmo mês.

**Regra de identificação:** quando uma linha do detalhamento contém `id_aluno`, esse identificador é a fonte principal para reconhecer o aluno; o `classId` selecionado pela interface não deve impedir o fallback de recuperar uma presença já identificada pelo aluno.
