# Decisão: middleware JWT valida a existência do usuário autenticado

## Decisão

Depois de validar assinatura, expiração e claims canônicas, o middleware de autenticação consulta o contexto do usuário autenticado e rejeita tokens cujo `id_usuario` não corresponda a um usuário existente.

## Motivo

Isso impede que tokens órfãos ou reaproveitados continuem acessando rotas protegidas quando o usuário já não existe no contexto persistido do sistema.

## Data

2026-07-17
