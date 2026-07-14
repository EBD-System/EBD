# Execução das funções da EBD

Este documento resume a execução do script `exec2.sql`, explica o que cada função fez e organiza a saída observada durante o teste.

## Objetivo do teste

O script foi executado dentro de uma transação `BEGIN ... ROLLBACK`, então nenhuma alteração foi persistida no banco.  
A ideia do teste foi validar:

- abertura de chamada;
- matrícula de aluno;
- consultas de leitura;
- rotinas de presença e encerramento;
- disparo do trigger de atualização de `ebd_pessoa`.

## Funções utilizadas

| Função | Papel no teste |
|---|---|
| `public.fn_ebd_abrir_chamada(id_classe, data_chamada)` | Abre a chamada da classe para uma data. Se já existir, reaproveita a mesma chamada. |
| `public.fn_ebd_matricular_aluno(id_pessoa, matricula, id_classe, data_inicio, motivo)` | Cria a matrícula do aluno em uma classe. |
| `public.fn_ebd_alunos_classe(id_classe)` | Lista os alunos vinculados à classe. |
| `public.fn_ebd_aniversariantes(data_referencia)` | Retorna aniversariantes no período filtrado. |
| `public.fn_ebd_chamada_classe(id_classe, data_chamada)` | Exibe os dados detalhados da chamada da classe. |
| `public.fn_ebd_historico_aluno(id_aluno)` | Mostra o histórico do aluno. |
| `public.fn_ebd_data_aniversario_no_ano(data_nascimento, ano)` | Calcula o aniversário ajustado para um ano específico. |
| `public.fn_ebd_resumo_classe(id_classe, data_referencia)` | Mostra o resumo da chamada por classe. |
| `public.fn_ebd_resumo_chamada(data_referencia)` | Mostra o resumo geral da chamada do dia. |
| `public.fn_ebd_registrar_oferta(id_chamada, valor)` | Registra a oferta na chamada. |
| `public.fn_ebd_registrar_visitante(id_chamada, nome, observacao)` | Registra um visitante na chamada. |
| `public.fn_ebd_marcar_presenca(id_chamada, id_aluno_classe, status)` | Atualiza o status de presença de um aluno. |
| `public.fn_ebd_todos_presentes(id_chamada)` | Marca todos os alunos da chamada como presentes. |
| `public.fn_ebd_todos_ausentes(id_chamada)` | Marca todos os alunos da chamada como ausentes. |
| `public.fn_ebd_fechar_chamada(id_chamada)` | Fecha a chamada. |
| `public.fn_ebd_reabrir_chamada(id_chamada)` | Reabre a chamada. |

## O que aconteceu na execução

### 1) Abertura da chamada
- A chamada da classe `1` foi aberta para a data atual.
- A segunda chamada da mesma função retornou o mesmo identificador, confirmando reaproveitamento.

Resultado observado:
- `chamada_classe_1_repetida = 11`

### 2) Matrícula de aluno
- Foi matriculada a pessoa `4` com a matrícula `ALU9999` na classe `4`.

Resultado observado:
- a função retornou o novo vínculo de aluno com sucesso.

### 3) Consultas de leitura
As consultas de leitura retornaram dados coerentes:

- alunos da classe `1` e da classe `4`;
- aniversariantes do período;
- chamada da classe `1`;
- histórico do aluno recém-matriculado;
- cálculo de aniversário em ano bissexto;
- resumo da classe;
- resumo geral da chamada.

### 4) Rotinas de alteração da chamada
O bloco `DO $$ ... $$;` executou as funções de alteração com tratamento de erro via `EXCEPTION`:

- registrou oferta;
- registrou visitante;
- marcou presença;
- marcou atraso;
- marcou todos presentes;
- marcou todos ausentes;
- fechou a chamada;
- reabriu a chamada.

Os `NOTICE` confirmaram que cada função foi chamada com sucesso no contexto do teste.

### 5) Validação após as alterações
Depois das funções de alteração, as consultas mostraram:

- a chamada permaneceu disponível para leitura;
- a oferta passou para `123.45`;
- o total de visitantes passou para `1`;
- os totais da chamada continuaram consistentes.

### 6) Trigger de atualização
Foi feito um `UPDATE` em `ebd_pessoa` apenas para disparar o trigger de atualização.

Resultado observado:
- `atualizado_em` mudou após o `UPDATE`, confirmando que o trigger foi acionado.

## Saída resumida observada

- `fn_ebd_abrir_chamada`: criou/reutilizou a chamada `11`.
- `fn_ebd_matricular_aluno`: criou a matrícula do aluno `ALU9999`.
- `fn_ebd_aniversariantes`: retornou aniversariantes no período filtrado.
- `fn_ebd_chamada_classe`: mostrou a chamada `11` da classe `1`.
- `fn_ebd_resumo_classe`: exibiu os totais da classe.
- `fn_ebd_resumo_chamada`: exibiu os totais gerais.
- `fn_ebd_registrar_oferta`: registrou `123.45`.
- `fn_ebd_registrar_visitante`: registrou `1` visitante.
- `fn_ebd_marcar_presenca`, `fn_ebd_todos_presentes`, `fn_ebd_todos_ausentes`, `fn_ebd_fechar_chamada`, `fn_ebd_reabrir_chamada`: executadas com `NOTICE` de sucesso.
- `fn_ebd_set_atualizado_em` (trigger): atualizou o campo `atualizado_em` após o `UPDATE`.

## Trecho copiável

```sql
DO $$
DECLARE
    v_id_chamada bigint;
BEGIN
    SELECT id
      INTO v_id_chamada
      FROM tmp_ebd_exec_ctx
     WHERE chave = 'chamada_classe_1';

    BEGIN
        PERFORM public.fn_ebd_registrar_oferta(v_id_chamada, 123.45);
        RAISE NOTICE 'fn_ebd_registrar_oferta executada na chamada %', v_id_chamada;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'fn_ebd_registrar_oferta falhou: %', SQLERRM;
    END;

    BEGIN
        PERFORM public.fn_ebd_registrar_visitante(v_id_chamada, 'Carlos Teste', 'Visitante para validação');
        RAISE NOTICE 'fn_ebd_registrar_visitante executada na chamada %', v_id_chamada;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'fn_ebd_registrar_visitante falhou: %', SQLERRM;
    END;

    BEGIN
        PERFORM public.fn_ebd_marcar_presenca(v_id_chamada, 1, 'presente');
        RAISE NOTICE 'fn_ebd_marcar_presenca executada para id_aluno_classe 1';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'fn_ebd_marcar_presenca (presente) falhou: %', SQLERRM;
    END;

    BEGIN
        PERFORM public.fn_ebd_marcar_presenca(v_id_chamada, 2, 'atrasado');
        RAISE NOTICE 'fn_ebd_marcar_presenca executada para id_aluno_classe 2';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'fn_ebd_marcar_presenca (atrasado) falhou: %', SQLERRM;
    END;

    BEGIN
        PERFORM public.fn_ebd_todos_presentes(v_id_chamada);
        RAISE NOTICE 'fn_ebd_todos_presentes executada na chamada %', v_id_chamada;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'fn_ebd_todos_presentes falhou: %', SQLERRM;
    END;

    BEGIN
        PERFORM public.fn_ebd_todos_ausentes(v_id_chamada);
        RAISE NOTICE 'fn_ebd_todos_ausentes executada na chamada %', v_id_chamada;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'fn_ebd_todos_ausentes falhou: %', SQLERRM;
    END;

    BEGIN
        PERFORM public.fn_ebd_fechar_chamada(v_id_chamada);
        RAISE NOTICE 'fn_ebd_fechar_chamada executada na chamada %', v_id_chamada;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'fn_ebd_fechar_chamada falhou: %', SQLERRM;
    END;

    BEGIN
        PERFORM public.fn_ebd_reabrir_chamada(v_id_chamada);
        RAISE NOTICE 'fn_ebd_reabrir_chamada executada na chamada %', v_id_chamada;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'fn_ebd_reabrir_chamada falhou: %', SQLERRM;
    END;
END
$$;
```

## Observação final

Como o script terminou com `ROLLBACK`, esse teste é seguro para validação local e não deixa dados gravados.
