Sessão 2026-08-13

O que foi alterado

- Refinado o layout responsivo da tela de login para eliminar o espaçamento excessivo entre a frase e o card.
- A logo foi posicionada mais no canto superior da área de identidade e mantida ligeiramente menor, com distância moderada até a frase.
- O ajuste permaneceu restrito ao CSS da tela de login.

Conhecimento consolidado

- Em telas estreitas, o espaçamento entre a frase e o card deve ser mínimo; a identidade visual deve ocupar apenas o espaço necessário antes do formulário.

## Atualização 2026-08-13 — mensagens progressivas no carregamento do login

O overlay de login agora alterna mensagens de progresso enquanto aguarda a resposta do endpoint de autenticação, evitando o texto genérico `Aguarde...` durante respostas lentas.

As mensagens são deliberadamente neutras sobre etapas do backend: conexão, consulta ao servidor, espera de resposta e preparação do acesso. A confirmação de credenciais só aparece depois que a resposta de autenticação é aceita pelo frontend.

Quando a autenticação falha com `401` (ou com payload explicitamente indicando credencial inválida), o frontend mostra `Usuário ou senha inválidos.` em vez da mensagem genérica de sessão expirada.

O timer das mensagens é cancelado ao entrar em sucesso, erro ou ocultar o overlay.

## Atualização — duração variável do carregamento

O overlay de autenticação passou a usar timers individuais por mensagem, variando entre 3,2 e 5 segundos. A etapa de espera da resposta recebe o maior tempo; etapas de verificação, preparação e finalização recebem tempos menores. O fluxo continua sendo interrompido imediatamente quando a autenticação responde.
