# EBD — Banco de Dados e Funções

Este repositório reúne o esquema PostgreSQL da Escola Bíblica Dominical (EBD), com tabelas, constraints, índices, triggers e funções utilitárias para matrícula, chamada, presença, visitantes, ofertas, resumos e rankings.

> Os exemplos abaixo usam a base carregada no dump `ebd_backup.sql`.

## Visão geral

### Principais entidades
- `ebd_pessoa`: cadastro base da pessoa
- `ebd_aluno`: vínculo da pessoa como aluno
- `ebd_aluno_classe`: histórico de vínculo do aluno com uma classe
- `ebd_classe`: cadastro das classes
- `ebd_chamada`: chamada por classe e data
- `ebd_chamada_aluno`: presença/ausência por aluno na chamada
- `ebd_chamada_visitante`: visitantes da chamada
- `ebd_funcao`, `ebd_pessoa_funcao`: funções da pessoa na EBD
- `ebd_usuario`, `ebd_perfil`, `ebd_usuario_perfil`: autenticação e perfis

### Regras importantes
- A chamada é única por `id_classe` + `data_chamada`.
- Só é permitido alterar chamada do dia atual nas rotinas de presença, oferta, visitantes, fechar e zerar.
- `fn_ebd_reabrir_chamada` permite reabrir chamada fora da data atual apenas para usuário com perfil de administrador.
- `visitante` é um registro da chamada do dia, não um vínculo permanente.

---

## Fluxo real de uso da chamada

A ordem abaixo representa o uso mais natural do sistema no dia da aula:

1. abrir a chamada da classe;
2. registrar presença de cada aluno;
3. aplicar ações coletivas, quando necessário;
4. registrar oferta, visitantes, bíblias, revistas e observações;
5. conferir os resumos e rankings;
6. fechar a chamada;
7. reabrir somente se houver necessidade e permissão.

### Exemplo de ciclo completo

```sql
-- 1) abrir a chamada
SELECT public.fn_ebd_abrir_chamada(1, CURRENT_DATE);

-- 2) obter o id da chamada aberta
SELECT * FROM public.fn_ebd_chamada_classe(1, CURRENT_DATE);

-- 3) registrar a presença de um aluno específico
SELECT public.fn_ebd_alterar_status_chamada(12, 1, 'presente');

-- 4) registrar um aluno como atrasado
SELECT public.fn_ebd_alterar_status_chamada(12, 2, 'atrasado');

-- 5) marcar todos como presentes, se a aula começar com a classe completa
SELECT public.fn_ebd_todos_presentes(12);

-- 6) registrar oferta e visitante
SELECT public.fn_ebd_registrar_oferta(12, 123.45);
SELECT public.fn_ebd_registrar_visitante(12, 'Carlos Teste', 'Visitante da aula');

-- 7) consultar o resumo
SELECT * FROM public.fn_ebd_resumo_classe(1, CURRENT_DATE);

-- 8) fechar a chamada ao final
SELECT public.fn_ebd_fechar_chamada(12);
```

### Exemplo de uso com variáveis no app

Para facilitar a leitura no código da aplicação, use variáveis em vez de números soltos:

```js
const idChamada = 12;
const idAlunoClasse = 1;

// marca presença
fnEbdAlterarStatusChamada(idChamada, idAlunoClasse, 'presente');

// marca atraso
fnEbdAlterarStatusChamada(idChamada, idAlunoClasse, 'atrasado');

// marca ausência
fnEbdAlterarStatusChamada(idChamada, idAlunoClasse, 'ausente');
```

> Se você quiser uma função mais amigável no front-end, pode criar um wrapper como `FuncaoPresenca(alunoId)` ou `marcarPresenca(alunoId)`, e internamente ela chama a função SQL genérica.

---

## Funções

## `fn_ebd_abrir_chamada`

```sql
SELECT public.fn_ebd_abrir_chamada(1, DATE '2026-07-13');
```

Abre a chamada de uma classe para uma data. Se a chamada já existir, a função reaproveita o mesmo registro. Também cria automaticamente os registros dos alunos ativos da classe com status `ausente`.

**Retorno:** `bigint` com o `id_chamada`.

**Exemplo de saída:**
```text
1
```

---

## `fn_ebd_alunos_classe`

```sql
SELECT * FROM public.fn_ebd_alunos_classe(1);
```

Lista os alunos ativos de uma classe.

**Retorno:** tabela com `id_aluno`, `id_pessoa`, `nome`, `matricula`, `status`.

**Exemplo de saída:**
```text
 id_aluno | id_pessoa |      nome       | matricula | status
----------+-----------+-----------------+-----------+--------
 1        | 5         | Pedro Santos    | ALU0005   | ativo
 2        | 6         | Elisa Santos    | ALU0006   | ativo
```

---

## `fn_ebd_aniversariantes`

```sql
SELECT * FROM public.fn_ebd_aniversariantes(DATE '2026-07-13');
```

Lista aniversariantes agrupados por período: semana passada, semana seguinte, mês atual e trimestre atual.

**Retorno:** tabela com `periodo`, `id_pessoa`, `nome`, `data_nascimento`, `aniversario_no_ano`, `idade`.

**Exemplo de saída resumida:**
```text
periodo         | nome
-----------------|----------------
semana_passada   | Thiago Costa
mes_atual        | Thiago Costa
trimestre_atual  | Thiago Costa
trimestre_atual  | Patrícia Almeida
trimestre_atual  | Gabriel Nunes
trimestre_atual  | Bruno Rocha
```

---

## `fn_ebd_chamada_classe`

```sql
SELECT * FROM public.fn_ebd_chamada_classe(1, DATE '2026-07-13');
```

Mostra o detalhamento da chamada de uma classe em uma data.

**Retorno:** tabela com:
`id_chamada`, `id_chamada_aluno`, `id_classe`, `classe`, `data_chamada`, `id_aluno_classe`, `id_aluno`, `id_pessoa`, `matricula`, `aluno`, `status`, `observacao`.

**Exemplo de saída:**
```text
id_chamada | classe            | aluno         | status   | observacao
-----------+-------------------+---------------+----------+------------------------
1          | Crianças Menores  | Pedro Santos  | presente | 
1          | Crianças Menores  | Elisa Santos  | atrasado | Chegou após o início.
```

---

## `fn_ebd_data_aniversario_no_ano`

```sql
SELECT public.fn_ebd_data_aniversario_no_ano(DATE '2016-02-29', 2026);
```

Ajusta a data de nascimento para o ano informado. Em ano não bissexto, 29/02 vira 28/02.

**Retorno:** `date`.

**Exemplo de saída:**
```text
2026-02-28
```

---

## `fn_ebd_fechar_chamada`

```sql
SELECT public.fn_ebd_fechar_chamada(1);
```

Fecha a chamada informada.

**Retorno:** `void`.

**Observação:** só fecha chamada do dia atual.

---

## `fn_ebd_historico_aluno`

```sql
SELECT * FROM public.fn_ebd_historico_aluno(6);
```

Mostra o histórico de vínculos do aluno com classes.

**Retorno:** tabela com:
`id_aluno`, `id_pessoa`, `nome`, `matricula`, `status_aluno`, `id_aluno_classe`, `id_classe`, `classe`, `data_inicio`, `data_fim`, `ativo_classe`, `motivo`.

**Exemplo de saída resumida:**
```text
nome          | matricula | classe             | data_inicio | data_fim   | ativo_classe
-------------|-----------|--------------------|-------------|------------|-------------
Gabriel Nunes | ALU0010   | Adolescentes       | 2026-01-16  |            | true
Gabriel Nunes | ALU0010   | Crianças Maiores   | 2025-02-01  | 2026-01-15 | false
```

---

## `fn_ebd_alterar_status_chamada`

```sql
SELECT public.fn_ebd_alterar_status_chamada(1, 1, 'presente');
```

Função genérica para atualizar o status do aluno na chamada.

**Retorno:** `void`.

**Status aceitos:** `presente`, `atrasado` ou `ausente`.

**Exemplo de uso com variável no front-end:**
```js
const idAlunoClasse = 1;
fnEbdAlterarStatusChamada(idChamada, idAlunoClasse, 'presente');
```

---

## `fn_ebd_matricular_aluno`

```sql
SELECT public.fn_ebd_matricular_aluno(4, 'ALU9999', 4, CURRENT_DATE, 'Matrícula de teste para validação');
```

Matricula uma pessoa como aluno em uma classe.

**Assinatura atual:**
```sql
fn_ebd_matricular_aluno(
    p_id_pessoa bigint,
    p_matricula text,
    p_id_classe bigint,
    p_data_inicio date DEFAULT CURRENT_DATE,
    p_observacao text DEFAULT ''
)
```

**Retorno:** `bigint` com o novo `id_aluno`.

**Exemplo de saída:**
```text
16
```

---

## `fn_ebd_ranking_oferta`

```sql
SELECT * FROM public.fn_ebd_ranking_oferta(DATE '2026-07-13');
```

Mostra o ranking das classes pela soma de ofertas no dia.

**Retorno:** tabela com `id_classe`, `classe`, `valor_oferta`, `posicao`, `resultado`.

**Exemplo de saída resumida:**
```text
posicao | classe            | valor_oferta | resultado
------- |-------------------|-------------|----------------------
1       | Senhores          | 150.00      | vencedora
2       | Senhoras          | 110.00      | participante
3       | Jovens            | 87.00       | participante
4       | Crianças Maiores   | 52.50       | participante
5       | Adolescentes      | 40.00       | participante
6       | Crianças Menores  | 35.00       | participante
```

---

## `fn_ebd_ranking_presenca`

```sql
SELECT * FROM public.fn_ebd_ranking_presenca(DATE '2026-07-13');
```

Mostra o ranking das classes por percentual de presença no dia.

**Retorno:** tabela com `id_classe`, `classe`, `total_alunos`, `presentes`, `atrasados`, `ausentes`, `percentual_presenca`, `posicao`, `resultado`.

**Regra de empate:** quando duas ou mais classes têm o maior percentual, todas recebem `resultado = 'empate na liderança'`.

**Exemplo de saída resumida:**
```text
posicao | classe            | percentual_presenca | resultado
------- |-------------------|--------------------|----------------------
1       | Adolescentes      | 100.0              | empate na liderança
2       | Crianças Menores  | 100.0              | empate na liderança
3       | Jovens            | 100.0              | empate na liderança
4       | Crianças Maiores  | 50.0               | participante
5       | Senhores          | 50.0               | participante
6       | Senhoras          | 50.0               | participante
```

---

## `fn_ebd_ranking_visitantes`

```sql
SELECT * FROM public.fn_ebd_ranking_visitantes(DATE '2026-07-13');
```

Mostra o ranking das classes pelo número de visitantes no dia.

**Retorno:** tabela com `id_classe`, `classe`, `visitantes`, `posicao`, `resultado`.

**Regra de empate:** quando duas ou mais classes têm o maior número de visitantes, todas recebem `resultado = 'empate na liderança'`.

**Exemplo de saída resumida:**
```text
posicao | classe            | visitantes | resultado
------- |-------------------|-----------|----------------------
1       | Jovens            | 2         | vencedora
2       | Crianças Maiores  | 1         | participante
3       | Senhores          | 1         | participante
4       | Senhoras          | 1         | participante
5       | Adolescentes      | 0         | participante
6       | Crianças Menores  | 0         | participante
```

---

## `fn_ebd_reabrir_chamada`

```sql
SELECT public.fn_ebd_reabrir_chamada(1);
```

Reabre a chamada informada.

**Retorno:** `void`.

**Observação:** fora da data atual, apenas administrador pode reabrir.

---

## `fn_ebd_registrar_oferta`

```sql
SELECT public.fn_ebd_registrar_oferta(1, 123.45);
```

Registra o valor da oferta na chamada.

**Retorno:** `numeric`.

**Exemplo de saída:**
```text
123.45
```

---

## `fn_ebd_registrar_visitante`

```sql
SELECT public.fn_ebd_registrar_visitante(1, 'Carlos Teste', 'Visitante para validação');
```

Registra um visitante na chamada.

**Retorno:** `bigint` com o `id_chamada_visitante`.

**Exemplo de saída:**
```text
10
```

---

## `fn_ebd_resumo_chamada`

```sql
SELECT * FROM public.fn_ebd_resumo_chamada(DATE '2026-07-13');
```

Mostra o resumo geral de todas as chamadas do dia.

**Retorno:** tabela com:
`id_chamada`, `id_classe`, `classe`, `data_chamada`, `oferta`, `visitantes`, `biblias`, `revistas`, `observacao`, `total_alunos`, `presentes`, `atrasados`, `ausentes`, `presenca_turma`.

**Exemplo de saída resumida:**
```text
classe          | oferta  | visitantes | biblias | revistas | total_alunos | presentes | atrasados | ausentes | presenca_turma
---------------|---------|------------|---------|----------|--------------|-----------|-----------|----------|---------------
Resumo Geral    | 474.50  | 5          | 19      | 11       | 12           | 7         | 2         | 3        | 75.0
```

---

## `fn_ebd_resumo_classe`

```sql
SELECT * FROM public.fn_ebd_resumo_classe(1, DATE '2026-07-13');
```

Mostra o resumo de uma classe em uma data.

**Retorno:** tabela com:
`id_chamada`, `id_classe`, `classe`, `data_chamada`, `oferta`, `visitantes`, `biblias`, `revistas`, `observacao`, `total_alunos`, `presentes`, `atrasados`, `ausentes`, `presenca_turma`.

**Exemplo de saída resumida:**
```text
classe            | oferta | visitantes | biblias | revistas | total_alunos | presentes | atrasados | ausentes | presenca_turma
-----------------|--------|------------|---------|----------|--------------|-----------|-----------|----------|---------------
Crianças Menores | 35.00  | 0          | 2       | 2        | 2            | 1         | 1         | 0        | 100.0
```

---

## `fn_ebd_set_atualizado_em`

```sql
UPDATE public.ebd_pessoa
   SET observacao = observacao
 WHERE id_pessoa = 1;
```

Função de trigger usada para atualizar automaticamente o campo `atualizado_em`.

**Retorno:** `trigger`.

---

## `fn_ebd_todos_ausentes`

```sql
SELECT public.fn_ebd_todos_ausentes(1);
```

Marca todos os alunos da chamada como ausentes.

**Retorno:** `void`.

---

## `fn_ebd_todos_presentes`

```sql
SELECT public.fn_ebd_todos_presentes(1);
```

Marca todos os alunos da chamada como presentes.

**Retorno:** `void`.

---

## Observações finais

### Funções adicionadas neste dump
- `fn_ebd_ranking_oferta`
- `fn_ebd_ranking_presenca`
- `fn_ebd_ranking_visitantes`

### Funções com comportamento ou exemplo ajustado
- `fn_ebd_matricular_aluno` — ordem correta dos parâmetros
- `fn_ebd_chamada_classe` — colunas retornadas atualizadas
- `fn_ebd_resumo_classe` — agora inclui `visitantes`, `biblias`, `revistas` e `presenca_turma`
- `fn_ebd_resumo_chamada` — agora consolida os totais gerais do dia
- `fn_ebd_registrar_visitante` — retorno é o `id_chamada_visitante`
- `fn_ebd_fechar_chamada`, `fn_ebd_reabrir_chamada`, `fn_ebd_alterar_status_chamada`, `fn_ebd_todos_presentes`, `fn_ebd_todos_ausentes` — retorno `void`

---

## Banco de dados

O dump também contém:
- tabelas
- constraints
- índices
- FKs
- triggers
- dados de exemplo para carga inicial
