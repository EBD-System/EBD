# Tenant transport nas requisições autenticadas

## Decisão
O frontend não deve depender do header customizado `x-cadastro-id` para identificar o tenant. As requisições autenticadas devem carregar o tenant em `id_cadastro` na query/body, enquanto o backend continua aceitando o JWT como fonte principal quando disponível.

## Motivo
O navegador bloqueia o envio de `x-cadastro-id` por CORS quando o backend não o declara explicitamente em `allowedHeaders`. O uso de `id_cadastro` em query/body preserva a compatibilidade com o backend atual e evita falhas silenciosas no carregamento de classes.

## Data
2026-07-16
