# Armadilha: hashes de senha do dump de exemplo

## Problema

O dump de exemplo traz valores de `senha_hash` com aparência de bcrypt, mas eles podem ser apenas placeholders de carga inicial.

## Causa

O banco de demonstração foi montado para estrutura e dados, não para autenticação real.

## Solução

Em ambiente real, use hashes bcrypt válidos no cadastro de usuários antes de testar o login.
