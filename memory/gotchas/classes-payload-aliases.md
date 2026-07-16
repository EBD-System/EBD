# Classes sem turmas visíveis

## Problema
A tela de chamada ou de cadastro pode mostrar `Nenhuma turma cadastrada` mesmo com classes existentes no backend.

## Causa
A API de classes pode devolver registros usando o schema do PostgreSQL (`id_classe`, `nome`) ou em formatos `classes`/`turmas`/`data`.

## Solução
Normalizar a resposta no frontend para `TurmaID` e `Nome`, e usar `GET /api/classes` com Bearer como fallback quando o `init` não trouxer turmas válidas.
