# PDF de relatórios não deve ler o DOM

## Problema
Montar o PDF diretamente a partir da tela pode capturar estados transitórios, textos de ajuda, placeholders e variações visuais que não representam a fonte de dados real.

## Causa
A interface de Relatórios é apenas a camada de consulta e exibição. O conteúdo visual não deve virar a fonte canônica do documento.

## Solução
O PDF do módulo de Relatórios deve ser montado a partir do snapshot preservado após a consulta. O fluxo atual baixa o arquivo diretamente, sem pré-visualização em `iframe`, e continua proibindo a leitura do DOM como fonte de dados. Se o layout principal do PDF falhar, o frontend gera um PDF alternativo a partir do mesmo snapshot e baixa esse arquivo em vez de reconstruir o relatório pela tela.

## Atualização (cards por turma)
A visualização agora é composta por cards por turma e um card total; o PDF deve refletir esse snapshot consolidado. Se o layout principal falhar, o fallback também precisa sair do mesmo snapshot, sem tentar ler o DOM da tela.
