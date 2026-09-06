# Diálogo de acesso negado

## Regra
Quando uma tela protegida receber HTTP 403, o frontend deve usar o utilitário reutilizável `APP_ACCESS_DENIED_DIALOG` para ocultar a shell da página e abrir um diálogo específico de permissão.

## Aplicação
- o diálogo mostra somente a mensagem recebida do backend;
- o diálogo não exibe trace, stack nem botão de suporte;
- a ação principal do diálogo é o botão **Voltar**;
- o diálogo não pode ser fechado clicando fora nem com Escape;
- o corpo da página deve ser travado enquanto o diálogo estiver aberto, sem permitir rolagem, arrasto ou deslocamento visual do fundo;
- a shell da tela bloqueada deve ser ocultada para evitar que o usuário veja o módulo parcialmente carregado;
- o padrão pode ser reutilizado em outros módulos que precisem bloquear acesso por perfil.


## Atualização (2026-08-10 — relatórios financeiros)
O mesmo diálogo passou a ser reutilizado também nos submódulos de Relatórios quando o perfil `Financeiro` tenta acessar telas fora de `Financeiro`; nesses casos o botão **Voltar** deve levar de volta ao hub de Relatórios.
