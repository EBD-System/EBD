# Extrato financeiro exige metadados de paginação

## Problema
Ao gerar o PDF do extrato financeiro, o rodapé pode quebrar com erro de leitura de `pageNumber` quando a função de desenho da página recebe apenas o conteúdo da página e não recebe também o objeto de metadados.

## Causa
A renderização do PDF usa `pageNumber` e `totalPages` no rodapé. Se o `meta` não for passado junto com a página, o desenho tenta ler `pageNumber` de `undefined`.

## Solução
`buildFinancePdf(...)` deve chamar o renderer com dois argumentos: a página e um objeto `meta` contendo `pageNumber` e `totalPages`. O renderer também deve manter fallback seguro (`meta = {}`) para evitar regressão.
