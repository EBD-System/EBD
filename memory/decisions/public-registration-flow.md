# Fluxo de cadastro público

## Decisão

A interface passou a oferecer uma página pública de cadastro em `cadastro/`, separada do shell autenticado. O formulário coleta os dados da pessoa e do acesso e envia o payload ao backend pelo contrato HTTP atual.

## Motivo

O cadastro de novo acesso não deve depender da sessão interna da aplicação. Uma página pública reduz fricção e preserva a navegação principal.

## Data

2026-07-15
