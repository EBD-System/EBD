# Resumo da chamada nas cards de classe

## Decisão
Os cards da tela de classes não exibem mais o ID da turma. Quando a classe já possui chamada feita, o front carrega em background o resumo da chamada via `GET /api/v1/attendance/classes/:classId/summary` com fallback para `GET /api/v1/classes/:classId/attendance/summary`, e exibe apenas as métricas no card, sem o título `Resumo da chamada` e sem o nome da classe. O campo `visitantes` do resumo é lido do backend junto com `oferta`, `biblias` e `revistas`, e o molde exibido segue:

`Matriculados: ...`

`Ausentes: ...`

`Presentes: ...`

`Visitantes: ...`

`Total: ...`

`Bíblias: ...`

`Revistas: ...`

`Ofertas: ...`

Valores nulos, vazios e zero são exibidos como `Não houve`. Se a chamada ainda não foi feita, o espaço do resumo fica vazio.

A tela de classes também passou a exibir um bloco de `Relatório Geral` no final da lista, usando `GET /api/v1/attendance/summary`, com ranking das 3 primeiras classes em presença via `GET /api/v1/reports/presence-ranking` e das 3 primeiras em ofertas via `GET /api/v1/reports/offers-ranking`. Esses rankings devem enviar a data de referência na query string e podem retornar as listas em `data.itens`/`itens`. O front só dispara esse bloco depois que identifica ao menos uma classe com chamada existente; quando ainda não houve chamada, a seção fica em estado de espera e não faz a consulta geral.

## Motivo
O ID da turma não deve competir visualmente com o contexto operacional do card. O resumo da chamada é mais útil para navegação e leitura rápida do status da turma. O relatório geral e os rankings dão contexto consolidado sem exigir troca de tela.

## Data
2026-08-01

## Atualização
A renderização assíncrona dos cards requer atualização explícita do DOM após o retorno da API; os estados `loading`, `ready` e `error` são aplicados por cartão.
Os rankings precisam considerar os nomes de campo `percentual_presenca` e `valor_oferta` como fontes principais de exibição.


A leitura do resumo também aceita `oferta`/`valor_oferta` além de `ofertas`, e o valor de oferta é exibido formatado em moeda BRL (`R$ 9,87`) tanto no card da classe quanto no relatório geral.