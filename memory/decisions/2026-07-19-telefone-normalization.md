# Decisão: telefone de pessoa normalizado para dígitos antes da persistência

## Decisão

O backend remove tudo que não for dígito do campo `telefone` na entrada e também reaplica a mesma normalização nos repositórios de pessoa e auth antes de gravar no banco. A validação de entrada aceita no máximo 11 dígitos após a limpeza.

## Motivo

A tabela `ebd_pessoa` impõe a constraint `^[0-9]{0,11}$`. Normalizar na borda evita rejeição do banco quando o usuário envia telefone com máscara comum e mantém a persistência compatível com o armazenamento esperado.

## Data

2026-07-19
