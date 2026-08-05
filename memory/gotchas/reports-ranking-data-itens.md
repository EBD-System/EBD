# Rankings de relatório retornam `data.itens`

## Problema
A seção de rankings da tela de classes pode aparecer vazia mesmo com a API respondendo com sucesso.

## Causa
O endpoint de ranking pode devolver a lista dentro de `data.itens`/`itens`, e não apenas em `items`. Além disso, a consulta precisa receber a data de referência na query string para retornar o recorte esperado.

## Solução
Ao consumir `GET /api/v1/reports/presence-ranking` e `GET /api/v1/reports/offers-ranking`, enviar `date=YYYY-MM-DD` e aceitar `data.itens`, `itens` e variações equivalentes no parser.

END
