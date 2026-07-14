# Funções da EBD

Este pacote atualiza o conjunto de funções da EBD para contemplar:

- abertura e fechamento de chamada;
- alteração genérica do status do aluno na chamada;
- ativação e inativação manual de alunos;
- inativação automática após 4 faltas consecutivas;
- histórico de movimentações de status;
- listagem de alunos inativos;
- relatórios e rankings ajustados para ignorar alunos inativos;
- manutenção de ofertas, visitantes e resumos da chamada.

## Arquivos

- `ebd_funcoes_alunos_status.sql`
  - script principal de migração;
  - cria a tabela de histórico;
  - cria as novas funções;
  - altera o comportamento das funções já existentes.

---

## Funções novas

## fn_ebd_registrar_status_aluno
```sql
-- id_aluno = identificador do aluno
-- novo_status = 'ativo' ou 'inativo'
-- origem = 'manual', 'automatica' ou 'carga_inicial'
-- motivo = motivo da alteração
-- observacao = observação complementar
-- id_chamada = chamada que gerou a alteração, quando existir
-- id_chamada_aluno = registro da chamada do aluno, quando existir

SELECT public.fn_ebd_registrar_status_aluno(
    id_aluno,
    novo_status,
    origem,
    motivo,
    observacao,
    id_chamada,
    id_chamada_aluno
);
```
Função base de controle de status do aluno. Ela registra a mudança no histórico e atualiza os campos de status, data de desligamento, motivo e observação.

Exemplo de saída:
```text
Sem retorno
```

## fn_ebd_ativar_aluno
```sql
-- id_aluno = aluno que será reativado
-- observacao = observação opcional

SELECT public.fn_ebd_ativar_aluno(
    id_aluno,
    observacao
);
```
Ativa novamente um aluno inativo sem exigir motivo.

Exemplo de saída:
```text
Sem retorno
```

## fn_ebd_inativar_aluno
```sql
-- id_aluno = aluno que será inativado
-- motivo = motivo da inativação
-- observacao = observação opcional

SELECT public.fn_ebd_inativar_aluno(
    id_aluno,
    motivo,
    observacao
);
```
Inativa um aluno manualmente, gravando motivo e observação.

Exemplo de saída:
```text
Sem retorno
```

## fn_ebd_alunos_inativos
```sql
-- id_classe = opcional. Quando informado, filtra pela classe.
SELECT * FROM public.fn_ebd_alunos_inativos(id_classe);
```
Lista os alunos inativos, com filtro opcional por classe.

Exemplo de saída resumida:
```text
nome           | status   | classe
---------------|----------|--------------
Daniela Souza  | inativo  | Jovens
```

## fn_ebd_historico_status_aluno
```sql
-- id_aluno = aluno desejado
SELECT * FROM public.fn_ebd_historico_status_aluno(id_aluno);
```
Mostra o histórico de ativação e inativação de um aluno.

Exemplo de saída resumida:
```text
status_anterior | status_novo | origem      | motivo
---------------|-------------|-------------|-------------------------
ativo          | inativo     | automatica  | 4 faltas consecutivas
```

## fn_ebd_tem_4_faltas_consecutivas
```sql
-- id_aluno_classe = vínculo do aluno com a classe
SELECT public.fn_ebd_tem_4_faltas_consecutivas(id_aluno_classe);
```
Verifica se o aluno da classe já acumulou 4 faltas consecutivas.

Exemplo de saída:
```text
true
```

## fn_ebd_processar_inativacao_por_faltas
```sql
-- id_chamada = chamada recém-lançada ou encerrada
SELECT public.fn_ebd_processar_inativacao_por_faltas(id_chamada);
```
Processa automaticamente a inativação dos alunos que completaram 4 faltas consecutivas.

Exemplo de saída:
```text
0
```

---

## Funções alteradas

## fn_ebd_alterar_status_chamada
```sql
-- id_chamada = chamada que será alterada
-- id_aluno_classe = vínculo do aluno com a classe
-- p_status = 'presente', 'atrasado' ou 'ausente'

SELECT public.fn_ebd_alterar_status_chamada(
    id_chamada,
    id_aluno_classe,
    p_status
);
```
Substitui a antiga função de marcação de presença. Agora altera o status do aluno na chamada de forma genérica e aceita também `ausente`.

Exemplo de saída:
```text
Sem retorno
```

## fn_ebd_todos_presentes
```sql
-- id_chamada = chamada que será preenchida
SELECT public.fn_ebd_todos_presentes(id_chamada);
```
Marca todos os alunos ativos da chamada como presentes e limpa as observações individuais.

Exemplo de saída:
```text
Sem retorno
```

## fn_ebd_todos_ausentes
```sql
-- id_chamada = chamada que será preenchida
SELECT public.fn_ebd_todos_ausentes(id_chamada);
```
Marca todos os alunos ativos da chamada como ausentes e limpa as observações individuais. Depois disso, processa a regra de 4 faltas consecutivas.

Exemplo de saída:
```text
Sem retorno
```

## fn_ebd_fechar_chamada
```sql
-- id_chamada = chamada que será fechada
SELECT public.fn_ebd_fechar_chamada(id_chamada);
```
Fecha a chamada do dia atual, grava a data de fechamento e executa o processamento automático de inativação por faltas.

Exemplo de saída:
```text
Sem retorno
```

## fn_ebd_resumo_classe
```sql
-- id_classe = classe desejada
-- data_chamada = data da chamada

SELECT * FROM public.fn_ebd_resumo_classe(
    id_classe,
    data_chamada
);
```
Mostra o resumo de uma classe em uma data. Os alunos inativos não entram no cálculo.

Exemplo de saída resumida:
```text
classe            | oferta | visitantes | biblias | revistas | total_alunos | presentes | atrasados | ausentes | presenca_turma
-----------------|--------|------------|---------|----------|--------------|-----------|-----------|----------|---------------
Crianças Menores | 35.00  | 0          | 2       | 2        | 2            | 1         | 1         | 0        | 100.0
```

## fn_ebd_resumo_chamada
```sql
-- data_chamada = data da chamada
SELECT * FROM public.fn_ebd_resumo_chamada(data_chamada);
```
Mostra o resumo geral de todas as chamadas do dia. Os alunos inativos não entram no cálculo.

Exemplo de saída resumida:
```text
classe          | oferta  | visitantes | biblias | revistas | total_alunos | presentes | atrasados | ausentes | presenca_turma
---------------|---------|------------|---------|----------|--------------|-----------|-----------|----------|---------------
Resumo Geral    | 474.50  | 5          | 19      | 11       | 12           | 7         | 2         | 3        | 75.0
```

## fn_ebd_ranking_presenca
```sql
-- data_chamada = data da chamada
SELECT * FROM public.fn_ebd_ranking_presenca(data_chamada);
```
Mostra o ranking de presença das classes na data informada. A porcentagem considera `presente` e `atrasado` como presença, e ignora alunos inativos.

Exemplo de saída resumida:
```text
classe           | percentual_presenca | posicao | resultado
----------------|---------------------|---------|---------------------
Crianças Menores| 100.0               | 1       | vencedora
```

## fn_ebd_ranking_oferta
```sql
-- data_chamada = data da chamada
SELECT * FROM public.fn_ebd_ranking_oferta(data_chamada);
```
Mostra o ranking das classes por oferta na data informada.

Exemplo de saída resumida:
```text
classe           | valor_oferta | posicao | resultado
----------------|-------------|---------|-----------
Jovens          | 87.00       | 1       | vencedora
```

## fn_ebd_ranking_visitantes
```sql
-- data_chamada = data da chamada
SELECT * FROM public.fn_ebd_ranking_visitantes(data_chamada);
```
Mostra o ranking das classes por visitantes na data informada.

Exemplo de saída resumida:
```text
classe           | visitantes | posicao | resultado
----------------|-----------|---------|-----------
Jovens          | 2         | 1       | vencedora
```

## fn_ebd_abrir_chamada
```sql
-- id_classe = classe da chamada
-- data_chamada = data desejada

SELECT public.fn_ebd_abrir_chamada(
    id_classe,
    data_chamada
);
```
Abre a chamada da classe na data informada. Se a chamada já existir, a mesma chamada é reaproveitada.

Exemplo de saída:
```text
12
```

## fn_ebd_chamada_classe
```sql
-- id_classe = classe desejada
-- data_chamada = data da chamada

SELECT * FROM public.fn_ebd_chamada_classe(
    id_classe,
    data_chamada
);
```
Mostra os dados detalhados da chamada da classe na data informada.

Exemplo de saída resumida:
```text
classe          | aluno            | status
---------------|------------------|--------
Crianças Menores| Pedro Santos     | presente
```

## fn_ebd_matricular_aluno
```sql
-- id_pessoa = pessoa que será matriculada
-- matricula = código da matrícula
-- id_classe = classe inicial
-- data_inicio = data inicial do vínculo
-- observacao = observação opcional

SELECT public.fn_ebd_matricular_aluno(
    id_pessoa,
    matricula,
    id_classe,
    data_inicio,
    observacao
);
```
Matrícula uma pessoa como aluno e cria o vínculo inicial com a classe.

Exemplo de saída:
```text
15
```

## fn_ebd_aniversariantes
```sql
-- data_referencia = data usada para o filtro

SELECT * FROM public.fn_ebd_aniversariantes(data_referencia);
```
Lista os aniversariantes por período em relação à data informada.

Exemplo de saída resumida:
```text
periodo         | nome
---------------|-------------------
mes_atual      | Patrícia Almeida
```

## fn_ebd_data_aniversario_no_ano
```sql
-- data_nascimento = data de nascimento
-- ano = ano desejado

SELECT public.fn_ebd_data_aniversario_no_ano(
    data_nascimento,
    ano
);
```
Ajusta a data de nascimento para o ano informado, tratando corretamente aniversários em 29 de fevereiro.

Exemplo de saída:
```text
2026-02-28
```

## fn_ebd_historico_aluno
```sql
-- id_aluno = aluno desejado
SELECT * FROM public.fn_ebd_historico_aluno(id_aluno);
```
Mostra o histórico de vínculo do aluno com as classes.

Exemplo de saída resumida:
```text
nome          | classe           | data_inicio | data_fim
-------------|------------------|-------------|---------
Gabriel Nunes | Crianças Maiores | 2025-02-01  | 2026-01-15
```

## fn_ebd_registrar_oferta
```sql
-- id_chamada = chamada desejada
-- valor = valor da oferta

SELECT public.fn_ebd_registrar_oferta(
    id_chamada,
    valor
);
```
Registra o valor da oferta na chamada.

Exemplo de saída:
```text
123.45
```

## fn_ebd_registrar_visitante
```sql
-- id_chamada = chamada desejada
-- nome = nome do visitante
-- observacao = observação opcional

SELECT public.fn_ebd_registrar_visitante(
    id_chamada,
    nome,
    observacao
);
```
Registra um visitante na chamada.

Exemplo de saída:
```text
1
```

---

## Ordem sugerida de uso

1. Abrir a chamada com `fn_ebd_abrir_chamada`.
2. Marcar os status dos alunos com `fn_ebd_alterar_status_chamada`.
3. Registrar oferta e visitantes.
4. Fechar a chamada com `fn_ebd_fechar_chamada`.
5. Consultar resumos e rankings.
6. Usar `fn_ebd_ativar_aluno` ou `fn_ebd_inativar_aluno` quando houver necessidade manual.

