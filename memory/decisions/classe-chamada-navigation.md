# Navegação da classe para a chamada

## Decisão
Ao clicar em uma classe no módulo de classes, o front deve navegar para `src/modules/chamada/pages/index.html` e transportar o contexto da seleção via query string (`classId` e `className`).

## Motivo
Isso mantém o fluxo 100% estático, sem depender de endpoint novo ou estado compartilhado adicional, e permite abrir a tela de chamada já contextualizada com a classe clicada.

## Observação operacional
O `classId` transportado na query string deve vir do identificador real da classe no banco (`id_classe`), não da posição do cartão na lista.

## Data
2026-07-21
