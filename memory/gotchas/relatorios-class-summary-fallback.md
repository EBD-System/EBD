# Cards de relatório dependem do resumo da classe

## Problema
O painel de Relatórios precisa exibir cards completos por turma, mas o payload de período não traz todos os campos necessários (principalmente `Matriculados`, `Bíblias` e `Revistas`).

## Causa
O endpoint de período entrega as atividades agrupáveis por turma, porém o resumo completo vem do endpoint de resumo da classe.

## Solução
O frontend deve usar o período apenas para identificar as turmas e a data mais recente de cada grupo. Em seguida, deve consultar o resumo da classe com fallback entre:
- `GET /attendance/classes/:classId/summary?date=YYYY-MM-DD`
- `GET /classes/:classId/attendance/summary?date=YYYY-MM-DD`

Se o resumo da classe falhar, o card deve cair para o agregado local do grupo, e o PDF precisa manter o fallback de geração sem bloquear o download.
