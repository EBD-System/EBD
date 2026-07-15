# Regra de cadastro

## Regra

O cadastro público deve enviar `action=register` ao backend e manter `nome`, `login` e `senha` como campos obrigatórios.

## Aplicação

A página pública `cadastro/` é a fonte de entrada para criar acesso no PostgreSQL, usando o mesmo tratamento de erro e a mesma exibição de feedback do restante da interface.
