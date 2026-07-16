# Regra de cadastro

## Regra

O cadastro público deve enviar `POST /auth/register` em JSON, manter `nome`, `login` e `senha` como campos obrigatórios da pessoa/acesso e enviar o nome do tenant em `cadastro_nome` (aceitando aliases legados como `cadastroNome`, `tenant_nome`, `tenantNome`, `nome_cadastro` e `nomeCadastro`).

## Aplicação

A página pública `cadastro/` é a fonte de entrada para criar o tenant e o acesso via backend, usando os campos de pessoa e acesso esperados pela API e reaproveitando o mesmo tratamento de erro e a mesma exibição de feedback do restante da interface.
