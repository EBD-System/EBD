# Regra: telefone de pessoa sempre persistido como dígitos

## Regra

Antes de salvar ou atualizar `telefone` de pessoa, o backend deve remover qualquer caractere que não seja dígito. A validação de entrada deve rejeitar valores com mais de 11 dígitos após a normalização.

## Aplicação

Vale para os fluxos de criação e atualização de pessoa, inclusive quando o mesmo payload é usado pelo fluxo de cadastro em `auth`.
