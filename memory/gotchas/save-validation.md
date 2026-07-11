# Armadilha: salvamento bloqueado

Se houver aluno sem presença, ausência ou atraso marcado, o backend rejeita o envio.

## Efeito

A chamada não é tratada como concluída até que cada linha esteja preenchida.


## Observação adicional

As chamadas ao Apps Script devem sair com `action` em minúsculas. O cliente agora normaliza esse campo antes de enviar, para evitar rejeição por diferença de caixa entre deploys antigos e novos.
