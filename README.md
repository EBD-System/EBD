# Funções testadas na EBD

## fn_ebd_abrir_chamada
```sql
SELECT public.fn_ebd_abrir_chamada(1, CURRENT_DATE);
```
Essa função abre a chamada da classe na data informada. Se a chamada já existir, ela reaproveita a mesma.
Exemplo de saída:
```text
11
```

## fn_ebd_matricular_aluno
```sql
SELECT public.fn_ebd_matricular_aluno(4, 'ALU9999', 4, CURRENT_DATE, 'Matrícula de teste para validação das funções');
```
Essa função matricula uma pessoa como aluno em uma classe.
Exemplo de saída:
```text
15
```

## fn_ebd_alunos_classe
```sql
SELECT * FROM public.fn_ebd_alunos_classe(1);
```
Essa função lista os alunos da classe informada.
Exemplo de saída:
```text
Pedro Santos
Elisa Santos
```

## fn_ebd_aniversariantes
```sql
SELECT * FROM public.fn_ebd_aniversariantes(CURRENT_DATE);
```
Essa função lista os aniversariantes do período consultado.
Exemplo de saída:
```text
Thiago Costa
Bruno Rocha
Patrícia Almeida
Gabriel Nunes
```

## fn_ebd_chamada_classe
```sql
SELECT * FROM public.fn_ebd_chamada_classe(1, CURRENT_DATE);
```
Essa função mostra os dados da chamada da classe na data informada.
Exemplo de saída:
```text
classe: Crianças Menores
oferta: 123.45
visitantes: 1
ausentes: 2
```

## fn_ebd_historico_aluno
```sql
SELECT * FROM public.fn_ebd_historico_aluno(<id_aluno>);
```
Essa função mostra o histórico de vínculo do aluno.
Exemplo de saída:
```text
Daniela Souza | ALU9999 | ativo
```

## fn_ebd_data_aniversario_no_ano
```sql
SELECT public.fn_ebd_data_aniversario_no_ano(DATE '2016-02-29', EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER);
```
Essa função ajusta a data de nascimento para o ano informado.
Exemplo de saída:
```text
2026-02-28
```

## fn_ebd_resumo_classe
```sql
SELECT * FROM public.fn_ebd_resumo_classe(1, CURRENT_DATE);
```
Essa função mostra um resumo da chamada da classe.
Exemplo de saída:
```text
total_alunos: 2
presentes: 0
atrasados: 0
ausentes: 2
```

## fn_ebd_resumo_chamada
```sql
SELECT * FROM public.fn_ebd_resumo_chamada(CURRENT_DATE);
```
Essa função mostra o resumo geral da chamada do dia.
Exemplo de saída:
```text
total_alunos: 2
presentes: 0
atrasados: 0
ausentes: 2
```

## fn_ebd_registrar_oferta
```sql
SELECT public.fn_ebd_registrar_oferta(<id_chamada>, 123.45);
```
Essa função registra o valor da oferta na chamada.
Exemplo de saída:
```text
oferta: 123.45
```

## fn_ebd_registrar_visitante
```sql
SELECT public.fn_ebd_registrar_visitante(<id_chamada>, 'Carlos Teste', 'Visitante para validação');
```
Essa função registra um visitante na chamada.
Exemplo de saída:
```text
visitantes: 1
```

## fn_ebd_marcar_presenca
```sql
SELECT public.fn_ebd_marcar_presenca(<id_chamada>, 1, 'presente');
```
Essa função marca a presença de um aluno na chamada.
Exemplo de saída:
```text
Aluno 1 presente
```

## fn_ebd_todos_presentes
```sql
SELECT public.fn_ebd_todos_presentes(<id_chamada>);
```
Essa função marca todos os alunos da chamada como presentes.
Exemplo de saída:
```text
Todos presentes
```

## fn_ebd_todos_ausentes
```sql
SELECT public.fn_ebd_todos_ausentes(<id_chamada>);
```
Essa função marca todos os alunos da chamada como ausentes.
Exemplo de saída:
```text
Todos ausentes
```

## fn_ebd_fechar_chamada
```sql
SELECT public.fn_ebd_fechar_chamada(<id_chamada>);
```
Essa função fecha a chamada.
Exemplo de saída:
```text
Chamada fechada
```

## fn_ebd_reabrir_chamada
```sql
SELECT public.fn_ebd_reabrir_chamada(<id_chamada>);
```
Essa função reabre a chamada.
Exemplo de saída:
```text
Chamada reaberta
```

## fn_ebd_set_atualizado_em
```sql
UPDATE public.ebd_pessoa
   SET observacao = observacao
 WHERE id_pessoa = 1;
```
Essa função de trigger atualiza automaticamente o campo `atualizado_em`.
Exemplo de saída:
```text
2026-07-14 08:48:07.843532-03
```
