# Acesso aos módulos de Relatórios por perfil

## Regra
- `Financeiro` acessa somente o submódulo `Financeiro` dentro de Relatórios.
- `Secretaria` vê o módulo principal `Relatórios`, mas não pode entrar nele; ao clicar, o backend responde `403` e o frontend abre `APP_ACCESS_DENIED_DIALOG`.
- Os demais perfis seguem a permissão definida no backend.

## Aplicação
- O dashboard mantém o card principal `Relatórios` visível para `Secretaria`.
- A página principal de Relatórios valida o acesso em `GET /api/v1/reports/access` antes de exibir a vitrine.
- O bloqueio do frontend usa `APP_ACCESS_DENIED_DIALOG` quando recebe HTTP 403.
- `Financeiro` continua vendo somente o card `Financeiro` no hub de Relatórios.
- A proteção do frontend não substitui a autorização do backend.
