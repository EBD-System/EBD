# ebd-api

API Node.js para servir a aplicação EBD usando PostgreSQL no Neon.

## Stack

- Node.js
- Express
- PostgreSQL
- pg
- JWT para autenticação
- bcryptjs para validação de senha

## Estrutura

- `server.js` — ponto de entrada do processo
- `src/routes/v1` — superfície oficial de rotas da API
- `src/modules` — módulos canônicos do backend, cada um com controller, service, repository, routes e validator
- `src/middlewares` — autenticação, validação e tratamento de erro
- `memory/` — conhecimento consolidado do projeto

## Variáveis de ambiente

Crie um `.env` com base em `.env.example`.

- `DATABASE_URL` — string do Neon
- `JWT_SECRET` — segredo dos tokens
- `CORS_ORIGINS` — origens permitidas, separadas por vírgula

## Deploy no Render

O projeto já está preparado para:

- build: `npm install`
- start: `node server.js`

## Rotas oficiais

A documentação mínima completa das rotas, payloads, respostas, permissões e regras de tenant está em `docs/api-minima.md`.

### Superfície oficial

A API ativa expõe somente `/api/v1`. As rotas antigas em `/api` e `/` foram removidas.

## Observação importante

O dump `ebd_neon.sql` incluído no projeto é apenas referência do schema atual. A API usa `DATABASE_URL` e não depende do frontend para falar com o banco.

## Observação sobre mutações

As mutações protegidas exigem autenticação JWT e, quando aplicável, validação por perfil.

## Escopo multi-tenant

Nas rotas autenticadas, o `id_cadastro` passa a ser resolvido do JWT e não deve depender de `query`, `body` ou headers enviados pelo frontend. Pessoas, alunos, classes, chamadas e relatórios devem permanecer escopados ao tenant do token.


Segue um guia copiável para testar o backend com curl.

Base URL local

http://localhost:3000/api/v1

Base URL de produção

https://ebd-fj9u.onrender.com/api/v1

1) Autenticação: faça o login primeiro

Sem token, quase tudo vai retornar 401.

curl -X POST "http://localhost:3000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "login": "SEU_LOGIN",
    "senha": "SUA_SENHA"
  }'

Depois de logar, use:

TOKEN="COLE_AQUI_O_JWT"


---

2) Modelo base de curl por método

GET

curl -X GET "http://localhost:3000/api/v1/ENDPOINT" \
  -H "Authorization: Bearer $TOKEN"

POST

curl -X POST "http://localhost:3000/api/v1/ENDPOINT" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'

PUT

curl -X PUT "http://localhost:3000/api/v1/ENDPOINT" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'

PATCH

curl -X PATCH "http://localhost:3000/api/v1/ENDPOINT" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'

DELETE

curl -X DELETE "http://localhost:3000/api/v1/ENDPOINT" \
  -H "Authorization: Bearer $TOKEN"

Observação importante: no backend atual não existe nenhum endpoint DELETE. Se você quiser, eu monto um DELETE genérico para quando você criar essa rota depois.


---

3) Health do backend

GET /api/v1/health

curl -X GET "http://localhost:3000/api/v1/health"

GET /api/v1/

Esse também responde health, porque a rota de saúde está montada na raiz da versão v1.

curl -X GET "http://localhost:3000/api/v1/"


---

4) Endpoints existentes, separados por método

GET

Auth

curl -X GET "http://localhost:3000/api/v1/auth/me" \
  -H "Authorization: Bearer $TOKEN"

Pessoas

curl -X GET "http://localhost:3000/api/v1/people?page=1&limit=50&search=Maria" \
  -H "Authorization: Bearer $TOKEN"

curl -X GET "http://localhost:3000/api/v1/people/1" \
  -H "Authorization: Bearer $TOKEN"

Classes

curl -X GET "http://localhost:3000/api/v1/classes?date=2026-07-19" \
  -H "Authorization: Bearer $TOKEN"

curl -X GET "http://localhost:3000/api/v1/classes/1" \
  -H "Authorization: Bearer $TOKEN"

curl -X GET "http://localhost:3000/api/v1/classes/1/students" \
  -H "Authorization: Bearer $TOKEN"

curl -X GET "http://localhost:3000/api/v1/classes/1/attendance?date=2026-07-19" \
  -H "Authorization: Bearer $TOKEN"

Alunos

curl -X GET "http://localhost:3000/api/v1/students?classId=1&status=ativo" \
  -H "Authorization: Bearer $TOKEN"

curl -X GET "http://localhost:3000/api/v1/students/inactive" \
  -H "Authorization: Bearer $TOKEN"

curl -X GET "http://localhost:3000/api/v1/students/1" \
  -H "Authorization: Bearer $TOKEN"

curl -X GET "http://localhost:3000/api/v1/students/1/history" \
  -H "Authorization: Bearer $TOKEN"

curl -X GET "http://localhost:3000/api/v1/students/1/status-history" \
  -H "Authorization: Bearer $TOKEN"

curl -X GET "http://localhost:3000/api/v1/students/1/classes" \
  -H "Authorization: Bearer $TOKEN"

Chamadas

curl -X GET "http://localhost:3000/api/v1/attendance/summary?date=2026-07-19" \
  -H "Authorization: Bearer $TOKEN"

curl -X GET "http://localhost:3000/api/v1/attendance/classes/1?date=2026-07-19" \
  -H "Authorization: Bearer $TOKEN"

curl -X GET "http://localhost:3000/api/v1/attendance/classes/1/summary?date=2026-07-19" \
  -H "Authorization: Bearer $TOKEN"

Relatórios

curl -X GET "http://localhost:3000/api/v1/reports/presence-ranking?date=2026-07-19" \
  -H "Authorization: Bearer $TOKEN"

curl -X GET "http://localhost:3000/api/v1/reports/visitors-ranking?date=2026-07-19" \
  -H "Authorization: Bearer $TOKEN"

curl -X GET "http://localhost:3000/api/v1/reports/offers-ranking?date=2026-07-19" \
  -H "Authorization: Bearer $TOKEN"

curl -X GET "http://localhost:3000/api/v1/reports/birthdays?date=2026-07-19" \
  -H "Authorization: Bearer $TOKEN"


---

POST

Auth

curl -X POST "http://localhost:3000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "login": "SEU_LOGIN",
    "senha": "SUA_SENHA"
  }'

Pessoas

curl -X POST "http://localhost:3000/api/v1/people" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Maria Silva",
    "sexo": "feminino",
    "cpf": "00000000000",
    "data_nascimento": "2000-01-01",
    "telefone": "81999999999",
    "email": "maria@exemplo.com",
    "logradouro": "Rua A",
    "numero": "10",
    "bairro": "Centro",
    "cidade": "Recife",
    "uf": "PE",
    "cep": "50000000",
    "observacao": "Texto livre"
  }'

Alunos

curl -X POST "http://localhost:3000/api/v1/students/enroll" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "idPessoa": 1,
    "idClasse": 2,
    "matricula": "2026-001",
    "dataInicio": "2026-07-19",
    "observacao": "Matrícula inicial"
  }'

A resposta do endpoint de matrícula agora inclui o aluno já enriquecido com o vínculo da classe (`id_aluno_classe`) e os campos principais do cadastro, sem remover `id_aluno`.

Chamadas

curl -X POST "http://localhost:3000/api/v1/attendance/open" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "classId": 1,
    "date": "2026-07-19"
  }'

curl -X POST "http://localhost:3000/api/v1/attendance/1/present-all" \
  -H "Authorization: Bearer $TOKEN"

curl -X POST "http://localhost:3000/api/v1/attendance/1/absent-all" \
  -H "Authorization: Bearer $TOKEN"

curl -X POST "http://localhost:3000/api/v1/attendance/1/close" \
  -H "Authorization: Bearer $TOKEN"

curl -X POST "http://localhost:3000/api/v1/attendance/1/reopen" \
  -H "Authorization: Bearer $TOKEN"

curl -X POST "http://localhost:3000/api/v1/attendance/1/visitors" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Visitante",
    "observation": "Chegou com a turma"
  }'

curl -X POST "http://localhost:3000/api/v1/attendance/1/offers" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "value": 25
  }'


---

PUT

Pessoas

curl -X PUT "http://localhost:3000/api/v1/people/1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Maria Silva",
    "sexo": "feminino",
    "cpf": "00000000000",
    "data_nascimento": "2000-01-01",
    "telefone": "81999999999",
    "email": "maria@exemplo.com",
    "logradouro": "Rua A",
    "numero": "10",
    "bairro": "Centro",
    "cidade": "Recife",
    "uf": "PE",
    "cep": "50000000",
    "observacao": "Atualização do cadastro"
  }'

Alunos

curl -X PUT "http://localhost:3000/api/v1/students/1/activate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "observacao": "Reativado"
  }'

curl -X PUT "http://localhost:3000/api/v1/students/1/inactivate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "motivo": "Mudança de turma",
    "observacao": "Saída temporária"
  }'

curl -X PUT "http://localhost:3000/api/v1/students/1/transfer" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "idClasseDestino": 3,
    "dataInicio": "2026-07-19",
    "motivo": "Mudança de faixa etária",
    "observacao": "Transferência interna"
  }'


---

PATCH

Alterar presença de um aluno na chamada

curl -X PATCH "http://localhost:3000/api/v1/attendance/1/students/10" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "presente",
    "observacao": "Chegou no horário"
  }'

Valores aceitos em status:

presente

atrasado

ausente



---

DELETE

No código atual não existe rota DELETE registrada no backend.


---

5) Resumo rápido das rotas reais

GET

/api/v1/

/api/v1/health

/api/v1/auth/me

/api/v1/people

/api/v1/people/:id

/api/v1/classes

/api/v1/classes/:id

/api/v1/classes/:id/students

/api/v1/classes/:id/attendance

/api/v1/students

/api/v1/students/inactive

/api/v1/students/:id

/api/v1/students/:id/history

/api/v1/students/:id/status-history

/api/v1/students/:id/classes

/api/v1/attendance/summary

/api/v1/attendance/classes/:classId

/api/v1/attendance/classes/:classId/summary

/api/v1/reports/presence-ranking

/api/v1/reports/visitors-ranking

/api/v1/reports/offers-ranking

/api/v1/reports/birthdays


POST

/api/v1/auth/login

/api/v1/people

/api/v1/students/enroll

/api/v1/attendance/open

/api/v1/attendance/:callId/present-all

/api/v1/attendance/:callId/absent-all

/api/v1/attendance/:callId/close

/api/v1/attendance/:callId/reopen

/api/v1/attendance/:callId/visitors

/api/v1/attendance/:callId/offers


PUT

/api/v1/people/:id

/api/v1/students/:id/activate

/api/v1/students/:id/inactivate

/api/v1/students/:id/transfer


PATCH

/api/v1/attendance/:callId/students/:studentClassId


DELETE

nenhum endpoint existente hoje


Se você quiser, no próximo passo eu posso te mandar isso já em formato de arquivo .md pronto para colar no projeto ou montar um curl.sh com variáveis para testar tudo mais rápido.