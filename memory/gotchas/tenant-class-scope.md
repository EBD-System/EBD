# Classes vazias por tenant ausente

## Problema
As telas de turma, cadastro de aluno e edição de aluno podem carregar uma lista vazia de classes mesmo com dados existentes no backend.

## Causa
As consultas de classe passaram a ser tenant-scoped. Quando a requisição não leva o `id_cadastro` correto, o backend não deve expor classes de outro cadastro.

## Solução
Garantir que a sessão autenticada carregue `idCadastro`/`id_cadastro` e que a camada central de requisições envie o tenant em `id_cadastro` na query/body das chamadas autenticadas. O shell principal também deve hidratar a sessão salva no bootstrap, antes da primeira carga de turmas, para que o tenant exista já na inicialização. Durante a migração, `GET /api/classes` também pode receber `id_cadastro` por compatibilidade.


## CORS e tenant-id

### Problema
O navegador bloqueia as requisições quando o frontend tenta enviar `x-cadastro-id`.

### Causa
A configuração de CORS do backend libera `Authorization` e `Content-Type`, mas não libera o header customizado `x-cadastro-id`.

### Solução
O frontend deve colocar o tenant em `id_cadastro` na query/body das requisições autenticadas e deixar o Bearer token seguir normalmente. O backend já aceita essa compatibilidade.
