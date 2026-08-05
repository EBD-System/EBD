# Armadilha: tokens legados sem `id_cadastro` canônico

## Problema

Tokens antigos emitidos antes do endurecimento da autenticação podem depender do objeto `cadastro` ou de claims fora do formato canônico.

## Causa

O middleware passou a aceitar apenas `id_cadastro` explícito no JWT e o contexto autenticado deixou de usar fallback por sub-objeto legado.

## Solução

Forçar novo login para emitir um token atualizado com claims canônicas.


## Atualização

JWTs sem `id_cadastro` canônico também são rejeitados no middleware de autenticação.
