# Validação de entrada nas rotas

## Decisão
A API valida `params`, `query` e `body` nas rotas, antes de chamar os services. Os services continuam responsáveis por regras de negócio e por verificações dependentes de banco.

## Motivo
Isso bloqueia payloads inválidos mais cedo, reduz carga nos services e padroniza a entrada já normalizada para o restante da aplicação.

## Data
2026-07-17

## Complemento
Erros de parse de JSON na camada HTTP também são tratados como 400 de validação, com resposta padronizada antes de chegar aos services.
