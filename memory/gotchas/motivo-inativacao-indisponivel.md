# Motivo da inativação pode vir de múltiplas fontes

## Problema
Na aba de alunos inativos, o front pode não conseguir exibir o motivo da inativação com consistência.

## Causa
O backend pode informar a razão no próprio payload da listagem, em campos como `inactive_reason` ou `motivo_desligamento`, ou em lote via `GET /students/inactive-reasons?ids=...`. Quando isso ainda não vier completo, o histórico de status continua sendo o fallback.

## Solução
- Ler `inactive_reason`, `motivo_desligamento`, `motivo`, `observacao`, `justificativa`, `reason` e campos equivalentes quando existirem;
- consultar `GET /students/inactive-reasons?ids=...` para buscar os motivos em lote dos alunos inativos visíveis;
- consultar `GET /students/:id/status-history` apenas como fallback quando o lote não devolver o motivo;
- quando a API não devolver o dado, mostrar um fallback textual no card e evitar inventar o motivo.
