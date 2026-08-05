# Escopo de tenant nas rotas autenticadas

## Problema
Se o JWT não trouxer `id_cadastro`, a API não consegue inferir com segurança qual cadastro deve ser exibido nas rotas autenticadas.

## Causa
A base foi endurecida para tratar o JWT como fonte de verdade do tenant. Entradas de tenant pelo frontend deixaram de ser aceitas para consultas e mutações sensíveis.

## Solução
Garantir que o login preencha `id_cadastro` no token quando o schema permitir. As rotas autenticadas devem recusar acesso sensível quando o tenant não estiver presente no contexto autenticado.
