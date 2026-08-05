# Visibilidade do relatório depende do atributo e da classe `.hidden`

## Problema
A área de resultado e a pré-visualização do PDF podiam continuar invisíveis mesmo após a busca ou o envio concluírem com sucesso.

## Causa
O HTML do módulo carregava `class="hidden"` em `#reportContent` e `#pdfPreviewSection`. No JS, apenas `element.hidden = false` era alternado, o que não removia a regra `display: none !important` da classe.

## Solução
Ao mostrar ou ocultar essas seções, sincronizar `hidden` e `classList.toggle('hidden', ...)` no mesmo helper. Também é válido remover a classe do HTML inicial e manter só o atributo `hidden`.
