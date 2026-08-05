# Regras de logging

## Regra

Logs da API devem ser estruturados e rastreáveis.

## Aplicação

Toda requisição recebe um `request_id`, exposto também em `X-Request-Id`, para permitir correlação entre logs e respostas.

## Regra

Logs não devem expor dados sensíveis.

## Aplicação

Não registrar senha, token, `authorization`, `senha_hash` nem corpo completo de requisições.

## Regra

A API deve registrar apenas eventos úteis para produção.

## Aplicação

Registrar falhas relevantes, autenticação, matrícula, abertura/fechamento/alteração de chamada e criação/atualização de pessoas; evitar logs de listagem e consulta comum.

## Regra

Erros de cliente e servidor devem ser separados no nível de log.

## Aplicação

Falhas 4xx devem entrar como `warn` e falhas 5xx como `error`.
