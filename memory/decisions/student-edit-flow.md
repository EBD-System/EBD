# Edição de aluno em página dedicada

## Decisão

A edição de aluno acontece em uma página própria em `aluno/editar-aluno/`, aberta a partir do botão **Editar**. O identificador exibido após `#` permanece visível e somente leitura. O salvamento usa a rota `updatealuno` do Apps Script com fallback de query string para garantir compatibilidade no GitHub Pages.

## Motivo

O fluxo funciona melhor no GitHub Pages, evita depender de modal em tela pequena e deixa a edição mais estável em uma rota direta.

## Data
2026-07-11
