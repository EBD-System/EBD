# Decisão: perfis canônicos e permissões centralizadas

## Decisão

A API passou a tratar perfis de acesso por nomes canônicos (`Administrador`, `Secretaria`, `Professor`, `Financeiro`, `Consulta`) e a validar permissões por conjuntos centralizados em código. Perfis legados ou variantes textuais são normalizados antes da autorização.

## Motivo

Isso evita divergência entre banco, token JWT e regras de rota, reduz erro de comparação por capitalização/acentuação e mantém bloqueio consistente das rotas administrativas.

## Data

2026-07-17
