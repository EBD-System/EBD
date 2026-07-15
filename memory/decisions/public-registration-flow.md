# Fluxo de cadastro público

## Decisão

A interface passou a oferecer uma página pública de cadastro em `cadastro/`, separada do shell autenticado. O formulário coleta os dados da pessoa e do acesso e envia `POST /auth/register` em JSON ao backend.

## Motivo

O cadastro de novo acesso não deve depender da sessão interna da aplicação. Uma página pública reduz fricção e preserva a navegação principal, enquanto o backend centraliza a criação do usuário.

## Data

2026-07-15
