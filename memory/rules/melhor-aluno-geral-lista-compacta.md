# Lista compacta do Melhor Aluno Geral

## Regra
O submódulo **Melhor Aluno Geral** está temporariamente desativado e deve permanecer oculto no hub do frontend. Os arquivos e a implementação ficam preservados para futura reativação.

A coluna `%` representa a presença do aluno. Se a origem não trouxer o símbolo, o cabeçalho deve usar exatamente `%`.

## Aplicação
O hub `src/modules/relatorios/pages/index.html` não deve exibir o card do submódulo. O acesso direto à página também não deve executar o ranking enquanto a desativação estiver vigente.

## Reativação futura
Ao reativar o módulo, preservar a estrutura compacta de três colunas `Nome`, `Classe` e `%` e o consumo do ranking autenticado do backend.
