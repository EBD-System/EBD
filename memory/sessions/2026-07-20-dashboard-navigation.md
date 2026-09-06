# Sessão 2026-07-20 — Dashboard de navegação

## O que foi alterado
O dashboard foi simplificado para remover o bloco introdutório longo e manter apenas a navegação principal. O módulo de classes passou a buscar os registros na API e exibir um diálogo informativo ao clicar em qualquer classe.

## Conhecimento consolidado
- O dashboard deve permanecer enxuto e funcionar apenas como hub de navegação.
- A listagem de classes vem do endpoint autenticado `GET /api/v1/classes`.
- Clique em classe, por enquanto, não dispara fluxo de negócio; apenas abre a mensagem `classe X clicada`.
- O logout do dashboard deve limpar a `sessionStorage` e devolver o usuário para a tela de login.
- A página do dashboard deve bloquear acesso sem token válido.

## Próximos passos
Manter a tela de classes pronta para receber o fluxo definitivo de seleção quando ele for definido.
