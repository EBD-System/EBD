# Documentação mínima da API

## Visão geral

A superfície oficial da API é `/api/v1`. As rotas antigas em `/` e `/api` foram removidas.

## Formato de resposta

### Sucesso

```json
{
  "ok": true,
  "message": "Operação concluída com sucesso.",
  "data": {}
}
```

### Erro

```json
{
  "ok": false,
  "source": "backend",
  "stage": "request",
  "message": "Requisição inválida.",
  "error": {
    "statusCode": 400,
    "stage": "request"
  }
}
```

## Autenticação

As rotas protegidas exigem `Authorization: Bearer <token>`.

O contexto autenticado contém os campos canônicos:

- `sub` / `id_usuario`
- `id_pessoa`
- `id_cadastro`
- `login`
- `profiles`

## Regras de tenant

- O tenant oficial é sempre `id_cadastro` do JWT.
- A API não deve depender de tenant enviado por `query`, `body` ou headers do frontend.
- Pessoas, classes, alunos, chamadas e relatórios continuam escopados ao tenant do token.
- Se o token não trouxer `id_cadastro` válido, a operação protegida não deve prosseguir.

## Permissões

| Operação | Perfis permitidos |
| --- | --- |
| Cadastro de pessoas | `Administrador`, `Secretaria` |
| Matrícula e manutenção de alunos | `Administrador`, `Secretaria` |
| Abertura e reabertura de chamada | `Administrador`, `Secretaria` |
| Alteração de presença, fechamento e visitantes | `Administrador`, `Secretaria`, `Professor` |
| Lançamento de ofertas | `Administrador`, `Secretaria`, `Financeiro` |

## Rotas oficiais

### Health

- `GET /api/v1/health`
  - Autenticação: não
  - Resposta: status operacional da API

### Auth

- `POST /api/v1/auth/login`
  - Body:
    ```json
    { "login": "usuario", "senha": "segredo" }
    ```
  - Resposta `data`:
    ```json
    {
      "token": "jwt",
      "user": {
        "id_usuario": 1,
        "id_pessoa": 10,
        "id_cadastro": 2,
        "login": "usuario",
        "pessoa_nome": "Nome",
        "profiles": ["Administrador"]
      }
    }
    ```

- `GET /api/v1/auth/me`
  - Autenticação: sim
  - Resposta `data`: objeto do usuário autenticado com `id_usuario`, `id_pessoa`, `id_cadastro`, `login`, `ultimo_login`, `ativo`, `pessoa_nome`, `email` e `profiles`

### Pessoas

- Autenticação: sim

- `GET /api/v1/people`
  - Query:
    - `page` (opcional)
    - `limit` (opcional)
    - `search` (opcional)
  - Resposta: coleção paginada de pessoas do tenant atual

- `GET /api/v1/people/:id`
  - Resposta: pessoa localizada no tenant atual

- `POST /api/v1/people`
  - Permissão: `Administrador`, `Secretaria`
  - Body:
    ```json
    {
      "nome": "Pessoa",
      "sexo": "feminino",
      "cpf": "00000000000",
      "data_nascimento": "2000-01-01",
      "telefone": "999999999",
      "email": "pessoa@exemplo.com",
      "logradouro": "Rua A",
      "numero": "10",
      "bairro": "Centro",
      "cidade": "Cidade",
      "uf": "PE",
      "cep": "50000000",
      "observacao": "Texto livre"
    }
    ```
  - Campo obrigatório: `nome`

- `PUT /api/v1/people/:id`
  - Permissão: `Administrador`, `Secretaria`
  - Body: mesma estrutura de criação, com todos os campos opcionais

### Classes

- Autenticação: sim

- `GET /api/v1/classes`
  - Query opcional: `date` em `YYYY-MM-DD`
  - Resposta: lista de classes do tenant

- `GET /api/v1/classes/:id`
  - Resposta: classe localizada no tenant

- `GET /api/v1/classes/:id/students`
  - Resposta: lista de alunos vinculados à classe

- `GET /api/v1/classes/:id/attendance`
  - Query opcional: `date` em `YYYY-MM-DD`
  - Resposta: resumo de chamada da classe

### Alunos

- Autenticação: sim

- `GET /api/v1/students`
  - Query opcional:
    - `classId`
    - `status` (`ativo`, `transferido`, `inativo`, `falecido`)
    - `inactive`
  - Resposta: lista de alunos do tenant

- `GET /api/v1/students/inactive`
  - Atalho da listagem com `inactive=true`

- `GET /api/v1/students/:id`
  - Resposta: aluno localizado no tenant

- `GET /api/v1/students/:id/history`
  - Resposta: histórico do aluno

- `GET /api/v1/students/:id/status-history`
  - Resposta: histórico de status do aluno

- `GET /api/v1/students/:id/classes`
  - Resposta: turmas vinculadas ao aluno

- `POST /api/v1/students/enroll`
  - Permissão: `Administrador`, `Secretaria`
  - Body:
    ```json
    {
      "idPessoa": 1,
      "idClasse": 2,
      "matricula": "2026-001",
      "dataInicio": "2026-01-01",
      "observacao": "Texto livre"
    }
    ```
  - Campos obrigatórios: `idPessoa`, `idClasse`
  - Resposta de sucesso: retorna `id_aluno` e também os dados enriquecidos do aluno recém-matriculado, incluindo `id_aluno_classe`, `id_pessoa`, `id_classe`, `classe`, `matricula` e `status`

- `PUT /api/v1/students/:id/activate`
  - Permissão: `Administrador`, `Secretaria`
  - Body:
    ```json
    { "observacao": "Reativado" }
    ```

- `PUT /api/v1/students/:id/inactivate`
  - Permissão: `Administrador`, `Secretaria`
  - Body:
    ```json
    { "motivo": "Mudança de turma", "observacao": "Texto livre" }
    ```
  - Campo obrigatório: `motivo`

- `PUT /api/v1/students/:id/transfer`
  - Permissão: `Administrador`, `Secretaria`
  - Body:
    ```json
    {
      "idClasseDestino": 21,
      "dataInicio": "2026-07-18",
      "motivo": "Mudança de faixa etária",
      "observacao": "Texto livre"
    }
    ```
  - Campo obrigatório: `idClasseDestino`
  - `dataInicio`, `motivo` e `observacao` são opcionais

### Chamadas

- Autenticação: sim

- `GET /api/v1/attendance/summary`
  - Query opcional: `date` em `YYYY-MM-DD`
  - Resposta: resumo geral das chamadas do tenant

- `GET /api/v1/attendance/classes/:classId`
  - Query opcional: `date` em `YYYY-MM-DD`
  - Resposta: detalhe da chamada da turma

- `GET /api/v1/attendance/classes/:classId/summary`
  - Query opcional: `date` em `YYYY-MM-DD`
  - Resposta: resumo da turma

- `POST /api/v1/attendance/open`
  - Permissão: `Administrador`, `Secretaria`
  - Body:
    ```json
    { "classId": 1, "date": "2026-01-01" }
    ```
  - Campo obrigatório: `classId`

- `PATCH /api/v1/attendance/:callId/students/:studentClassId`
  - Permissão: `Administrador`, `Secretaria`, `Professor`
  - Body:
    ```json
    { "status": "presente", "observacao": "Texto livre" }
    ```
  - `status` aceita: `presente`, `atrasado`, `ausente`

- `POST /api/v1/attendance/:callId/present-all`
  - Permissão: `Administrador`, `Secretaria`, `Professor`
  - Resposta: marcação coletiva com `status: "presente"`

- `POST /api/v1/attendance/:callId/absent-all`
  - Permissão: `Administrador`, `Secretaria`, `Professor`
  - Resposta: marcação coletiva com `status: "ausente"`

- `POST /api/v1/attendance/:callId/close`
  - Permissão: `Administrador`, `Secretaria`, `Professor`
  - Resposta: chamada fechada

- `POST /api/v1/attendance/:callId/reopen`
  - Permissão: `Administrador`, `Secretaria`
  - Resposta: chamada reaberta

- `POST /api/v1/attendance/:callId/visitors`
  - Permissão: `Administrador`, `Secretaria`, `Professor`
  - Body:
    ```json
    { "name": "Visitante", "observation": "Texto livre" }
    ```
  - Campo obrigatório: `name`

- `POST /api/v1/attendance/:callId/offers`
  - Permissão: `Administrador`, `Secretaria`, `Financeiro`
  - Body:
    ```json
    { "value": 10.5 }
    ```
  - Campo obrigatório: `value`

- `PUT /api/v1/attendance/:callId/summary`
  - Permissão: `Administrador`, `Secretaria`, `Professor`, `Financeiro`
  - Também aceita `PATCH /api/v1/attendance/:callId/summary`
  - Body:
    ```json
    {
      "oferta": 10.5,
      "visitantes": 3,
      "biblias": 2,
      "revistas": 4
    }
    ```
  - Os campos são normalizados antes de chegar ao service.

### Relatórios

- Autenticação: sim

- `GET /api/v1/reports/presence-ranking`
- `GET /api/v1/reports/visitors-ranking`
- `GET /api/v1/reports/offers-ranking`
- `GET /api/v1/reports/birthdays`

Todos aceitam a query opcional `date` em `YYYY-MM-DD` e retornam o envelope de relatório:

```json
{
  "relatorio": "presenca",
  "id_cadastro": 1,
  "data_referencia": "2026-01-01",
  "total_itens": 0,
  "itens": []
}
```

## Respostas importantes por operação

- Login retorna `token` e `user`.
- `GET /api/v1/auth/me` retorna o usuário autenticado.
- `POST /api/v1/attendance/open` retorna `id_chamada` e `data_chamada`.
- `PATCH /api/v1/attendance/:callId/students/:studentClassId` retorna `id_chamada_aluno`, `status` e `observacao`.
- `POST /api/v1/attendance/:callId/present-all`, `absent-all`, `close` e `reopen` retornam `id_chamada` e `status`.
- `POST /api/v1/attendance/:callId/visitors` retorna `id_chamada_visitante`.
- `POST /api/v1/attendance/:callId/offers` retorna `oferta`.
- Relatórios retornam `relatorio`, `id_cadastro`, `data_referencia`, `total_itens` e `itens`.

## Observações finais

- A validação de `params`, `query` e `body` acontece antes dos services.
- O contrato oficial é o que está em `/api/v1`; a camada legada não deve receber novos endpoints.
