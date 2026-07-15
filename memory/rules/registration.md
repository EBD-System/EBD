# Regra de cadastro

## Regra

O cadastro público deve enviar `POST /auth/register` em JSON e manter `nome`, `login` e `senha` como campos obrigatórios.

## Aplicação

A página pública `cadastro/` é a fonte de entrada para criar acesso no PostgreSQL, usando os campos de pessoa e acesso esperados pelo backend e reaproveitando o mesmo tratamento de erro e a mesma exibição de feedback do restante da interface.
