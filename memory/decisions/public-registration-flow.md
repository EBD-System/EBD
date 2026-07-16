# Fluxo de cadastro público

## Decisão

A interface pública de cadastro em `cadastro/` agora cria um tenant/cadastro antes de criar a pessoa e o usuário. O formulário envia `POST /auth/register` em JSON com `cadastro_nome` como campo preferencial para o nome do tenant, além dos dados da pessoa e do acesso.

## Motivo

O backend passou a exigir a criação do tenant como primeiro passo para garantir que o `id_cadastro` seja gerado antes de persistir `ebd_pessoa` e `ebd_usuario`.

## Data

2026-07-16
