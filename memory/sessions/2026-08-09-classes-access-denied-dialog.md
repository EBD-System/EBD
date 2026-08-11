# Sessão 2026-08-09

## O que foi alterado
- O diálogo de acesso negado da tela de classes foi simplificado para exibir apenas a mensagem do backend.
- Foi removida a exibição de trace/stack e de ações de suporte no bloqueio de permissão.
- O utilitário `APP_ACCESS_DENIED_DIALOG` passou a ser um diálogo específico de permissão com botão **Voltar**.
- O diálogo também bloqueia fechamento por clique fora e pela tecla Escape, mantendo a saída restrita ao botão.
- O fundo da página agora fica travado enquanto o modal está aberto, eliminando a sensação de rolagem ou arrasto por trás do bloqueio.
- A tela de classes continua ocultando a shell quando recebe HTTP 403.

## Conhecimento consolidado
- Bloqueios por permissão no frontend devem usar `APP_ACCESS_DENIED_DIALOG`.
- O diálogo de permissão reutilizável é a interface padrão para mensagens de 403 vindas do backend.
- O fluxo de acesso negado não deve expor trace, stack ou botão de suporte ao usuário final.

## Próximos passos
- Reaplicar o mesmo utilitário em outras telas protegidas quando surgirem novas regras por perfil.

