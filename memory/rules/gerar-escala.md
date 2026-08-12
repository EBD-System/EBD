# Regra: acesso e navegação do Gerar escala

## Regra
O módulo **Gerar escala** deve aparecer no dashboard como o segundo módulo visível, imediatamente abaixo de **Classes** e antes de **Relatórios**, e ficar disponível para todos os perfis que entram no dashboard.

O botão **Voltar** do módulo deve usar o mesmo padrão de navegação do hub de Relatórios, apontando para `../dashboard/pages/home/index.html` a partir de `src/modules/gerar-escala/index.html`.

Os quatro nomes iniciais exibidos no módulo são exemplos e devem permanecer identificados como:
- João (Exemplo)
- Maria (Exemplo)
- Pedro (Exemplo)
- Ana (Exemplo)

## Aplicação
- A navegação do dashboard usa `alwaysVisible: true` no item **Gerar escala**.
- A posição do item na lista é imediatamente após **Classes** e antes de **Relatórios**.
- O módulo continua sendo uma página estática e não recebe restrição de perfil própria.
- A lógica de geração da escala permanece no `script.js` do módulo.
- O link de retorno usa `../dashboard/pages/home/index.html`.
- A lista inicial de participantes usa os quatro nomes com o sufixo `(Exemplo)`.

## Data
2026-08-12
