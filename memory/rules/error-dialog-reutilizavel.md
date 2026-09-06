# Diálogo de erro reutilizável

## Regra
Erros de carregamento relevantes devem usar um diálogo reutilizável centralizado (`APP_ERROR_DIALOG`) com as ações **Cancelar** e **Suporte**.

## Aplicação
- O botão **Cancelar** apenas fecha o diálogo e não dispara contato externo;
- o botão **Suporte** abre o WhatsApp do número `71981768164` com o trace do erro na mensagem;
- o diálogo deve ser carregado como utilitário compartilhado para poder ser reutilizado em outras telas;
- o texto principal padrão é: `Houve um erro. Fale com o suporte para corrigir.`
