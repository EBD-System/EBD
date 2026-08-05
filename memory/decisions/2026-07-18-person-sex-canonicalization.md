# Decisão: sexo de pessoa normalizado entre API e banco

## Decisão

A API continua aceitando os valores de domínio `nao_informado`, `masculino`, `feminino` e `outro`, mas a persistência grava `M`, `F`, `outro` e `nao_informado` no banco. As respostas de pessoa voltam a representar `sexo` com os valores textuais da API.

## Motivo

Isso evita falha de constraint na tabela `ebd_pessoa`, mantém o contrato de entrada legível para a API e preserva a consistência das respostas sem alterar o SQL.

## Data

2026-07-18
