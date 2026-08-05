# Regras da API

## Regra

Toda comunicação HTTP deve usar JSON.

## Aplicação

As rotas retornam envelopes padronizados com `ok`, `message` e `data` nas respostas de sucesso, ou `ok`, `message` e `error` nas respostas de erro.

## Regra

Respostas de sucesso e erro devem usar um contrato único em toda a API.

## Aplicação

Sucesso retorna `ok: true` com `message` claro e `data` quando houver conteúdo útil. Erro retorna `ok: false` com `message` claro e `error.stage`/`error.statusCode`, enquanto o status HTTP continua vindo do tipo da falha.

## Regra

O frontend não pode acessar o banco diretamente.

## Aplicação

Toda integração passa pela `DATABASE_URL` configurada no Render.

## Regra

A API não mantém mais ponte de compatibilidade para o frontend legado baseada em `action`/`acao`.

## Aplicação

A interface oficial deve consumir apenas as rotas canônicas da API.

## Regra

CORS deve ser restrito às origens permitidas.

## Aplicação

A lista de origens vem de `CORS_ORIGINS`.

## Regra

A chamada só pode ser alterada enquanto estiver aberta e dentro da data permitida pelo banco.

## Aplicação

As operações de presença, visitantes e ofertas dependem da regra de negócio do PostgreSQL.

## Regra

Autorização deve ser baseada em perfis canônicos.

## Aplicação

O token JWT carrega perfis normalizados e as rotas críticas validam `Administrador`, `Secretaria`, `Professor`, `Financeiro` ou `Consulta` conforme necessário.

## Regra

Rotas administrativas devem ser bloqueadas por perfil.

## Aplicação

A API deve centralizar conjuntos de permissões e negar mutações administrativas para perfis inadequados.

## Regra

A API não expõe mais mutações públicas sem autenticação.

## Aplicação

Não existe mais `POST /auth/register`; mutações sensíveis devem exigir token JWT.

## Regra

Listagens e consultas de classes devem ser sempre escopadas por `id_cadastro`.

## Aplicação

`GET /classes`, `GET /classes/:id`, `GET /classes/:id/students` e `GET /classes/:id/attendance` usam o tenant da requisição para evitar retorno entre cadastros.

## Regra

As listagens e consultas de pessoas e alunos devem ser sempre escopadas por `id_cadastro`.

## Aplicação

`GET /people`, `GET /students` e os detalhes/históricos relacionados só retornam registros do tenant resolvido na requisição.

## Regra

Nas rotas autenticadas, o tenant oficial vem do JWT.

## Aplicação

`id_cadastro` não deve ser lido de `query`, `body`, headers ou sub-objetos legados de cadastro enviados pelo frontend em pessoas, alunos, classes, chamadas e relatórios.

## Regra

Relatórios e chamadas não devem confiar em funções do banco sem filtro de tenant.

## Aplicação

Quando a lógica da função SQL não aceitar tenant explicitamente, a API deve aplicar o filtro por `id_cadastro` antes de expor o resultado.


## Regra

A alteração de status da chamada deve persistir também a observação informada na mesma mutação.

## Aplicação

O endpoint `PATCH /attendance/:callId/students/:studentClassId` grava `status` e `observacao` juntos em transação, sem depender da função do banco para salvar o texto da presença.

## Regra

Relatórios e resumos agregados devem ser sempre escopados por `id_cadastro`.

## Aplicação

As consultas de presença, visitantes, ofertas, aniversariantes e resumos de chamada usam o tenant resolvido no JWT, nunca um tenant enviado pelo cliente ou uma função global do banco.

## Regra

Nos resumos e rankings de presença, alunos com status `atrasado` contam como `presentes`.

## Aplicação

As consultas de `attendance/summary`, `attendance/classes/:classId/summary` e `reports/presence-ranking` somam `presente` + `atrasado` no campo `presentes`, mantendo `atrasados` apenas como contagem auxiliar quando houver coluna separada.


## Regra

O retorno oficial dos relatórios deve seguir um envelope padronizado.

## Aplicação

Os serviços de relatórios devolvem `relatorio`, `id_cadastro`, `data_referencia`, `total_itens` e `itens`, para evitar formatos diferentes entre rankings e aniversariantes.

