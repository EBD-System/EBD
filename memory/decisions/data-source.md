# Fonte de dados

## Decisão

O Google Sheets continua sendo a fonte oficial do sistema. Relatórios, PDFs e textos de compartilhamento devem ser gerados sempre a partir de uma leitura fresca do Apps Script.

## Motivo

A interface web consome o backend em Apps Script, que centraliza a leitura e a escrita dos dados. Quando o relatório usa o navegador como origem, snapshots locais podem divergir do estado real da planilha.

## Observação

O navegador não vira a fonte oficial. Ele mantém snapshots locais apenas para rascunhos e recuperação rápida; a geração de relatório deve consultar o Apps Script diretamente.
