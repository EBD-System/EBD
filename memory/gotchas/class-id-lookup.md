# ID real da classe

## Problema
O front pode vincular o aluno à classe errada quando monta `classId` pela posição do cartão na lista.

## Causa
A API de classes deve ser lida pelo identificador primário real do banco (`id_classe`). Índice visual da lista não representa a chave da tabela.

## Solução
Sempre extrair `classId` de `id_classe` (ou alias compatível da API) e rejeitar fallback por ordem/posição quando o identificador não existir.

## Observação adicional
No fluxo de chamada, `classId` deve ser tratado como identificador opaco de texto. Não converter com `Number()` nem validar por finitude numérica, porque isso rejeita IDs válidos quando o backend usa identificadores não numéricos ou stringificados.

