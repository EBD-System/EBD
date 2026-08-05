# Fonte de dados

## Decisão

O Google Sheets continua sendo a fonte oficial do sistema.

## Motivo

A interface web consome o backend em Apps Script, que centraliza a leitura e a escrita dos dados.

## Observação

O navegador não vira a fonte oficial, mas mantém snapshots locais das chamadas já salvas para recuperação rápida e busca por data.

Os relatórios em PDF devem ser gerados a partir do texto oficial retornado pelo backend (`action=reporttext`), sempre com a planilha como origem dos dados. O snapshot local continua apenas como contingência de navegação e recuperação.
