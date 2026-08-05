--
-- PostgreSQL database dump
--

\restrict bGRjZxZJx0tTFzXl5xV02lLYYpYhYQNXA3Ope9HewnBifk8s8EBFO4LXlbKPyqC

-- Dumped from database version 18.2
-- Dumped by pg_dump version 18.2

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: neon_auth; Type: SCHEMA; Schema: -; Owner: u0_a377
--

CREATE SCHEMA neon_auth;


ALTER SCHEMA neon_auth OWNER TO u0_a377;

--
-- Name: pgrst; Type: SCHEMA; Schema: -; Owner: u0_a377
--

CREATE SCHEMA pgrst;


ALTER SCHEMA pgrst OWNER TO u0_a377;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS '';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: pre_config(); Type: FUNCTION; Schema: pgrst; Owner: u0_a377
--

CREATE FUNCTION pgrst.pre_config() RETURNS void
    LANGUAGE sql
    SET search_path TO ''
    AS $$
  SELECT
      set_config('pgrst.db_schemas', 'public', true)
    , set_config('pgrst.db_aggregates_enabled', 'true', true)
    , set_config('pgrst.db_anon_role', 'anonymous', true)
    , set_config('pgrst.jwt_role_claim_key', '.role', true)
$$;


ALTER FUNCTION pgrst.pre_config() OWNER TO u0_a377;

--
-- Name: fn_ebd_abrir_chamada(bigint, date); Type: FUNCTION; Schema: public; Owner: u0_a377
--

CREATE FUNCTION public.fn_ebd_abrir_chamada(p_id_classe bigint, p_data_chamada date) RETURNS bigint
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_id_chamada BIGINT;
BEGIN
    SELECT c.id_chamada
      INTO v_id_chamada
      FROM ebd_chamada c
     WHERE c.id_classe = p_id_classe
       AND c.data_chamada = p_data_chamada;

    IF FOUND THEN
        RETURN v_id_chamada;
    END IF;

    INSERT INTO ebd_chamada (
        id_classe,
        data_chamada
    )
    VALUES (
        p_id_classe,
        p_data_chamada
    )
    RETURNING id_chamada
      INTO v_id_chamada;

    INSERT INTO ebd_chamada_aluno (
        id_chamada,
        id_aluno_classe,
        status
    )
    SELECT
        v_id_chamada,
        ac.id_aluno_classe,
        'ausente'
    FROM ebd_aluno_classe ac
    INNER JOIN ebd_aluno a
        ON a.id_aluno = ac.id_aluno
    WHERE ac.id_classe = p_id_classe
      AND ac.ativo = TRUE
      AND a.status = 'ativo'
    ON CONFLICT (id_chamada, id_aluno_classe) DO NOTHING;

    RETURN v_id_chamada;
END;
$$;


ALTER FUNCTION public.fn_ebd_abrir_chamada(p_id_classe bigint, p_data_chamada date) OWNER TO u0_a377;

--
-- Name: fn_ebd_alterar_status_chamada(bigint, bigint, text); Type: FUNCTION; Schema: public; Owner: u0_a377
--

CREATE FUNCTION public.fn_ebd_alterar_status_chamada(p_id_chamada bigint, p_id_aluno_classe bigint, p_status text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_data_chamada date;
    v_fechada boolean;
    v_status_aluno text;
BEGIN
    IF p_status NOT IN ('presente', 'atrasado', 'ausente') THEN
        RAISE EXCEPTION
            'Status inválido. Use: presente, atrasado ou ausente.';
    END IF;

    SELECT
        c.data_chamada,
        c.fechada
    INTO
        v_data_chamada,
        v_fechada
    FROM public.ebd_chamada c
    WHERE c.id_chamada = p_id_chamada;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Chamada % não encontrada.', p_id_chamada;
    END IF;

    IF v_fechada THEN
        RAISE EXCEPTION 'Chamada % está fechada.', p_id_chamada;
    END IF;

    IF v_data_chamada <> CURRENT_DATE THEN
        RAISE EXCEPTION
            'Só é permitido modificar chamada do dia atual (%). Data da chamada: %.',
            CURRENT_DATE,
            v_data_chamada;
    END IF;

    SELECT a.status
      INTO v_status_aluno
      FROM public.ebd_aluno_classe ac
      INNER JOIN public.ebd_aluno a
        ON a.id_aluno = ac.id_aluno
     WHERE ac.id_aluno_classe = p_id_aluno_classe;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Aluno da classe % não encontrado.',
            p_id_aluno_classe;
    END IF;

    IF v_status_aluno <> 'ativo' THEN
        RAISE EXCEPTION
            'Aluno inativo não pode ser marcado na chamada.';
    END IF;

    UPDATE public.ebd_chamada_aluno
       SET status = p_status
     WHERE id_chamada = p_id_chamada
       AND id_aluno_classe = p_id_aluno_classe;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Registro da chamada % para o aluno_classe % não encontrado.',
            p_id_chamada,
            p_id_aluno_classe;
    END IF;

    IF p_status = 'ausente' THEN
        PERFORM public.fn_ebd_processar_inativacao_por_faltas(p_id_chamada);
    END IF;
END;
$$;


ALTER FUNCTION public.fn_ebd_alterar_status_chamada(p_id_chamada bigint, p_id_aluno_classe bigint, p_status text) OWNER TO u0_a377;

--
-- Name: fn_ebd_alunos_classe(bigint); Type: FUNCTION; Schema: public; Owner: u0_a377
--

CREATE FUNCTION public.fn_ebd_alunos_classe(p_id_classe bigint) RETURNS TABLE(id_aluno bigint, id_pessoa bigint, nome text, matricula text, status text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id_aluno,
        p.id_pessoa,
        p.nome,
        a.matricula,
        a.status
    FROM ebd_aluno a
    INNER JOIN ebd_pessoa p
        ON p.id_pessoa = a.id_pessoa
    INNER JOIN ebd_aluno_classe ac
        ON ac.id_aluno = a.id_aluno
    WHERE ac.id_classe = p_id_classe
      AND ac.ativo = TRUE
      AND a.status = 'ativo'
    ORDER BY p.nome;
END;
$$;


ALTER FUNCTION public.fn_ebd_alunos_classe(p_id_classe bigint) OWNER TO u0_a377;

--
-- Name: fn_ebd_alunos_inativos(bigint); Type: FUNCTION; Schema: public; Owner: u0_a377
--

CREATE FUNCTION public.fn_ebd_alunos_inativos(p_id_classe bigint DEFAULT NULL::bigint) RETURNS TABLE(id_aluno bigint, id_pessoa bigint, nome text, matricula text, status text, id_classe bigint, classe text, data_inicio date, data_desligamento date, motivo_desligamento text, observacao text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id_aluno,
        p.id_pessoa,
        p.nome,
        a.matricula,
        a.status,
        ac.id_classe,
        cl.nome AS classe,
        ac.data_inicio,
        a.data_desligamento,
        a.motivo_desligamento,
        a.observacao
    FROM public.ebd_aluno a
    INNER JOIN public.ebd_pessoa p
        ON p.id_pessoa = a.id_pessoa
    LEFT JOIN public.ebd_aluno_classe ac
        ON ac.id_aluno = a.id_aluno
       AND ac.ativo = TRUE
    LEFT JOIN public.ebd_classe cl
        ON cl.id_classe = ac.id_classe
    WHERE a.status = 'inativo'
      AND (
            p_id_classe IS NULL
            OR ac.id_classe = p_id_classe
          )
    ORDER BY cl.nome NULLS LAST, p.nome;
END;
$$;


ALTER FUNCTION public.fn_ebd_alunos_inativos(p_id_classe bigint) OWNER TO u0_a377;

--
-- Name: fn_ebd_aniversariantes(date); Type: FUNCTION; Schema: public; Owner: u0_a377
--

CREATE FUNCTION public.fn_ebd_aniversariantes(p_data_referencia date) RETURNS TABLE(periodo text, id_pessoa bigint, nome text, data_nascimento date, aniversario_no_ano date, idade integer)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_ano INTEGER := EXTRACT(YEAR FROM p_data_referencia)::INTEGER;
BEGIN
    RETURN QUERY
    WITH base AS (
        SELECT
            p.id_pessoa,
            p.nome,
            p.data_nascimento,
            fn_ebd_data_aniversario_no_ano(p.data_nascimento, v_ano) AS aniversario_no_ano,
            EXTRACT(YEAR FROM AGE(p_data_referencia, p.data_nascimento))::INTEGER AS idade
        FROM ebd_pessoa p
        WHERE p.data_nascimento IS NOT NULL
    )
    SELECT
        'semana_passada'::TEXT AS periodo,
        b.id_pessoa,
        b.nome,
        b.data_nascimento,
        b.aniversario_no_ano,
        b.idade
    FROM base b
    WHERE b.aniversario_no_ano BETWEEN (p_data_referencia - INTERVAL '7 days')::DATE
                                   AND (p_data_referencia - INTERVAL '1 day')::DATE

    UNION ALL

    SELECT
        'semana_seguinte'::TEXT AS periodo,
        b.id_pessoa,
        b.nome,
        b.data_nascimento,
        b.aniversario_no_ano,
        b.idade
    FROM base b
    WHERE b.aniversario_no_ano BETWEEN (p_data_referencia + INTERVAL '1 day')::DATE
                                   AND (p_data_referencia + INTERVAL '7 days')::DATE

    UNION ALL

    SELECT
        'mes_atual'::TEXT AS periodo,
        b.id_pessoa,
        b.nome,
        b.data_nascimento,
        b.aniversario_no_ano,
        b.idade
    FROM base b
    WHERE EXTRACT(MONTH FROM b.data_nascimento) = EXTRACT(MONTH FROM p_data_referencia)

    UNION ALL

    SELECT
        'trimestre_atual'::TEXT AS periodo,
        b.id_pessoa,
        b.nome,
        b.data_nascimento,
        b.aniversario_no_ano,
        b.idade
    FROM base b
    WHERE EXTRACT(QUARTER FROM b.data_nascimento) = EXTRACT(QUARTER FROM p_data_referencia)

    ORDER BY periodo, aniversario_no_ano, nome;
END;
$$;


ALTER FUNCTION public.fn_ebd_aniversariantes(p_data_referencia date) OWNER TO u0_a377;

--
-- Name: fn_ebd_aniversariantes(date, bigint); Type: FUNCTION; Schema: public; Owner: u0_a377
--

CREATE FUNCTION public.fn_ebd_aniversariantes(p_data_referencia date, p_id_cadastro bigint) RETURNS TABLE(periodo text, id_pessoa bigint, nome text, data_nascimento date, aniversario_no_ano date, idade integer)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_ano INTEGER := EXTRACT(YEAR FROM p_data_referencia)::INTEGER;
BEGIN
    RETURN QUERY
    WITH base AS (
        SELECT
            p.id_pessoa,
            p.nome,
            p.data_nascimento,
            fn_ebd_data_aniversario_no_ano(p.data_nascimento, v_ano) AS aniversario_no_ano,
            EXTRACT(YEAR FROM AGE(p_data_referencia, p.data_nascimento))::INTEGER AS idade
        FROM ebd_pessoa p
        WHERE p.data_nascimento IS NOT NULL
          AND p.id_cadastro = p_id_cadastro
    )
    SELECT
        'semana_passada'::TEXT AS periodo,
        b.id_pessoa,
        b.nome,
        b.data_nascimento,
        b.aniversario_no_ano,
        b.idade
    FROM base b
    WHERE b.aniversario_no_ano BETWEEN (p_data_referencia - INTERVAL '7 days')::DATE
                                   AND (p_data_referencia - INTERVAL '1 day')::DATE

    UNION ALL

    SELECT
        'semana_seguinte'::TEXT AS periodo,
        b.id_pessoa,
        b.nome,
        b.data_nascimento,
        b.aniversario_no_ano,
        b.idade
    FROM base b
    WHERE b.aniversario_no_ano BETWEEN (p_data_referencia + INTERVAL '1 day')::DATE
                                   AND (p_data_referencia + INTERVAL '7 days')::DATE

    UNION ALL

    SELECT
        'mes_atual'::TEXT AS periodo,
        b.id_pessoa,
        b.nome,
        b.data_nascimento,
        b.aniversario_no_ano,
        b.idade
    FROM base b
    WHERE EXTRACT(MONTH FROM b.data_nascimento) = EXTRACT(MONTH FROM p_data_referencia)

    UNION ALL

    SELECT
        'trimestre_atual'::TEXT AS periodo,
        b.id_pessoa,
        b.nome,
        b.data_nascimento,
        b.aniversario_no_ano,
        b.idade
    FROM base b
    WHERE EXTRACT(QUARTER FROM b.data_nascimento) = EXTRACT(QUARTER FROM p_data_referencia)

    ORDER BY periodo, aniversario_no_ano, nome;
END;
$$;


ALTER FUNCTION public.fn_ebd_aniversariantes(p_data_referencia date, p_id_cadastro bigint) OWNER TO u0_a377;

--
-- Name: fn_ebd_ativar_aluno(bigint, text); Type: FUNCTION; Schema: public; Owner: u0_a377
--

CREATE FUNCTION public.fn_ebd_ativar_aluno(p_id_aluno bigint, p_observacao text DEFAULT ''::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM public.fn_ebd_registrar_status_aluno(
        p_id_aluno,
        'ativo',
        'manual',
        ''::text,
        p_observacao,
        NULL::bigint,
        NULL::bigint
    );
END;
$$;


ALTER FUNCTION public.fn_ebd_ativar_aluno(p_id_aluno bigint, p_observacao text) OWNER TO u0_a377;

--
-- Name: fn_ebd_chamada_classe(bigint, date); Type: FUNCTION; Schema: public; Owner: u0_a377
--

CREATE FUNCTION public.fn_ebd_chamada_classe(p_id_classe bigint, p_data_chamada date) RETURNS TABLE(id_chamada bigint, id_chamada_aluno bigint, id_classe bigint, classe text, data_chamada date, id_aluno_classe bigint, id_aluno bigint, id_pessoa bigint, matricula text, aluno text, status text, observacao text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id_chamada,
        ca.id_chamada_aluno,
        c.id_classe,
        cl.nome AS classe,
        c.data_chamada,
        ac.id_aluno_classe,
        a.id_aluno,
        p.id_pessoa,
        a.matricula,
        p.nome AS aluno,
        ca.status,
        ca.observacao
    FROM ebd_chamada c
    INNER JOIN ebd_classe cl
        ON cl.id_classe = c.id_classe
    INNER JOIN ebd_chamada_aluno ca
        ON ca.id_chamada = c.id_chamada
    INNER JOIN ebd_aluno_classe ac
        ON ac.id_aluno_classe = ca.id_aluno_classe
    INNER JOIN ebd_aluno a
        ON a.id_aluno = ac.id_aluno
    INNER JOIN ebd_pessoa p
        ON p.id_pessoa = a.id_pessoa
    WHERE c.id_classe = p_id_classe
      AND c.data_chamada = p_data_chamada
    ORDER BY p.nome;
END;
$$;


ALTER FUNCTION public.fn_ebd_chamada_classe(p_id_classe bigint, p_data_chamada date) OWNER TO u0_a377;

--
-- Name: fn_ebd_classes_do_cadastro(bigint, date); Type: FUNCTION; Schema: public; Owner: u0_a377
--

CREATE FUNCTION public.fn_ebd_classes_do_cadastro(p_id_cadastro bigint, p_data_chamada date DEFAULT CURRENT_DATE) RETURNS TABLE(id_classe bigint, nome text, faixa_etaria text, descricao text, ativo boolean, criado_em timestamp with time zone, id_cadastro bigint, total_alunos_ativos bigint, chamada_ja_feita boolean, id_chamada bigint, chamada_fechada boolean)
    LANGUAGE sql STABLE
    AS $$
SELECT
    cl.id_classe,
    cl.nome,
    cl.faixa_etaria,
    cl.descricao,
    cl.ativo,
    cl.criado_em,
    cl.id_cadastro,
    COALESCE(al.total_alunos_ativos, 0)::bigint AS total_alunos_ativos,
    COALESCE(ch.chamada_ja_feita, FALSE) AS chamada_ja_feita,
    ch.id_chamada,
    COALESCE(ch.chamada_fechada, FALSE) AS chamada_fechada
FROM public.ebd_classe cl
LEFT JOIN LATERAL (
    SELECT COUNT(*)::bigint AS total_alunos_ativos
    FROM public.ebd_aluno_classe ac
    INNER JOIN public.ebd_aluno a
        ON a.id_aluno = ac.id_aluno
    WHERE ac.id_classe = cl.id_classe
      AND ac.ativo = TRUE
      AND a.status = 'ativo'
) al ON TRUE
LEFT JOIN LATERAL (
    SELECT
        ch.id_chamada,
        ch.fechada AS chamada_fechada,
        (COUNT(*) FILTER (WHERE ca.status IN ('presente', 'atrasado')) > 0) AS chamada_ja_feita
    FROM public.ebd_chamada ch
    LEFT JOIN public.ebd_chamada_aluno ca
        ON ca.id_chamada = ch.id_chamada
    WHERE ch.id_classe = cl.id_classe
      AND ch.data_chamada = p_data_chamada
    GROUP BY
        ch.id_chamada,
        ch.fechada
) ch ON TRUE
WHERE cl.id_cadastro = p_id_cadastro
ORDER BY cl.nome ASC;
$$;


ALTER FUNCTION public.fn_ebd_classes_do_cadastro(p_id_cadastro bigint, p_data_chamada date) OWNER TO u0_a377;

--
-- Name: fn_ebd_criar_classes_padrao(bigint); Type: FUNCTION; Schema: public; Owner: u0_a377
--

CREATE FUNCTION public.fn_ebd_criar_classes_padrao(p_id_cadastro bigint) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF p_id_cadastro IS NULL THEN
        RAISE EXCEPTION 'p_id_cadastro não pode ser nulo.';
    END IF;

    INSERT INTO public.ebd_classe (
        id_cadastro,
        nome,
        faixa_etaria,
        descricao,
        ativo
    )
    VALUES
        (p_id_cadastro, 'Crianças Menores', '4 a 7 anos', 'Classe destinada às crianças menores.', true),
        (p_id_cadastro, 'Crianças Maiores',  '8 a 11 anos', 'Classe destinada às crianças maiores.', true),
        (p_id_cadastro, 'Adolescentes',      '12 a 17 anos', 'Classe destinada aos adolescentes.', true),
        (p_id_cadastro, 'Jovens',             '18 a 29 anos', 'Classe destinada aos jovens.', true),
        (p_id_cadastro, 'Senhores',           '30 anos ou mais', 'Classe destinada aos homens adultos.', true),
        (p_id_cadastro, 'Senhoras',           '30 anos ou mais', 'Classe destinada às mulheres adultas.', true)
    ON CONFLICT (id_cadastro, lower(btrim(nome))) DO NOTHING;
END;
$$;


ALTER FUNCTION public.fn_ebd_criar_classes_padrao(p_id_cadastro bigint) OWNER TO u0_a377;

--
-- Name: fn_ebd_data_aniversario_no_ano(date, integer); Type: FUNCTION; Schema: public; Owner: u0_a377
--

CREATE FUNCTION public.fn_ebd_data_aniversario_no_ano(p_data_nascimento date, p_ano integer) RETURNS date
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    v_mes INTEGER;
    v_dia INTEGER;
BEGIN
    v_mes := EXTRACT(MONTH FROM p_data_nascimento)::INTEGER;
    v_dia := EXTRACT(DAY FROM p_data_nascimento)::INTEGER;

    IF v_mes = 2 AND v_dia = 29 THEN
        IF (p_ano % 4 = 0 AND (p_ano % 100 <> 0 OR p_ano % 400 = 0)) THEN
            RETURN MAKE_DATE(p_ano, 2, 29);
        ELSE
            RETURN MAKE_DATE(p_ano, 2, 28);
        END IF;
    END IF;

    RETURN MAKE_DATE(p_ano, v_mes, v_dia);
END;
$$;


ALTER FUNCTION public.fn_ebd_data_aniversario_no_ano(p_data_nascimento date, p_ano integer) OWNER TO u0_a377;

--
-- Name: fn_ebd_fechar_chamada(bigint); Type: FUNCTION; Schema: public; Owner: u0_a377
--

CREATE FUNCTION public.fn_ebd_fechar_chamada(p_id_chamada bigint) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_data_chamada date;
    v_fechada boolean;
BEGIN
    SELECT c.data_chamada, c.fechada
      INTO v_data_chamada, v_fechada
      FROM public.ebd_chamada c
     WHERE c.id_chamada = p_id_chamada;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Chamada % não encontrada.', p_id_chamada;
    END IF;

    IF v_data_chamada <> CURRENT_DATE THEN
        RAISE EXCEPTION 'Só é permitido fechar chamada do dia atual (%). Data da chamada: %.',
            CURRENT_DATE, v_data_chamada;
    END IF;

    UPDATE public.ebd_chamada
       SET fechada = TRUE,
           fechado_em = NOW()
     WHERE id_chamada = p_id_chamada;

    PERFORM public.fn_ebd_processar_inativacao_por_faltas(p_id_chamada);
END;
$$;


ALTER FUNCTION public.fn_ebd_fechar_chamada(p_id_chamada bigint) OWNER TO u0_a377;

--
-- Name: fn_ebd_historico_aluno(bigint); Type: FUNCTION; Schema: public; Owner: u0_a377
--

CREATE FUNCTION public.fn_ebd_historico_aluno(p_id_aluno bigint) RETURNS TABLE(id_aluno bigint, id_pessoa bigint, nome text, matricula text, status_aluno text, id_aluno_classe bigint, id_classe bigint, classe text, data_inicio date, data_fim date, ativo_classe boolean, motivo text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id_aluno,
        p.id_pessoa,
        p.nome,
        a.matricula,
        a.status AS status_aluno,
        ac.id_aluno_classe,
        c.id_classe,
        c.nome AS classe,
        ac.data_inicio,
        ac.data_fim,
        ac.ativo AS ativo_classe,
        ac.motivo
    FROM ebd_aluno a
    INNER JOIN ebd_pessoa p
        ON p.id_pessoa = a.id_pessoa
    INNER JOIN ebd_aluno_classe ac
        ON ac.id_aluno = a.id_aluno
    INNER JOIN ebd_classe c
        ON c.id_classe = ac.id_classe
    WHERE a.id_aluno = p_id_aluno
    ORDER BY ac.data_inicio DESC, ac.id_aluno_classe DESC;
END;
$$;


ALTER FUNCTION public.fn_ebd_historico_aluno(p_id_aluno bigint) OWNER TO u0_a377;

--
-- Name: fn_ebd_historico_status_aluno(bigint); Type: FUNCTION; Schema: public; Owner: u0_a377
--

CREATE FUNCTION public.fn_ebd_historico_status_aluno(p_id_aluno bigint) RETURNS TABLE(id_aluno_status_historico bigint, id_aluno bigint, nome text, status_anterior text, status_novo text, origem text, motivo text, observacao text, id_chamada bigint, data_chamada date, id_chamada_aluno bigint, criado_em timestamp with time zone, criado_por text)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        h.id_aluno_status_historico,
        h.id_aluno,
        p.nome,
        h.status_anterior,
        h.status_novo,
        h.origem,
        h.motivo,
        h.observacao,
        h.id_chamada,
        c.data_chamada,
        h.id_chamada_aluno,
        h.criado_em,
        h.criado_por
    FROM public.ebd_aluno_status_historico h
    INNER JOIN public.ebd_aluno a
        ON a.id_aluno = h.id_aluno
    INNER JOIN public.ebd_pessoa p
        ON p.id_pessoa = a.id_pessoa
    LEFT JOIN public.ebd_chamada c
        ON c.id_chamada = h.id_chamada
    WHERE h.id_aluno = p_id_aluno
    ORDER BY h.criado_em DESC, h.id_aluno_status_historico DESC;
END;
$$;


ALTER FUNCTION public.fn_ebd_historico_status_aluno(p_id_aluno bigint) OWNER TO u0_a377;

--
-- Name: fn_ebd_inativar_aluno(bigint, text, text); Type: FUNCTION; Schema: public; Owner: u0_a377
--

CREATE FUNCTION public.fn_ebd_inativar_aluno(p_id_aluno bigint, p_motivo text, p_observacao text DEFAULT ''::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM public.fn_ebd_registrar_status_aluno(
        p_id_aluno,
        'inativo',
        'manual',
        p_motivo,
        p_observacao,
        NULL::bigint,
        NULL::bigint
    );
END;
$$;


ALTER FUNCTION public.fn_ebd_inativar_aluno(p_id_aluno bigint, p_motivo text, p_observacao text) OWNER TO u0_a377;

--
-- Name: fn_ebd_matricular_aluno(bigint, text, bigint, date, text); Type: FUNCTION; Schema: public; Owner: u0_a377
--

CREATE FUNCTION public.fn_ebd_matricular_aluno(p_id_pessoa bigint, p_matricula text, p_id_classe bigint, p_data_inicio date DEFAULT CURRENT_DATE, p_observacao text DEFAULT ''::text) RETURNS bigint
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_id_aluno BIGINT;
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM ebd_pessoa p
         WHERE p.id_pessoa = p_id_pessoa
    ) THEN
        RAISE EXCEPTION 'Pessoa % não encontrada.', p_id_pessoa;
    END IF;

    IF EXISTS (
        SELECT 1
          FROM ebd_aluno a
         WHERE a.id_pessoa = p_id_pessoa
    ) THEN
        RAISE EXCEPTION 'A pessoa % já está matriculada como aluno.', p_id_pessoa;
    END IF;

    INSERT INTO ebd_aluno (
        id_pessoa,
        matricula,
        status,
        data_cadastro,
        observacao
    )
    VALUES (
        p_id_pessoa,
        COALESCE(p_matricula, ''),
        'ativo',
        CURRENT_DATE,
        p_observacao
    )
    RETURNING id_aluno
      INTO v_id_aluno;

    INSERT INTO ebd_aluno_classe (
        id_aluno,
        id_classe,
        data_inicio,
        motivo,
        ativo
    )
    VALUES (
        v_id_aluno,
        p_id_classe,
        COALESCE(p_data_inicio, CURRENT_DATE),
        'Matriculado pelo sistema',
        TRUE
    );

    RETURN v_id_aluno;
END;
$$;


ALTER FUNCTION public.fn_ebd_matricular_aluno(p_id_pessoa bigint, p_matricula text, p_id_classe bigint, p_data_inicio date, p_observacao text) OWNER TO u0_a377;

--
-- Name: fn_ebd_processar_inativacao_por_faltas(bigint); Type: FUNCTION; Schema: public; Owner: u0_a377
--

CREATE FUNCTION public.fn_ebd_processar_inativacao_por_faltas(p_id_chamada bigint) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_total_inativados integer := 0;
    r RECORD;
    v_data_chamada date;
BEGIN
    SELECT c.data_chamada
      INTO v_data_chamada
      FROM public.ebd_chamada c
     WHERE c.id_chamada = p_id_chamada;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Chamada % não encontrada.', p_id_chamada;
    END IF;

    FOR r IN
        SELECT
            ca.id_chamada_aluno,
            ca.id_aluno_classe,
            a.id_aluno
        FROM public.ebd_chamada_aluno ca
        INNER JOIN public.ebd_aluno_classe ac
            ON ac.id_aluno_classe = ca.id_aluno_classe
        INNER JOIN public.ebd_aluno a
            ON a.id_aluno = ac.id_aluno
        WHERE ca.id_chamada = p_id_chamada
          AND ca.status = 'ausente'
          AND a.status = 'ativo'
    LOOP
        IF public.fn_ebd_tem_4_faltas_consecutivas(r.id_aluno_classe) THEN
            PERFORM public.fn_ebd_registrar_status_aluno(
                r.id_aluno,
                'inativo',
                'automatica',
                '4 faltas consecutivas',
                format(
                    'Inativado automaticamente em %s após 4 faltas consecutivas.',
                    v_data_chamada
                ),
                p_id_chamada,
                r.id_chamada_aluno
            );
            v_total_inativados := v_total_inativados + 1;
        END IF;
    END LOOP;

    RETURN v_total_inativados;
END;
$$;


ALTER FUNCTION public.fn_ebd_processar_inativacao_por_faltas(p_id_chamada bigint) OWNER TO u0_a377;

--
-- Name: fn_ebd_ranking_oferta(date); Type: FUNCTION; Schema: public; Owner: u0_a377
--

CREATE FUNCTION public.fn_ebd_ranking_oferta(p_data_chamada date) RETURNS TABLE(id_classe bigint, classe text, valor_oferta numeric, posicao integer, resultado text)
    LANGUAGE sql
    AS $$
WITH base AS (
    SELECT
        c.id_classe,
        cl.nome AS classe,
        COALESCE(SUM(c.oferta), 0)::numeric(10,2) AS valor_oferta
    FROM ebd_chamada c
    INNER JOIN ebd_classe cl
        ON cl.id_classe = c.id_classe
    WHERE c.data_chamada = p_data_chamada
    GROUP BY
        c.id_classe,
        cl.nome
),
topo AS (
    SELECT MAX(valor_oferta) AS maior_valor
    FROM base
),
empate AS (
    SELECT COUNT(*)::bigint AS qtd
    FROM base
    WHERE valor_oferta = (SELECT maior_valor FROM topo)
)
SELECT
    b.id_classe,
    b.classe,
    b.valor_oferta,
    ROW_NUMBER() OVER (ORDER BY b.valor_oferta DESC, b.classe ASC)::integer AS posicao,
    CASE
        WHEN b.valor_oferta = (SELECT maior_valor FROM topo)
             AND (SELECT qtd FROM empate) > 1
            THEN 'empate na liderança'
        WHEN b.valor_oferta = (SELECT maior_valor FROM topo)
            THEN 'vencedora'
        ELSE 'participante'
    END AS resultado
FROM base b
ORDER BY b.valor_oferta DESC, b.classe ASC;
$$;


ALTER FUNCTION public.fn_ebd_ranking_oferta(p_data_chamada date) OWNER TO u0_a377;

--
-- Name: fn_ebd_ranking_oferta(date, bigint); Type: FUNCTION; Schema: public; Owner: u0_a377
--

CREATE FUNCTION public.fn_ebd_ranking_oferta(p_data_chamada date, p_id_cadastro bigint) RETURNS TABLE(id_classe bigint, classe text, valor_oferta numeric, posicao integer, resultado text)
    LANGUAGE sql
    AS $$
WITH tenant_classes AS (
    SELECT id_classe, nome
    FROM ebd_classe
    WHERE id_cadastro = p_id_cadastro
),
base AS (
    SELECT
        c.id_classe,
        tc.nome AS classe,
        COALESCE(SUM(c.oferta), 0)::numeric(10,2) AS valor_oferta
    FROM ebd_chamada c
    INNER JOIN tenant_classes tc
        ON tc.id_classe = c.id_classe
    WHERE c.data_chamada = p_data_chamada
    GROUP BY
        c.id_classe,
        tc.nome
),
topo AS (
    SELECT MAX(valor_oferta) AS maior_valor
    FROM base
),
empate AS (
    SELECT COUNT(*)::bigint AS qtd
    FROM base
    WHERE valor_oferta = (SELECT maior_valor FROM topo)
)
SELECT
    b.id_classe,
    b.classe,
    b.valor_oferta,
    ROW_NUMBER() OVER (ORDER BY b.valor_oferta DESC, b.classe ASC)::integer AS posicao,
    CASE
        WHEN b.valor_oferta = (SELECT maior_valor FROM topo)
             AND (SELECT qtd FROM empate) > 1
            THEN 'empate na liderança'
        WHEN b.valor_oferta = (SELECT maior_valor FROM topo)
            THEN 'vencedora'
        ELSE 'participante'
    END AS resultado
FROM base b
ORDER BY b.valor_oferta DESC, b.classe ASC;
$$;


ALTER FUNCTION public.fn_ebd_ranking_oferta(p_data_chamada date, p_id_cadastro bigint) OWNER TO u0_a377;

--
-- Name: fn_ebd_ranking_presenca(date); Type: FUNCTION; Schema: public; Owner: u0_a377
--

CREATE FUNCTION public.fn_ebd_ranking_presenca(p_data_chamada date) RETURNS TABLE(id_classe bigint, classe text, total_alunos bigint, presentes bigint, atrasados bigint, ausentes bigint, percentual_presenca numeric, posicao integer, resultado text)
    LANGUAGE sql
    AS $$
WITH base AS (
    SELECT
        c.id_classe,
        cl.nome AS classe,
        COUNT(*)::bigint AS total_alunos,
        COUNT(*) FILTER (WHERE ca.status IN ('presente', 'atrasado'))::bigint AS presentes,
        COUNT(*) FILTER (WHERE ca.status = 'atrasado')::bigint AS atrasados,
        COUNT(*) FILTER (WHERE ca.status = 'ausente')::bigint AS ausentes,
        ROUND(
            (
                COUNT(*) FILTER (WHERE ca.status IN ('presente', 'atrasado'))::numeric * 100
            ) / NULLIF(COUNT(*), 0),
            1
        )::numeric(5,1) AS percentual_presenca
    FROM public.ebd_chamada c
    INNER JOIN public.ebd_classe cl
        ON cl.id_classe = c.id_classe
    INNER JOIN public.ebd_chamada_aluno ca
        ON ca.id_chamada = c.id_chamada
    INNER JOIN public.ebd_aluno_classe ac
        ON ac.id_aluno_classe = ca.id_aluno_classe
    INNER JOIN public.ebd_aluno a
        ON a.id_aluno = ac.id_aluno
    WHERE c.data_chamada = p_data_chamada
      AND a.status = 'ativo'
    GROUP BY
        c.id_classe,
        cl.nome
),
topo AS (
    SELECT MAX(percentual_presenca) AS maior_valor
    FROM base
),
empate AS (
    SELECT COUNT(*)::bigint AS qtd
    FROM base
    WHERE percentual_presenca = (SELECT maior_valor FROM topo)
)
SELECT
    b.id_classe,
    b.classe,
    b.total_alunos,
    b.presentes,
    b.atrasados,
    b.ausentes,
    b.percentual_presenca,
    ROW_NUMBER() OVER (ORDER BY b.percentual_presenca DESC, b.classe ASC)::integer AS posicao,
    CASE
        WHEN b.percentual_presenca = (SELECT maior_valor FROM topo)
             AND (SELECT qtd FROM empate) > 1
            THEN 'empate na liderança'
        WHEN b.percentual_presenca = (SELECT maior_valor FROM topo)
            THEN 'vencedora'
        ELSE 'participante'
    END AS resultado
FROM base b
ORDER BY b.percentual_presenca DESC, b.classe ASC;
$$;


ALTER FUNCTION public.fn_ebd_ranking_presenca(p_data_chamada date) OWNER TO u0_a377;

--
-- Name: fn_ebd_ranking_presenca(date, bigint); Type: FUNCTION; Schema: public; Owner: u0_a377
--

CREATE FUNCTION public.fn_ebd_ranking_presenca(p_data_chamada date, p_id_cadastro bigint) RETURNS TABLE(id_classe bigint, classe text, total_alunos bigint, presentes bigint, atrasados bigint, ausentes bigint, percentual_presenca numeric, posicao integer, resultado text)
    LANGUAGE sql
    AS $$
WITH tenant_classes AS (
    SELECT id_classe, nome
    FROM ebd_classe
    WHERE id_cadastro = p_id_cadastro
),
base AS (
    SELECT
        c.id_classe,
        tc.nome AS classe,
        COUNT(*)::bigint AS total_alunos,
        COUNT(*) FILTER (WHERE ca.status IN ('presente', 'atrasado'))::bigint AS presentes,
        COUNT(*) FILTER (WHERE ca.status = 'atrasado')::bigint AS atrasados,
        COUNT(*) FILTER (WHERE ca.status = 'ausente')::bigint AS ausentes,
        ROUND(
            (
                COUNT(*) FILTER (WHERE ca.status IN ('presente', 'atrasado'))::numeric * 100
            ) / NULLIF(COUNT(*), 0),
            1
        )::numeric(5,1) AS percentual_presenca
    FROM ebd_chamada c
    INNER JOIN tenant_classes tc
        ON tc.id_classe = c.id_classe
    INNER JOIN ebd_chamada_aluno ca
        ON ca.id_chamada = c.id_chamada
    INNER JOIN ebd_aluno_classe ac
        ON ac.id_aluno_classe = ca.id_aluno_classe
       AND ac.id_classe = c.id_classe
    INNER JOIN ebd_aluno a
        ON a.id_aluno = ac.id_aluno
    WHERE c.data_chamada = p_data_chamada
      AND a.status = 'ativo'
    GROUP BY
        c.id_classe,
        tc.nome
),
topo AS (
    SELECT MAX(percentual_presenca) AS maior_valor
    FROM base
),
empate AS (
    SELECT COUNT(*)::bigint AS qtd
    FROM base
    WHERE percentual_presenca = (SELECT maior_valor FROM topo)
)
SELECT
    b.id_classe,
    b.classe,
    b.total_alunos,
    b.presentes,
    b.atrasados,
    b.ausentes,
    b.percentual_presenca,
    ROW_NUMBER() OVER (ORDER BY b.percentual_presenca DESC, b.classe ASC)::integer AS posicao,
    CASE
        WHEN b.percentual_presenca = (SELECT maior_valor FROM topo)
             AND (SELECT qtd FROM empate) > 1
            THEN 'empate na liderança'
        WHEN b.percentual_presenca = (SELECT maior_valor FROM topo)
            THEN 'vencedora'
        ELSE 'participante'
    END AS resultado
FROM base b
ORDER BY b.percentual_presenca DESC, b.classe ASC;
$$;


ALTER FUNCTION public.fn_ebd_ranking_presenca(p_data_chamada date, p_id_cadastro bigint) OWNER TO u0_a377;

--
-- Name: fn_ebd_ranking_visitantes(date); Type: FUNCTION; Schema: public; Owner: u0_a377
--

CREATE FUNCTION public.fn_ebd_ranking_visitantes(p_data_chamada date) RETURNS TABLE(id_classe bigint, classe text, visitantes integer, posicao integer, resultado text)
    LANGUAGE sql
    AS $$
WITH base AS (
    SELECT
        c.id_classe,
        cl.nome AS classe,
        COALESCE(c.visitantes, 0)::integer AS visitantes
    FROM ebd_chamada c
    INNER JOIN ebd_classe cl
        ON cl.id_classe = c.id_classe
    WHERE c.data_chamada = p_data_chamada
),
topo AS (
    SELECT MAX(visitantes) AS maior_valor
    FROM base
),
empate AS (
    SELECT COUNT(*)::bigint AS qtd
    FROM base
    WHERE visitantes = (SELECT maior_valor FROM topo)
)
SELECT
    b.id_classe,
    b.classe,
    b.visitantes,
    ROW_NUMBER() OVER (ORDER BY b.visitantes DESC, b.classe ASC)::integer AS posicao,
    CASE
        WHEN b.visitantes = (SELECT maior_valor FROM topo)
             AND (SELECT qtd FROM empate) > 1
            THEN 'empate na liderança'
        WHEN b.visitantes = (SELECT maior_valor FROM topo)
            THEN 'vencedora'
        ELSE 'participante'
    END AS resultado
FROM base b
ORDER BY b.visitantes DESC, b.classe ASC;
$$;


ALTER FUNCTION public.fn_ebd_ranking_visitantes(p_data_chamada date) OWNER TO u0_a377;

--
-- Name: fn_ebd_ranking_visitantes(date, bigint); Type: FUNCTION; Schema: public; Owner: u0_a377
--

CREATE FUNCTION public.fn_ebd_ranking_visitantes(p_data_chamada date, p_id_cadastro bigint) RETURNS TABLE(id_classe bigint, classe text, visitantes integer, posicao integer, resultado text)
    LANGUAGE sql
    AS $$
WITH tenant_classes AS (
    SELECT id_classe, nome
    FROM ebd_classe
    WHERE id_cadastro = p_id_cadastro
),
base AS (
    SELECT
        c.id_classe,
        tc.nome AS classe,
        COALESCE(c.visitantes, 0)::integer AS visitantes
    FROM ebd_chamada c
    INNER JOIN tenant_classes tc
        ON tc.id_classe = c.id_classe
    WHERE c.data_chamada = p_data_chamada
),
topo AS (
    SELECT MAX(visitantes) AS maior_valor
    FROM base
),
empate AS (
    SELECT COUNT(*)::bigint AS qtd
    FROM base
    WHERE visitantes = (SELECT maior_valor FROM topo)
)
SELECT
    b.id_classe,
    b.classe,
    b.visitantes,
    ROW_NUMBER() OVER (ORDER BY b.visitantes DESC, b.classe ASC)::integer AS posicao,
    CASE
        WHEN b.visitantes = (SELECT maior_valor FROM topo)
             AND (SELECT qtd FROM empate) > 1
            THEN 'empate na liderança'
        WHEN b.visitantes = (SELECT maior_valor FROM topo)
            THEN 'vencedora'
        ELSE 'participante'
    END AS resultado
FROM base b
ORDER BY b.visitantes DESC, b.classe ASC;
$$;


ALTER FUNCTION public.fn_ebd_ranking_visitantes(p_data_chamada date, p_id_cadastro bigint) OWNER TO u0_a377;

--
-- Name: fn_ebd_reabrir_chamada(bigint); Type: FUNCTION; Schema: public; Owner: u0_a377
--

CREATE FUNCTION public.fn_ebd_reabrir_chamada(p_id_chamada bigint) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_data_chamada DATE;
    v_eh_admin BOOLEAN;
BEGIN
    SELECT c.data_chamada
      INTO v_data_chamada
      FROM ebd_chamada c
     WHERE c.id_chamada = p_id_chamada;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Chamada % não encontrada.', p_id_chamada;
    END IF;

    SELECT EXISTS (
        SELECT 1
          FROM ebd_usuario u
          INNER JOIN ebd_usuario_perfil up
            ON up.id_usuario = u.id_usuario
          INNER JOIN ebd_perfil p
            ON p.id_perfil = up.id_perfil
         WHERE LOWER(BTRIM(u.login)) = LOWER(current_user)
           AND LOWER(BTRIM(p.nome)) = 'administrador'
           AND p.ativo = TRUE
    )
      INTO v_eh_admin;

    IF v_data_chamada <> CURRENT_DATE AND NOT v_eh_admin THEN
        RAISE EXCEPTION 'Somente administrador pode reabrir chamada fora da data atual.';
    END IF;

    UPDATE ebd_chamada
       SET fechada = FALSE,
           reaberta_em = NOW()
     WHERE id_chamada = p_id_chamada;
END;
$$;


ALTER FUNCTION public.fn_ebd_reabrir_chamada(p_id_chamada bigint) OWNER TO u0_a377;

--
-- Name: fn_ebd_registrar_oferta(bigint, numeric); Type: FUNCTION; Schema: public; Owner: u0_a377
--

CREATE FUNCTION public.fn_ebd_registrar_oferta(p_id_chamada bigint, p_valor numeric) RETURNS numeric
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_data_chamada DATE;
    v_fechada BOOLEAN;
BEGIN
    SELECT c.data_chamada, c.fechada
      INTO v_data_chamada, v_fechada
      FROM ebd_chamada c
     WHERE c.id_chamada = p_id_chamada;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Chamada % não encontrada.', p_id_chamada;
    END IF;

    IF v_fechada THEN
        RAISE EXCEPTION 'Chamada % está fechada.', p_id_chamada;
    END IF;

    IF v_data_chamada <> CURRENT_DATE THEN
        RAISE EXCEPTION 'Só é permitido modificar chamada do dia atual (%). Data da chamada: %.',
            CURRENT_DATE, v_data_chamada;
    END IF;

    UPDATE ebd_chamada
       SET oferta = COALESCE(p_valor, 0)
     WHERE id_chamada = p_id_chamada;

    RETURN COALESCE(p_valor, 0);
END;
$$;


ALTER FUNCTION public.fn_ebd_registrar_oferta(p_id_chamada bigint, p_valor numeric) OWNER TO u0_a377;

--
-- Name: fn_ebd_registrar_status_aluno(bigint, text, text, text, text, bigint, bigint); Type: FUNCTION; Schema: public; Owner: u0_a377
--

CREATE FUNCTION public.fn_ebd_registrar_status_aluno(p_id_aluno bigint, p_novo_status text, p_origem text, p_motivo text DEFAULT ''::text, p_observacao text DEFAULT ''::text, p_id_chamada bigint DEFAULT NULL::bigint, p_id_chamada_aluno bigint DEFAULT NULL::bigint) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_status_anterior text;
    v_observacao_atual text;
    v_motivo_final text;
    v_observacao_final text;
    v_data_desligamento date;
BEGIN
    IF p_novo_status NOT IN ('ativo', 'inativo') THEN
        RAISE EXCEPTION
            'Status inválido para aluno. Use apenas ativo ou inativo.';
    END IF;

    IF p_origem NOT IN ('manual', 'automatica', 'carga_inicial') THEN
        RAISE EXCEPTION
            'Origem inválida. Use: manual, automatica ou carga_inicial.';
    END IF;

    SELECT
        a.status,
        a.observacao
    INTO
        v_status_anterior,
        v_observacao_atual
    FROM public.ebd_aluno a
    WHERE a.id_aluno = p_id_aluno
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Aluno % não encontrado.', p_id_aluno;
    END IF;

    IF v_status_anterior = p_novo_status THEN
        RETURN;
    END IF;

    v_motivo_final := COALESCE(NULLIF(BTRIM(p_motivo), ''), '');
    v_observacao_final := COALESCE(NULLIF(BTRIM(p_observacao), ''), '');

    IF p_novo_status = 'inativo' THEN
        IF v_motivo_final = '' THEN
            v_motivo_final := 'Sem motivo informado';
        END IF;

        IF v_observacao_final = '' THEN
            v_observacao_final := format(
                'Inativado em %s. Motivo: %s',
                CURRENT_DATE,
                v_motivo_final
            );
        END IF;

        UPDATE public.ebd_aluno
           SET status = 'inativo',
               data_desligamento = CURRENT_DATE,
               motivo_desligamento = v_motivo_final,
               observacao = CASE
                                WHEN COALESCE(NULLIF(BTRIM(v_observacao_atual), ''), '') = '' THEN v_observacao_final
                                ELSE v_observacao_atual || E'\n' || v_observacao_final
                            END
         WHERE id_aluno = p_id_aluno;

    ELSE
        UPDATE public.ebd_aluno
           SET status = 'ativo',
               data_desligamento = NULL,
               motivo_desligamento = ''
         WHERE id_aluno = p_id_aluno;

        IF v_observacao_final <> '' THEN
            UPDATE public.ebd_aluno
               SET observacao = CASE
                                    WHEN COALESCE(NULLIF(BTRIM(v_observacao_atual), ''), '') = '' THEN v_observacao_final
                                    ELSE v_observacao_atual || E'\n' || v_observacao_final
                                END
             WHERE id_aluno = p_id_aluno;
        END IF;
    END IF;

    INSERT INTO public.ebd_aluno_status_historico (
        id_aluno,
        status_anterior,
        status_novo,
        origem,
        motivo,
        observacao,
        id_chamada,
        id_chamada_aluno
    )
    VALUES (
        p_id_aluno,
        v_status_anterior,
        p_novo_status,
        p_origem,
        v_motivo_final,
        COALESCE(NULLIF(BTRIM(v_observacao_final), ''), ''),
        p_id_chamada,
        p_id_chamada_aluno
    );
END;
$$;


ALTER FUNCTION public.fn_ebd_registrar_status_aluno(p_id_aluno bigint, p_novo_status text, p_origem text, p_motivo text, p_observacao text, p_id_chamada bigint, p_id_chamada_aluno bigint) OWNER TO u0_a377;

--
-- Name: fn_ebd_registrar_visitante(bigint, text, text); Type: FUNCTION; Schema: public; Owner: u0_a377
--

CREATE FUNCTION public.fn_ebd_registrar_visitante(p_id_chamada bigint, p_nome text, p_observacao text DEFAULT ''::text) RETURNS bigint
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_id_visitante BIGINT;
    v_data_chamada DATE;
    v_fechada BOOLEAN;
BEGIN
    SELECT
        c.data_chamada,
        c.fechada
    INTO
        v_data_chamada,
        v_fechada
    FROM ebd_chamada c
    WHERE c.id_chamada = p_id_chamada;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Chamada % não encontrada.', p_id_chamada;
    END IF;

    IF v_fechada THEN
        RAISE EXCEPTION 'Chamada % está fechada.', p_id_chamada;
    END IF;

    IF v_data_chamada <> CURRENT_DATE THEN
        RAISE EXCEPTION
        'Só é permitido modificar chamada do dia atual (%). Data da chamada: %.',
        CURRENT_DATE,
        v_data_chamada;
    END IF;

    IF btrim(COALESCE(p_nome,'')) = '' THEN
        RAISE EXCEPTION 'O nome do visitante não pode ficar em branco.';
    END IF;

    INSERT INTO ebd_chamada_visitante
    (
        id_chamada,
        nome,
        observacao
    )
    VALUES
    (
        p_id_chamada,
        p_nome,
        COALESCE(p_observacao,'')
    )
    RETURNING id_chamada_visitante
    INTO v_id_visitante;

    UPDATE public.ebd_chamada
       SET visitantes = COALESCE(visitantes, 0) + 1
     WHERE id_chamada = p_id_chamada;

    RETURN v_id_visitante;
END;
$$;


ALTER FUNCTION public.fn_ebd_registrar_visitante(p_id_chamada bigint, p_nome text, p_observacao text) OWNER TO u0_a377;

--
-- Name: fn_ebd_registrar_resumo_chamada(bigint, numeric, integer, integer, integer); Type: FUNCTION; Schema: public; Owner: u0_a377
--

CREATE FUNCTION public.fn_ebd_registrar_resumo_chamada(p_id_chamada bigint, p_oferta numeric DEFAULT NULL::numeric, p_visitantes integer DEFAULT NULL::integer, p_biblias integer DEFAULT NULL::integer, p_revistas integer DEFAULT NULL::integer) RETURNS TABLE(id_chamada bigint, id_classe bigint, classe text, data_chamada date, oferta numeric, visitantes integer, biblias integer, revistas integer, observacao text)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_data_chamada date;
    v_fechada boolean;
BEGIN
    SELECT
        ch.data_chamada,
        ch.fechada
    INTO
        v_data_chamada,
        v_fechada
    FROM public.ebd_chamada ch
    WHERE ch.id_chamada = p_id_chamada;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Chamada % não encontrada.', p_id_chamada;
    END IF;

    IF v_fechada THEN
        RAISE EXCEPTION 'Chamada % está fechada.', p_id_chamada;
    END IF;

    IF v_data_chamada <> CURRENT_DATE THEN
        RAISE EXCEPTION
            'Só é permitido salvar o resumo da chamada do dia atual (%). Data da chamada: %.',
            CURRENT_DATE,
            v_data_chamada;
    END IF;

    UPDATE public.ebd_chamada ch
       SET oferta = COALESCE(p_oferta, 0),
           visitantes = COALESCE(p_visitantes, 0),
           biblias = COALESCE(p_biblias, 0),
           revistas = COALESCE(p_revistas, 0)
     WHERE ch.id_chamada = p_id_chamada;

    RETURN QUERY
    SELECT
        ch.id_chamada,
        ch.id_classe,
        cl.nome AS classe,
        ch.data_chamada,
        ch.oferta,
        ch.visitantes,
        ch.biblias,
        ch.revistas,
        ch.observacao
    FROM public.ebd_chamada ch
    INNER JOIN public.ebd_classe cl
        ON cl.id_classe = ch.id_classe
    WHERE ch.id_chamada = p_id_chamada;
END;
$$;


ALTER FUNCTION public.fn_ebd_registrar_resumo_chamada(p_id_chamada bigint, p_oferta numeric, p_visitantes integer, p_biblias integer, p_revistas integer) OWNER TO u0_a377;

--
-- Name: fn_ebd_resumo_chamada(date); Type: FUNCTION; Schema: public; Owner: u0_a377
--

CREATE FUNCTION public.fn_ebd_resumo_chamada(p_data_chamada date) RETURNS TABLE(id_chamada bigint, id_classe bigint, classe text, data_chamada date, oferta numeric, visitantes integer, biblias integer, revistas integer, observacao text, total_alunos bigint, presentes bigint, atrasados bigint, ausentes bigint, presenca_turma numeric)
    LANGUAGE sql
    AS $$
SELECT
    NULL::bigint AS id_chamada,
    NULL::bigint AS id_classe,
    'Resumo Geral'::text AS classe,
    p_data_chamada AS data_chamada,
    COALESCE(SUM(c.oferta), 0) AS oferta,
    COALESCE(SUM(c.visitantes), 0)::integer AS visitantes,
    COALESCE(SUM(c.biblias), 0)::integer AS biblias,
    COALESCE(SUM(c.revistas), 0)::integer AS revistas,
    ''::text AS observacao,
    COUNT(*)::bigint AS total_alunos,
    COUNT(*) FILTER (WHERE ca.status IN ('presente', 'atrasado'))::bigint AS presentes,
    COUNT(*) FILTER (WHERE ca.status = 'atrasado')::bigint AS atrasados,
    COUNT(*) FILTER (WHERE ca.status = 'ausente')::bigint AS ausentes,
    ROUND(
        (
            COUNT(*) FILTER (WHERE ca.status IN ('presente', 'atrasado'))::numeric * 100
        ) / NULLIF(COUNT(*), 0),
        1
    )::numeric(5,1) AS presenca_turma
FROM public.ebd_chamada c
INNER JOIN public.ebd_chamada_aluno ca
    ON ca.id_chamada = c.id_chamada
INNER JOIN public.ebd_aluno_classe ac
    ON ac.id_aluno_classe = ca.id_aluno_classe
INNER JOIN public.ebd_aluno a
    ON a.id_aluno = ac.id_aluno
WHERE c.data_chamada = p_data_chamada
  AND a.status = 'ativo';
$$;


ALTER FUNCTION public.fn_ebd_resumo_chamada(p_data_chamada date) OWNER TO u0_a377;

--
-- Name: fn_ebd_resumo_classe(bigint, date); Type: FUNCTION; Schema: public; Owner: u0_a377
--

CREATE FUNCTION public.fn_ebd_resumo_classe(p_id_classe bigint, p_data_chamada date) RETURNS TABLE(id_chamada bigint, id_classe bigint, classe text, data_chamada date, oferta numeric, visitantes integer, biblias integer, revistas integer, observacao text, total_alunos bigint, presentes bigint, atrasados bigint, ausentes bigint, presenca_turma numeric)
    LANGUAGE sql
    AS $$
SELECT
    c.id_chamada,
    c.id_classe,
    cl.nome AS classe,
    c.data_chamada,
    c.oferta,
    c.visitantes AS visitantes,
    c.biblias,
    c.revistas,
    c.observacao,
    COUNT(*)::bigint AS total_alunos,
    COUNT(*) FILTER (WHERE ca.status IN ('presente', 'atrasado'))::bigint AS presentes,
    COUNT(*) FILTER (WHERE ca.status = 'atrasado')::bigint AS atrasados,
    COUNT(*) FILTER (WHERE ca.status = 'ausente')::bigint AS ausentes,
    ROUND(
        (
            COUNT(*) FILTER (WHERE ca.status IN ('presente', 'atrasado'))::numeric * 100
        ) / NULLIF(COUNT(*), 0),
        1
    )::numeric(5,1) AS presenca_turma
FROM public.ebd_chamada c
INNER JOIN public.ebd_classe cl
    ON cl.id_classe = c.id_classe
INNER JOIN public.ebd_chamada_aluno ca
    ON ca.id_chamada = c.id_chamada
INNER JOIN public.ebd_aluno_classe ac
    ON ac.id_aluno_classe = ca.id_aluno_classe
INNER JOIN public.ebd_aluno a
    ON a.id_aluno = ac.id_aluno
INNER JOIN public.ebd_pessoa p
    ON p.id_pessoa = a.id_pessoa
WHERE c.id_classe = p_id_classe
  AND c.data_chamada = p_data_chamada
  AND a.status = 'ativo'
GROUP BY
    c.id_chamada,
    c.id_classe,
    cl.nome,
    c.data_chamada,
    c.oferta,
    c.visitantes,
    c.biblias,
    c.revistas,
    c.observacao;
$$;


ALTER FUNCTION public.fn_ebd_resumo_classe(p_id_classe bigint, p_data_chamada date) OWNER TO u0_a377;

--
-- Name: fn_ebd_set_atualizado_em(); Type: FUNCTION; Schema: public; Owner: u0_a377
--

CREATE FUNCTION public.fn_ebd_set_atualizado_em() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.atualizado_em := NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.fn_ebd_set_atualizado_em() OWNER TO u0_a377;

--
-- Name: fn_ebd_tem_4_faltas_consecutivas(bigint); Type: FUNCTION; Schema: public; Owner: u0_a377
--

CREATE FUNCTION public.fn_ebd_tem_4_faltas_consecutivas(p_id_aluno_classe bigint) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
WITH ultimas AS (
    SELECT
        ca.status,
        ROW_NUMBER() OVER (
            ORDER BY c.data_chamada DESC, c.id_chamada DESC, ca.id_chamada_aluno DESC
        ) AS rn
    FROM public.ebd_chamada_aluno ca
    INNER JOIN public.ebd_chamada c
        ON c.id_chamada = ca.id_chamada
    WHERE ca.id_aluno_classe = p_id_aluno_classe
    ORDER BY c.data_chamada DESC, c.id_chamada DESC, ca.id_chamada_aluno DESC
    LIMIT 4
)
SELECT
    COUNT(*) = 4
    AND BOOL_AND(status = 'ausente')
FROM ultimas;
$$;


ALTER FUNCTION public.fn_ebd_tem_4_faltas_consecutivas(p_id_aluno_classe bigint) OWNER TO u0_a377;

--
-- Name: fn_ebd_todos_ausentes(bigint); Type: FUNCTION; Schema: public; Owner: u0_a377
--

CREATE FUNCTION public.fn_ebd_todos_ausentes(p_id_chamada bigint) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_data_chamada date;
    v_fechada boolean;
BEGIN
    SELECT c.data_chamada, c.fechada
      INTO v_data_chamada, v_fechada
      FROM public.ebd_chamada c
     WHERE c.id_chamada = p_id_chamada;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Chamada % não encontrada.', p_id_chamada;
    END IF;

    IF v_fechada THEN
        RAISE EXCEPTION 'Chamada % está fechada.', p_id_chamada;
    END IF;

    IF v_data_chamada <> CURRENT_DATE THEN
        RAISE EXCEPTION 'Só é permitido modificar chamada do dia atual (%). Data da chamada: %.',
            CURRENT_DATE, v_data_chamada;
    END IF;

    UPDATE public.ebd_chamada_aluno ca
       SET status = 'ausente',
           observacao = ''
      FROM public.ebd_aluno_classe ac
      INNER JOIN public.ebd_aluno a
        ON a.id_aluno = ac.id_aluno
     WHERE ca.id_chamada = p_id_chamada
       AND ca.id_aluno_classe = ac.id_aluno_classe
       AND a.status = 'ativo';

    PERFORM public.fn_ebd_processar_inativacao_por_faltas(p_id_chamada);
END;
$$;


ALTER FUNCTION public.fn_ebd_todos_ausentes(p_id_chamada bigint) OWNER TO u0_a377;

--
-- Name: fn_ebd_todos_presentes(bigint); Type: FUNCTION; Schema: public; Owner: u0_a377
--

CREATE FUNCTION public.fn_ebd_todos_presentes(p_id_chamada bigint) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_data_chamada date;
    v_fechada boolean;
BEGIN
    SELECT c.data_chamada, c.fechada
      INTO v_data_chamada, v_fechada
      FROM public.ebd_chamada c
     WHERE c.id_chamada = p_id_chamada;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Chamada % não encontrada.', p_id_chamada;
    END IF;

    IF v_fechada THEN
        RAISE EXCEPTION 'Chamada % está fechada.', p_id_chamada;
    END IF;

    IF v_data_chamada <> CURRENT_DATE THEN
        RAISE EXCEPTION 'Só é permitido modificar chamada do dia atual (%). Data da chamada: %.',
            CURRENT_DATE, v_data_chamada;
    END IF;

    UPDATE public.ebd_chamada_aluno ca
       SET status = 'presente',
           observacao = ''
      FROM public.ebd_aluno_classe ac
      INNER JOIN public.ebd_aluno a
        ON a.id_aluno = ac.id_aluno
     WHERE ca.id_chamada = p_id_chamada
       AND ca.id_aluno_classe = ac.id_aluno_classe
       AND a.status = 'ativo';
END;
$$;


ALTER FUNCTION public.fn_ebd_todos_presentes(p_id_chamada bigint) OWNER TO u0_a377;

--
-- Name: fn_ebd_transferir_aluno(bigint, bigint, date, text, text); Type: FUNCTION; Schema: public; Owner: u0_a377
--

CREATE FUNCTION public.fn_ebd_transferir_aluno(p_id_aluno bigint, p_id_classe_destino bigint, p_data_inicio date DEFAULT CURRENT_DATE, p_motivo text DEFAULT ''::text, p_observacao text DEFAULT ''::text) RETURNS bigint
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_status_aluno text;
    v_observacao_atual text;
    v_id_cadastro_aluno bigint;
    v_id_cadastro_classe_destino bigint;
    v_id_aluno_classe_atual bigint;
    v_id_classe_atual bigint;
    v_data_inicio_atual date;
    v_nome_classe_atual text;
    v_nome_classe_destino text;
    v_data_inicio_nova date := COALESCE(p_data_inicio, CURRENT_DATE);
    v_data_fim_atual date;
    v_motivo_final text;
    v_observacao_final text;
    v_id_aluno_classe_novo bigint;
BEGIN
    IF p_id_aluno IS NULL THEN
        RAISE EXCEPTION 'p_id_aluno não pode ser nulo.';
    END IF;

    IF p_id_classe_destino IS NULL THEN
        RAISE EXCEPTION 'p_id_classe_destino não pode ser nulo.';
    END IF;

    IF v_data_inicio_nova IS NULL THEN
        v_data_inicio_nova := CURRENT_DATE;
    END IF;

    SELECT
        a.status,
        a.observacao,
        p.id_cadastro
    INTO
        v_status_aluno,
        v_observacao_atual,
        v_id_cadastro_aluno
    FROM public.ebd_aluno a
    INNER JOIN public.ebd_pessoa p
        ON p.id_pessoa = a.id_pessoa
    WHERE a.id_aluno = p_id_aluno
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Aluno % não encontrado.', p_id_aluno;
    END IF;

    IF v_status_aluno <> 'ativo' THEN
        RAISE EXCEPTION 'Aluno inativo não pode ser transferido.';
    END IF;

    SELECT
        ac.id_aluno_classe,
        ac.id_classe,
        ac.data_inicio,
        c.nome
    INTO
        v_id_aluno_classe_atual,
        v_id_classe_atual,
        v_data_inicio_atual,
        v_nome_classe_atual
    FROM public.ebd_aluno_classe ac
    INNER JOIN public.ebd_classe c
        ON c.id_classe = ac.id_classe
    WHERE ac.id_aluno = p_id_aluno
      AND ac.ativo = TRUE
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Aluno % não possui vínculo ativo para transferir.', p_id_aluno;
    END IF;

    IF p_id_classe_destino = v_id_classe_atual THEN
        RAISE EXCEPTION
            'O aluno % já está vinculado à classe %.',
            p_id_aluno,
            p_id_classe_destino;
    END IF;

    IF v_data_inicio_nova <= v_data_inicio_atual THEN
        RAISE EXCEPTION
            'A data da transferência (%) deve ser posterior ao início do vínculo ativo (%).',
            v_data_inicio_nova,
            v_data_inicio_atual;
    END IF;

    SELECT
        c.id_cadastro,
        c.nome
    INTO
        v_id_cadastro_classe_destino,
        v_nome_classe_destino
    FROM public.ebd_classe c
    WHERE c.id_classe = p_id_classe_destino
      AND c.ativo = TRUE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Classe % não encontrada ou inativa.', p_id_classe_destino;
    END IF;

    IF v_id_cadastro_aluno <> v_id_cadastro_classe_destino THEN
        RAISE EXCEPTION
            'Cadastro incompatível: aluno % pertence ao cadastro %, mas a classe % pertence ao cadastro %.',
            p_id_aluno,
            v_id_cadastro_aluno,
            p_id_classe_destino,
            v_id_cadastro_classe_destino;
    END IF;

    v_data_fim_atual := v_data_inicio_nova - 1;

    UPDATE public.ebd_aluno_classe
       SET ativo = FALSE,
           data_fim = v_data_fim_atual
     WHERE id_aluno_classe = v_id_aluno_classe_atual;

    v_motivo_final := COALESCE(NULLIF(BTRIM(p_motivo), ''), format('Transferência para %s', v_nome_classe_destino));

    v_observacao_final := COALESCE(NULLIF(BTRIM(p_observacao), ''), '');
    IF v_observacao_final = '' THEN
        v_observacao_final := format(
            'Transferido de %s para %s em %s.',
            v_nome_classe_atual,
            v_nome_classe_destino,
            v_data_inicio_nova
        );
    ELSE
        v_observacao_final := v_observacao_final || E'\n' || format(
            'Transferido de %s para %s em %s.',
            v_nome_classe_atual,
            v_nome_classe_destino,
            v_data_inicio_nova
        );
    END IF;

    UPDATE public.ebd_aluno
       SET observacao = CASE
                            WHEN COALESCE(NULLIF(BTRIM(v_observacao_atual), ''), '') = '' THEN v_observacao_final
                            ELSE v_observacao_atual || E'\n' || v_observacao_final
                        END
     WHERE id_aluno = p_id_aluno;

    INSERT INTO public.ebd_aluno_classe (
        id_aluno,
        id_classe,
        data_inicio,
        motivo,
        ativo
    )
    VALUES (
        p_id_aluno,
        p_id_classe_destino,
        v_data_inicio_nova,
        v_motivo_final,
        TRUE
    )
    RETURNING id_aluno_classe
      INTO v_id_aluno_classe_novo;

    RETURN v_id_aluno_classe_novo;
END;
$$;


ALTER FUNCTION public.fn_ebd_transferir_aluno(p_id_aluno bigint, p_id_classe_destino bigint, p_data_inicio date, p_motivo text, p_observacao text) OWNER TO u0_a377;

--
-- Name: fn_ebd_trg_cadastro_criar_classes_padrao(); Type: FUNCTION; Schema: public; Owner: u0_a377
--

CREATE FUNCTION public.fn_ebd_trg_cadastro_criar_classes_padrao() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM public.fn_ebd_criar_classes_padrao(NEW.id_cadastro);
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.fn_ebd_trg_cadastro_criar_classes_padrao() OWNER TO u0_a377;

--
-- Name: fn_ebd_trg_validar_aluno_classe_cadastro(); Type: FUNCTION; Schema: public; Owner: u0_a377
--

CREATE FUNCTION public.fn_ebd_trg_validar_aluno_classe_cadastro() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_id_cadastro_aluno bigint;
    v_id_cadastro_classe bigint;
BEGIN
    SELECT p.id_cadastro
      INTO v_id_cadastro_aluno
      FROM public.ebd_aluno a
      INNER JOIN public.ebd_pessoa p
        ON p.id_pessoa = a.id_pessoa
     WHERE a.id_aluno = NEW.id_aluno;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Aluno % não encontrado para validar vínculo.', NEW.id_aluno;
    END IF;

    SELECT c.id_cadastro
      INTO v_id_cadastro_classe
      FROM public.ebd_classe c
     WHERE c.id_classe = NEW.id_classe;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Classe % não encontrada para validar vínculo.', NEW.id_classe;
    END IF;

    IF v_id_cadastro_aluno <> v_id_cadastro_classe THEN
        RAISE EXCEPTION
            'Vínculo inválido: aluno % pertence ao cadastro %, mas a classe % pertence ao cadastro %.',
            NEW.id_aluno,
            v_id_cadastro_aluno,
            NEW.id_classe,
            v_id_cadastro_classe;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION public.fn_ebd_trg_validar_aluno_classe_cadastro() OWNER TO u0_a377;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account; Type: TABLE; Schema: neon_auth; Owner: u0_a377
--

CREATE TABLE neon_auth.account (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "accountId" text NOT NULL,
    "providerId" text NOT NULL,
    "userId" uuid NOT NULL,
    "accessToken" text,
    "refreshToken" text,
    "idToken" text,
    "accessTokenExpiresAt" timestamp with time zone,
    "refreshTokenExpiresAt" timestamp with time zone,
    scope text,
    password text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE neon_auth.account OWNER TO u0_a377;

--
-- Name: invitation; Type: TABLE; Schema: neon_auth; Owner: u0_a377
--

CREATE TABLE neon_auth.invitation (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "organizationId" uuid NOT NULL,
    email text NOT NULL,
    role text,
    status text NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "inviterId" uuid NOT NULL
);


ALTER TABLE neon_auth.invitation OWNER TO u0_a377;

--
-- Name: jwks; Type: TABLE; Schema: neon_auth; Owner: u0_a377
--

CREATE TABLE neon_auth.jwks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "publicKey" text NOT NULL,
    "privateKey" text NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "expiresAt" timestamp with time zone
);


ALTER TABLE neon_auth.jwks OWNER TO u0_a377;

--
-- Name: member; Type: TABLE; Schema: neon_auth; Owner: u0_a377
--

CREATE TABLE neon_auth.member (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "organizationId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    role text NOT NULL,
    "createdAt" timestamp with time zone NOT NULL
);


ALTER TABLE neon_auth.member OWNER TO u0_a377;

--
-- Name: organization; Type: TABLE; Schema: neon_auth; Owner: u0_a377
--

CREATE TABLE neon_auth.organization (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    logo text,
    "createdAt" timestamp with time zone NOT NULL,
    metadata text
);


ALTER TABLE neon_auth.organization OWNER TO u0_a377;

--
-- Name: project_config; Type: TABLE; Schema: neon_auth; Owner: u0_a377
--

CREATE TABLE neon_auth.project_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    endpoint_id text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    trusted_origins jsonb NOT NULL,
    social_providers jsonb NOT NULL,
    email_provider jsonb,
    email_and_password jsonb,
    allow_localhost boolean NOT NULL,
    plugin_configs jsonb,
    webhook_config jsonb
);


ALTER TABLE neon_auth.project_config OWNER TO u0_a377;

--
-- Name: session; Type: TABLE; Schema: neon_auth; Owner: u0_a377
--

CREATE TABLE neon_auth.session (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL,
    token text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "ipAddress" text,
    "userAgent" text,
    "userId" uuid NOT NULL,
    "impersonatedBy" text,
    "activeOrganizationId" text
);


ALTER TABLE neon_auth.session OWNER TO u0_a377;

--
-- Name: user; Type: TABLE; Schema: neon_auth; Owner: u0_a377
--

CREATE TABLE neon_auth."user" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    "emailVerified" boolean NOT NULL,
    image text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    role text,
    banned boolean,
    "banReason" text,
    "banExpires" timestamp with time zone
);


ALTER TABLE neon_auth."user" OWNER TO u0_a377;

--
-- Name: verification; Type: TABLE; Schema: neon_auth; Owner: u0_a377
--

CREATE TABLE neon_auth.verification (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    identifier text NOT NULL,
    value text NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE neon_auth.verification OWNER TO u0_a377;

--
-- Name: ebd_aluno; Type: TABLE; Schema: public; Owner: u0_a377
--

CREATE TABLE public.ebd_aluno (
    id_aluno bigint NOT NULL,
    id_pessoa bigint NOT NULL,
    matricula text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'ativo'::text NOT NULL,
    data_cadastro date DEFAULT CURRENT_DATE NOT NULL,
    data_desligamento date,
    motivo_desligamento text DEFAULT ''::text NOT NULL,
    observacao text DEFAULT ''::text NOT NULL,
    CONSTRAINT ck_ebd_aluno_desligamento CHECK ((((status = 'ativo'::text) AND (data_desligamento IS NULL)) OR (status <> 'ativo'::text))),
    CONSTRAINT ck_ebd_aluno_status CHECK ((status = ANY (ARRAY['ativo'::text, 'transferido'::text, 'inativo'::text, 'falecido'::text])))
);


ALTER TABLE public.ebd_aluno OWNER TO u0_a377;

--
-- Name: ebd_aluno_classe; Type: TABLE; Schema: public; Owner: u0_a377
--

CREATE TABLE public.ebd_aluno_classe (
    id_aluno_classe bigint NOT NULL,
    id_aluno bigint NOT NULL,
    id_classe bigint NOT NULL,
    data_inicio date DEFAULT CURRENT_DATE NOT NULL,
    data_fim date,
    motivo text DEFAULT ''::text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    CONSTRAINT ck_ebd_aluno_classe_datas CHECK (((data_fim IS NULL) OR (data_fim >= data_inicio)))
);


ALTER TABLE public.ebd_aluno_classe OWNER TO u0_a377;

--
-- Name: ebd_aluno_classe_id_aluno_classe_seq; Type: SEQUENCE; Schema: public; Owner: u0_a377
--

ALTER TABLE public.ebd_aluno_classe ALTER COLUMN id_aluno_classe ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.ebd_aluno_classe_id_aluno_classe_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ebd_aluno_id_aluno_seq; Type: SEQUENCE; Schema: public; Owner: u0_a377
--

ALTER TABLE public.ebd_aluno ALTER COLUMN id_aluno ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.ebd_aluno_id_aluno_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ebd_aluno_status_historico; Type: TABLE; Schema: public; Owner: u0_a377
--

CREATE TABLE public.ebd_aluno_status_historico (
    id_aluno_status_historico bigint NOT NULL,
    id_aluno bigint NOT NULL,
    status_anterior text,
    status_novo text NOT NULL,
    origem text NOT NULL,
    motivo text DEFAULT ''::text NOT NULL,
    observacao text DEFAULT ''::text NOT NULL,
    id_chamada bigint,
    id_chamada_aluno bigint,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    criado_por text DEFAULT CURRENT_USER NOT NULL,
    CONSTRAINT ck_ebd_aluno_status_historico_origem CHECK ((origem = ANY (ARRAY['manual'::text, 'automatica'::text, 'carga_inicial'::text]))),
    CONSTRAINT ck_ebd_aluno_status_historico_status CHECK ((status_novo = ANY (ARRAY['ativo'::text, 'inativo'::text])))
);


ALTER TABLE public.ebd_aluno_status_historico OWNER TO u0_a377;

--
-- Name: ebd_aluno_status_historico_id_aluno_status_historico_seq; Type: SEQUENCE; Schema: public; Owner: u0_a377
--

ALTER TABLE public.ebd_aluno_status_historico ALTER COLUMN id_aluno_status_historico ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.ebd_aluno_status_historico_id_aluno_status_historico_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ebd_cadastro; Type: TABLE; Schema: public; Owner: u0_a377
--

CREATE TABLE public.ebd_cadastro (
    id_cadastro bigint NOT NULL,
    nome text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_ebd_cadastro_nome_not_blank CHECK ((btrim(nome) <> ''::text))
);


ALTER TABLE public.ebd_cadastro OWNER TO u0_a377;

--
-- Name: ebd_cadastro_id_cadastro_seq; Type: SEQUENCE; Schema: public; Owner: u0_a377
--

ALTER TABLE public.ebd_cadastro ALTER COLUMN id_cadastro ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.ebd_cadastro_id_cadastro_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ebd_chamada; Type: TABLE; Schema: public; Owner: u0_a377
--

CREATE TABLE public.ebd_chamada (
    id_chamada bigint NOT NULL,
    id_classe bigint NOT NULL,
    data_chamada date NOT NULL,
    oferta numeric(10,2) DEFAULT 0 NOT NULL,
    visitantes integer DEFAULT 0 NOT NULL,
    biblias integer DEFAULT 0 NOT NULL,
    revistas integer DEFAULT 0 NOT NULL,
    observacao text DEFAULT ''::text NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    fechada boolean DEFAULT false NOT NULL,
    fechado_em timestamp with time zone,
    reaberta_em timestamp with time zone
);


ALTER TABLE public.ebd_chamada OWNER TO u0_a377;

--
-- Name: ebd_chamada_aluno; Type: TABLE; Schema: public; Owner: u0_a377
--

CREATE TABLE public.ebd_chamada_aluno (
    id_chamada_aluno bigint NOT NULL,
    id_chamada bigint NOT NULL,
    id_aluno_classe bigint NOT NULL,
    status text DEFAULT 'ausente'::text NOT NULL,
    observacao text DEFAULT ''::text NOT NULL,
    CONSTRAINT ck_ebd_chamada_aluno_status CHECK ((status = ANY (ARRAY['presente'::text, 'atrasado'::text, 'ausente'::text])))
);


ALTER TABLE public.ebd_chamada_aluno OWNER TO u0_a377;

--
-- Name: ebd_chamada_aluno_id_chamada_aluno_seq; Type: SEQUENCE; Schema: public; Owner: u0_a377
--

ALTER TABLE public.ebd_chamada_aluno ALTER COLUMN id_chamada_aluno ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.ebd_chamada_aluno_id_chamada_aluno_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ebd_chamada_id_chamada_seq; Type: SEQUENCE; Schema: public; Owner: u0_a377
--

ALTER TABLE public.ebd_chamada ALTER COLUMN id_chamada ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.ebd_chamada_id_chamada_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ebd_chamada_visitante; Type: TABLE; Schema: public; Owner: u0_a377
--

CREATE TABLE public.ebd_chamada_visitante (
    id_chamada_visitante bigint NOT NULL,
    id_chamada bigint NOT NULL,
    nome text NOT NULL,
    observacao text DEFAULT ''::text NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_ebd_chamada_visitante_nome_not_blank CHECK ((btrim(nome) <> ''::text))
);


ALTER TABLE public.ebd_chamada_visitante OWNER TO u0_a377;

--
-- Name: ebd_chamada_visitante_id_chamada_visitante_seq; Type: SEQUENCE; Schema: public; Owner: u0_a377
--

ALTER TABLE public.ebd_chamada_visitante ALTER COLUMN id_chamada_visitante ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.ebd_chamada_visitante_id_chamada_visitante_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ebd_classe; Type: TABLE; Schema: public; Owner: u0_a377
--

CREATE TABLE public.ebd_classe (
    id_classe bigint NOT NULL,
    nome text NOT NULL,
    faixa_etaria text DEFAULT ''::text NOT NULL,
    descricao text DEFAULT ''::text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    id_cadastro bigint NOT NULL,
    CONSTRAINT ck_ebd_classe_nome_not_blank CHECK ((btrim(nome) <> ''::text))
);


ALTER TABLE public.ebd_classe OWNER TO u0_a377;

--
-- Name: ebd_classe_id_classe_seq; Type: SEQUENCE; Schema: public; Owner: u0_a377
--

ALTER TABLE public.ebd_classe ALTER COLUMN id_classe ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.ebd_classe_id_classe_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ebd_funcao; Type: TABLE; Schema: public; Owner: u0_a377
--

CREATE TABLE public.ebd_funcao (
    id_funcao bigint NOT NULL,
    nome text NOT NULL,
    descricao text DEFAULT ''::text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    CONSTRAINT ck_ebd_funcao_nome_not_blank CHECK ((btrim(nome) <> ''::text))
);


ALTER TABLE public.ebd_funcao OWNER TO u0_a377;

--
-- Name: ebd_funcao_id_funcao_seq; Type: SEQUENCE; Schema: public; Owner: u0_a377
--

ALTER TABLE public.ebd_funcao ALTER COLUMN id_funcao ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.ebd_funcao_id_funcao_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ebd_perfil; Type: TABLE; Schema: public; Owner: u0_a377
--

CREATE TABLE public.ebd_perfil (
    id_perfil bigint NOT NULL,
    nome text NOT NULL,
    descricao text DEFAULT ''::text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    CONSTRAINT ck_ebd_perfil_nome_not_blank CHECK ((btrim(nome) <> ''::text))
);


ALTER TABLE public.ebd_perfil OWNER TO u0_a377;

--
-- Name: ebd_perfil_id_perfil_seq; Type: SEQUENCE; Schema: public; Owner: u0_a377
--

ALTER TABLE public.ebd_perfil ALTER COLUMN id_perfil ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.ebd_perfil_id_perfil_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ebd_pessoa; Type: TABLE; Schema: public; Owner: u0_a377
--

CREATE TABLE public.ebd_pessoa (
    id_pessoa bigint NOT NULL,
    nome text NOT NULL,
    sexo text DEFAULT 'nao_informado'::text NOT NULL,
    cpf text DEFAULT ''::text NOT NULL,
    data_nascimento date,
    telefone text DEFAULT ''::text NOT NULL,
    email text DEFAULT ''::text NOT NULL,
    logradouro text DEFAULT ''::text NOT NULL,
    numero text DEFAULT ''::text NOT NULL,
    bairro text DEFAULT ''::text NOT NULL,
    cidade text DEFAULT ''::text NOT NULL,
    uf character(2) DEFAULT ''::bpchar NOT NULL,
    cep text DEFAULT ''::text NOT NULL,
    observacao text DEFAULT ''::text NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    id_cadastro bigint NOT NULL,
    CONSTRAINT ck_ebd_pessoa_cpf CHECK (((cpf = ''::text) OR (cpf ~ '^[0-9]{11}$'::text))),
    CONSTRAINT ck_ebd_pessoa_email CHECK (((email = ''::text) OR (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'::text))),
    CONSTRAINT ck_ebd_pessoa_nome_not_blank CHECK ((btrim(nome) <> ''::text)),
    CONSTRAINT ck_ebd_pessoa_sexo CHECK ((sexo = ANY (ARRAY['M'::text, 'F'::text, 'outro'::text, 'nao_informado'::text]))),
    CONSTRAINT ck_ebd_pessoa_telefone CHECK ((telefone ~ '^[0-9]{0,11}$'::text)),
    CONSTRAINT ck_ebd_pessoa_uf CHECK (((uf = ''::bpchar) OR (uf ~ '^[A-Z]{2}$'::text)))
);


ALTER TABLE public.ebd_pessoa OWNER TO u0_a377;

--
-- Name: ebd_pessoa_funcao; Type: TABLE; Schema: public; Owner: u0_a377
--

CREATE TABLE public.ebd_pessoa_funcao (
    id_pessoa_funcao bigint NOT NULL,
    id_pessoa bigint NOT NULL,
    id_funcao bigint NOT NULL,
    data_inicio date DEFAULT CURRENT_DATE NOT NULL,
    data_fim date,
    ativo boolean DEFAULT true NOT NULL,
    observacao text DEFAULT ''::text NOT NULL,
    CONSTRAINT ck_ebd_pessoa_funcao_datas CHECK (((data_fim IS NULL) OR (data_fim >= data_inicio)))
);


ALTER TABLE public.ebd_pessoa_funcao OWNER TO u0_a377;

--
-- Name: ebd_pessoa_funcao_id_pessoa_funcao_seq; Type: SEQUENCE; Schema: public; Owner: u0_a377
--

ALTER TABLE public.ebd_pessoa_funcao ALTER COLUMN id_pessoa_funcao ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.ebd_pessoa_funcao_id_pessoa_funcao_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ebd_pessoa_id_pessoa_seq; Type: SEQUENCE; Schema: public; Owner: u0_a377
--

ALTER TABLE public.ebd_pessoa ALTER COLUMN id_pessoa ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.ebd_pessoa_id_pessoa_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ebd_usuario; Type: TABLE; Schema: public; Owner: u0_a377
--

CREATE TABLE public.ebd_usuario (
    id_usuario bigint NOT NULL,
    id_pessoa bigint NOT NULL,
    login text NOT NULL,
    senha_hash text NOT NULL,
    ultimo_login timestamp with time zone,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    id_cadastro bigint NOT NULL,
    CONSTRAINT ck_ebd_usuario_login_not_blank CHECK ((btrim(login) <> ''::text))
);


ALTER TABLE public.ebd_usuario OWNER TO u0_a377;

--
-- Name: ebd_usuario_id_usuario_seq; Type: SEQUENCE; Schema: public; Owner: u0_a377
--

ALTER TABLE public.ebd_usuario ALTER COLUMN id_usuario ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.ebd_usuario_id_usuario_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ebd_usuario_perfil; Type: TABLE; Schema: public; Owner: u0_a377
--

CREATE TABLE public.ebd_usuario_perfil (
    id_usuario_perfil bigint NOT NULL,
    id_usuario bigint NOT NULL,
    id_perfil bigint NOT NULL
);


ALTER TABLE public.ebd_usuario_perfil OWNER TO u0_a377;

--
-- Name: ebd_usuario_perfil_id_usuario_perfil_seq; Type: SEQUENCE; Schema: public; Owner: u0_a377
--

ALTER TABLE public.ebd_usuario_perfil ALTER COLUMN id_usuario_perfil ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.ebd_usuario_perfil_id_usuario_perfil_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Data for Name: account; Type: TABLE DATA; Schema: neon_auth; Owner: u0_a377
--

COPY neon_auth.account (id, "accountId", "providerId", "userId", "accessToken", "refreshToken", "idToken", "accessTokenExpiresAt", "refreshTokenExpiresAt", scope, password, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: invitation; Type: TABLE DATA; Schema: neon_auth; Owner: u0_a377
--

COPY neon_auth.invitation (id, "organizationId", email, role, status, "expiresAt", "createdAt", "inviterId") FROM stdin;
\.


--
-- Data for Name: jwks; Type: TABLE DATA; Schema: neon_auth; Owner: u0_a377
--

COPY neon_auth.jwks (id, "publicKey", "privateKey", "createdAt", "expiresAt") FROM stdin;
\.


--
-- Data for Name: member; Type: TABLE DATA; Schema: neon_auth; Owner: u0_a377
--

COPY neon_auth.member (id, "organizationId", "userId", role, "createdAt") FROM stdin;
\.


--
-- Data for Name: organization; Type: TABLE DATA; Schema: neon_auth; Owner: u0_a377
--

COPY neon_auth.organization (id, name, slug, logo, "createdAt", metadata) FROM stdin;
\.


--
-- Data for Name: project_config; Type: TABLE DATA; Schema: neon_auth; Owner: u0_a377
--

COPY neon_auth.project_config (id, name, endpoint_id, created_at, updated_at, trusted_origins, social_providers, email_provider, email_and_password, allow_localhost, plugin_configs, webhook_config) FROM stdin;
3c51fd07-e7c4-4341-acc4-2fe6653d9ffb	EBD	ep-steep-surf-adzbjuza	2026-07-15 09:43:58.938-03	2026-07-15 09:43:58.938-03	[]	[{"id": "google", "isShared": true}]	{"type": "shared"}	{"enabled": true, "disableSignUp": false, "emailVerificationMethod": "otp", "requireEmailVerification": false, "autoSignInAfterVerification": true, "sendVerificationEmailOnSignIn": false, "sendVerificationEmailOnSignUp": false}	t	{"magicLink": {"config": {"expiresIn": 5, "disableSignUp": false}, "enabled": false}, "phoneNumber": {"config": {"otp_expires_in": 300}, "enabled": false}, "organization": {"config": {"creatorRole": "owner", "membershipLimit": 100, "organizationLimit": 10, "sendInvitationEmail": false}, "enabled": true}}	{"enabled": false, "enabledEvents": [], "timeoutSeconds": 5}
\.


--
-- Data for Name: session; Type: TABLE DATA; Schema: neon_auth; Owner: u0_a377
--

COPY neon_auth.session (id, "expiresAt", token, "createdAt", "updatedAt", "ipAddress", "userAgent", "userId", "impersonatedBy", "activeOrganizationId") FROM stdin;
\.


--
-- Data for Name: user; Type: TABLE DATA; Schema: neon_auth; Owner: u0_a377
--

COPY neon_auth."user" (id, name, email, "emailVerified", image, "createdAt", "updatedAt", role, banned, "banReason", "banExpires") FROM stdin;
\.


--
-- Data for Name: verification; Type: TABLE DATA; Schema: neon_auth; Owner: u0_a377
--

COPY neon_auth.verification (id, identifier, value, "expiresAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: ebd_aluno; Type: TABLE DATA; Schema: public; Owner: u0_a377
--

COPY public.ebd_aluno (id_aluno, id_pessoa, matricula, status, data_cadastro, data_desligamento, motivo_desligamento, observacao) FROM stdin;
1	5	ALU0005	ativo	2026-07-13	\N		Aluno da classe de Crianças Menores
2	6	ALU0006	ativo	2026-07-13	\N		Aluna da classe de Crianças Menores
3	7	ALU0007	ativo	2026-07-13	\N		Aluna da classe de Crianças Maiores
4	8	ALU0008	ativo	2026-07-13	\N		Aluna da classe de Crianças Maiores
5	9	ALU0009	ativo	2026-07-13	\N		Aluno da classe de Adolescentes
7	11	ALU0011	ativo	2026-07-13	\N		Aluno da classe de Jovens
8	12	ALU0012	ativo	2026-07-13	\N		Aluna da classe de Jovens
9	13	ALU0013	ativo	2026-07-13	\N		Aluno da classe de Senhores
10	14	ALU0014	ativo	2026-07-13	\N		Aluna da classe de Senhores
11	15	ALU0015	ativo	2026-07-13	\N		Aluna da classe de Senhoras
12	16	ALU0016	ativo	2026-07-13	\N		Aluna da classe de Senhoras
17	25		ativo	2026-07-21	\N		
18	26		ativo	2026-07-21	\N		
19	27		ativo	2026-07-21	\N		
20	28		inativo	2026-07-21	2026-07-21	Teste de inativação	Aluno inativado via teste da API
6	10	ALU0010	inativo	2026-07-13	2026-07-21	Teste de inativação	Aluno transferido entre classes\nAluno inativado via teste da API
21	29		ativo	2026-07-22	\N		
\.


--
-- Data for Name: ebd_aluno_classe; Type: TABLE DATA; Schema: public; Owner: u0_a377
--

COPY public.ebd_aluno_classe (id_aluno_classe, id_aluno, id_classe, data_inicio, data_fim, motivo, ativo) FROM stdin;
1	1	1	2026-07-13	\N	Primeira matrícula na classe.	t
2	2	1	2026-07-13	\N	Primeira matrícula na classe.	t
3	3	2	2026-07-13	\N	Primeira matrícula na classe.	t
4	4	2	2026-07-13	\N	Primeira matrícula na classe.	t
5	5	3	2026-07-13	\N	Primeira matrícula na classe.	t
6	6	3	2026-01-16	\N	Mudança de classe para Adolescente.	t
7	7	4	2026-07-13	\N	Primeira matrícula na classe.	t
8	8	4	2026-07-13	\N	Primeira matrícula na classe.	t
9	9	5	2026-07-13	\N	Primeira matrícula na classe.	t
10	10	5	2026-07-13	\N	Primeira matrícula na classe.	t
11	11	6	2026-07-13	\N	Primeira matrícula na classe.	t
12	12	6	2026-07-13	\N	Primeira matrícula na classe.	t
13	6	2	2025-02-01	2026-01-15	Registro histórico antes da transferência.	f
14	11	5	2024-01-10	2025-12-20	Registro histórico antes da transferência.	f
18	17	1	2026-07-21	\N	Matriculado pelo sistema	t
19	18	6	2026-07-21	\N	Matriculado pelo sistema	t
20	19	4	2026-07-21	\N	Matriculado pelo sistema	t
21	20	3	2026-07-21	\N	Matriculado pelo sistema	t
22	21	5	2026-07-22	\N	Matriculado pelo sistema	t
\.


--
-- Data for Name: ebd_aluno_status_historico; Type: TABLE DATA; Schema: public; Owner: u0_a377
--

COPY public.ebd_aluno_status_historico (id_aluno_status_historico, id_aluno, status_anterior, status_novo, origem, motivo, observacao, id_chamada, id_chamada_aluno, criado_em, criado_por) FROM stdin;
1	11	\N	ativo	carga_inicial		Aluna da classe de Senhoras	\N	\N	2026-07-14 13:44:21.421396-03	u0_a377
2	12	\N	ativo	carga_inicial		Aluna da classe de Senhoras	\N	\N	2026-07-14 13:44:21.421396-03	u0_a377
3	10	\N	ativo	carga_inicial		Aluna da classe de Senhores	\N	\N	2026-07-14 13:44:21.421396-03	u0_a377
4	2	\N	ativo	carga_inicial		Aluna da classe de Crianças Menores	\N	\N	2026-07-14 13:44:21.421396-03	u0_a377
5	5	\N	ativo	carga_inicial		Aluno da classe de Adolescentes	\N	\N	2026-07-14 13:44:21.421396-03	u0_a377
6	8	\N	ativo	carga_inicial		Aluna da classe de Jovens	\N	\N	2026-07-14 13:44:21.421396-03	u0_a377
7	6	\N	ativo	carga_inicial		Aluno transferido entre classes	\N	\N	2026-07-14 13:44:21.421396-03	u0_a377
8	4	\N	ativo	carga_inicial		Aluna da classe de Crianças Maiores	\N	\N	2026-07-14 13:44:21.421396-03	u0_a377
9	1	\N	ativo	carga_inicial		Aluno da classe de Crianças Menores	\N	\N	2026-07-14 13:44:21.421396-03	u0_a377
10	3	\N	ativo	carga_inicial		Aluna da classe de Crianças Maiores	\N	\N	2026-07-14 13:44:21.421396-03	u0_a377
11	9	\N	ativo	carga_inicial		Aluno da classe de Senhores	\N	\N	2026-07-14 13:44:21.421396-03	u0_a377
12	7	\N	ativo	carga_inicial		Aluno da classe de Jovens	\N	\N	2026-07-14 13:44:21.421396-03	u0_a377
13	20	ativo	inativo	manual	Teste de inativação	Aluno inativado via teste da API	\N	\N	2026-07-21 15:25:06.908886-03	u0_a377
14	6	ativo	inativo	manual	Teste de inativação	Aluno inativado via teste da API	\N	\N	2026-07-21 15:26:33.555144-03	u0_a377
\.


--
-- Data for Name: ebd_cadastro; Type: TABLE DATA; Schema: public; Owner: u0_a377
--

COPY public.ebd_cadastro (id_cadastro, nome, ativo, criado_em) FROM stdin;
1	Cadastro padrão	t	2026-07-16 12:57:16.207469-03
3	Dois de Julho	t	2026-07-16 13:51:14.80003-03
\.


--
-- Data for Name: ebd_chamada; Type: TABLE DATA; Schema: public; Owner: u0_a377
--

COPY public.ebd_chamada (id_chamada, id_classe, data_chamada, oferta, visitantes, biblias, revistas, observacao, criado_em, fechada, fechado_em, reaberta_em) FROM stdin;
1	1	2026-07-13	35.00	0	2	2	Culto da manhã com crianças.	2026-07-13 10:00:00-03	f	\N	\N
2	2	2026-07-13	52.50	1	1	1	Aula com participação especial.	2026-07-13 10:05:00-03	f	\N	\N
3	3	2026-07-13	40.00	0	3	1	Encontro da turma de adolescentes.	2026-07-13 10:10:00-03	f	\N	\N
4	4	2026-07-13	87.00	2	4	2	Classe de jovens com visitantes.	2026-07-13 10:15:00-03	f	\N	\N
5	5	2026-07-13	150.00	1	5	3	Aula com participação dos senhores.	2026-07-13 10:20:00-03	f	\N	\N
6	6	2026-07-13	110.00	1	4	2	Aula das senhoras com visitante.	2026-07-13 10:25:00-03	f	\N	\N
7	3	2026-07-06	28.00	0	2	1	Chamada da semana anterior para teste.	2026-07-06 10:00:00-03	t	2026-07-06 11:30:00-03	\N
8	5	2026-07-06	120.00	1	3	2	Chamada antiga da classe de senhores.	2026-07-06 10:15:00-03	t	2026-07-06 11:40:00-03	\N
13	2	2026-07-14	0.00	0	0	0		2026-07-14 12:33:27.087112-03	f	\N	\N
12	1	2026-07-14	0.00	0	0	0		2026-07-14 12:30:14.708603-03	t	2026-07-14 13:12:16.203417-03	\N
14	1	2026-07-19	0.00	0	0	0		2026-07-19 17:24:12.381247-03	f	\N	\N
16	2	2026-07-21	0.00	0	0	0		2026-07-21 11:13:39.559972-03	f	\N	\N
17	4	2026-07-21	0.00	0	0	0		2026-07-21 11:13:50.692143-03	f	\N	\N
18	5	2026-07-21	0.00	0	0	0		2026-07-21 11:14:14.81561-03	f	\N	\N
19	6	2026-07-21	0.00	0	0	0		2026-07-21 11:15:44.543874-03	f	\N	\N
20	1	2026-07-21	0.00	0	0	0		2026-07-21 14:27:42.236623-03	f	\N	\N
26	3	2026-07-21	0.00	0	0	0		2026-07-21 19:36:53.529855-03	f	\N	\N
27	3	2026-07-22	0.00	0	0	0		2026-07-22 07:32:45.741818-03	f	\N	\N
28	2	2026-07-22	0.00	0	0	0		2026-07-22 07:34:10.852379-03	f	\N	\N
29	1	2026-07-22	0.00	0	0	0		2026-07-22 07:34:41.232926-03	f	\N	\N
30	5	2026-07-22	0.00	0	0	0		2026-07-22 08:03:37.689756-03	f	\N	\N
31	4	2026-07-22	0.00	0	0	0		2026-07-22 08:11:21.604154-03	f	\N	\N
\.


--
-- Data for Name: ebd_chamada_aluno; Type: TABLE DATA; Schema: public; Owner: u0_a377
--

COPY public.ebd_chamada_aluno (id_chamada_aluno, id_chamada, id_aluno_classe, status, observacao) FROM stdin;
1	1	1	presente	
2	1	2	atrasado	Chegou após o início.
3	2	3	presente	
4	2	4	ausente	
5	3	5	presente	
6	3	6	atrasado	Chegou no final da lição.
7	4	7	presente	
8	4	8	presente	
9	5	9	ausente	
10	5	10	presente	
11	6	11	presente	
12	6	12	ausente	
13	7	5	presente	
14	7	6	ausente	
15	8	9	atrasado	Chegou com atraso.
16	8	10	presente	
50	26	5	ausente	
54	29	1	ausente	
55	29	2	ausente	
56	29	18	ausente	
25	13	3	ausente	
26	13	4	ausente	
57	30	9	ausente	
58	30	10	ausente	
23	12	1	atrasado	
24	12	2	presente	
27	14	1	presente	
28	14	2	presente	
39	19	11	ausente	
40	19	12	ausente	
41	19	19	ausente	
42	20	1	ausente	
43	20	2	ausente	
44	20	18	ausente	
51	27	5	presente	
60	31	8	presente	
61	31	20	atrasado	
32	16	3	presente	
33	16	4	atrasado	
35	17	8	presente	
36	17	20	atrasado	
34	17	7	ausente	
59	31	7	ausente	
52	28	3	presente	
38	18	10	ausente	
37	18	9	presente	
53	28	4	atrasado	
\.


--
-- Data for Name: ebd_chamada_visitante; Type: TABLE DATA; Schema: public; Owner: u0_a377
--

COPY public.ebd_chamada_visitante (id_chamada_visitante, id_chamada, nome, observacao, criado_em) FROM stdin;
1	2	Carlos Alberto	Visitante da vizinhança.	2026-07-13 10:30:00-03
2	4	Henrique Martins	Visitante convidado pelo grupo.	2026-07-13 10:35:00-03
3	4	Lúcia Martins	Esposa do visitante.	2026-07-13 10:35:30-03
4	5	Família Oliveira	Visita de apoio à turma.	2026-07-13 10:40:00-03
5	6	Sueli Barbosa	Primeira visita à classe.	2026-07-13 10:45:00-03
6	8	Antônio Silva	Conhecendo a EBD.	2026-07-06 10:50:00-03
\.


--
-- Data for Name: ebd_classe; Type: TABLE DATA; Schema: public; Owner: u0_a377
--

COPY public.ebd_classe (id_classe, nome, faixa_etaria, descricao, ativo, criado_em, id_cadastro) FROM stdin;
1	Crianças Menores	4 a 7 anos	Classe destinada às crianças menores.	t	2026-07-13 08:00:00-03	1
2	Crianças Maiores	8 a 11 anos	Classe destinada às crianças maiores.	t	2026-07-13 08:00:00-03	1
3	Adolescentes	12 a 17 anos	Classe destinada aos adolescentes.	t	2026-07-13 08:00:00-03	1
4	Jovens	18 a 29 anos	Classe destinada aos jovens.	t	2026-07-13 08:00:00-03	1
5	Senhores	30 anos ou mais	Classe destinada aos homens adultos.	t	2026-07-13 08:00:00-03	1
6	Senhoras	30 anos ou mais	Classe destinada às mulheres adultas.	t	2026-07-13 08:00:00-03	1
25	Crianças Menores	4 a 7 anos	Classe destinada às crianças menores.	t	2026-07-19 17:40:49.889461-03	3
26	Crianças Maiores	8 a 11 anos	Classe destinada às crianças maiores.	t	2026-07-19 17:40:49.889461-03	3
27	Adolescentes	12 a 17 anos	Classe destinada aos adolescentes.	t	2026-07-19 17:40:49.889461-03	3
28	Jovens	18 a 29 anos	Classe destinada aos jovens.	t	2026-07-19 17:40:49.889461-03	3
29	Senhores	30 anos ou mais	Classe destinada aos homens adultos.	t	2026-07-19 17:40:49.889461-03	3
30	Senhoras	30 anos ou mais	Classe destinada às mulheres adultas.	t	2026-07-19 17:40:49.889461-03	3
\.


--
-- Data for Name: ebd_funcao; Type: TABLE DATA; Schema: public; Owner: u0_a377
--

COPY public.ebd_funcao (id_funcao, nome, descricao, ativo) FROM stdin;
1	Professor	Responsável por ministrar aulas em uma classe	t
2	Secretário	Responsável pelos registros administrativos da EBD	t
3	Pastor	Liderança pastoral da igreja	t
4	Diretor	Direção geral da Escola Bíblica Dominical	t
5	Superintendente	Supervisão geral das classes e professores	t
6	Tesoureiro	Responsável pelas ofertas e finanças da EBD	t
7	Auxiliar	Apoio geral às atividades da classe	t
\.


--
-- Data for Name: ebd_perfil; Type: TABLE DATA; Schema: public; Owner: u0_a377
--

COPY public.ebd_perfil (id_perfil, nome, descricao, ativo) FROM stdin;
1	Administrador	Acesso completo ao sistema	t
2	Secretaria	Gestão de cadastros, chamadas e relatórios	t
3	Professor	Lançamento de chamada da própria classe	t
4	Consulta	Acesso somente leitura	t
5	Financeiro	Gestão de ofertas e relatórios financeiros	t
\.


--
-- Data for Name: ebd_pessoa; Type: TABLE DATA; Schema: public; Owner: u0_a377
--

COPY public.ebd_pessoa (id_pessoa, nome, sexo, cpf, data_nascimento, telefone, email, logradouro, numero, bairro, cidade, uf, cep, observacao, criado_em, atualizado_em, id_cadastro) FROM stdin;
25	Juninho	M		\N							  			2026-07-21 09:11:09.91325-03	2026-07-21 09:11:09.91325-03	1
26	Joilton	M		\N							  			2026-07-21 09:36:07.717018-03	2026-07-21 09:36:07.717018-03	1
27	Marcelo	M		\N							  			2026-07-21 10:05:34.85361-03	2026-07-21 10:05:34.85361-03	1
1	Ricardo Almeida	M	11122233344	1983-02-17	81988880001	ricardo.almeida@ebdteste.org	Rua do Cooperador	10	Centro	Recife	PE	50010000	Diretor e professor da EBD	2026-07-13 09:00:00-03	2026-07-19 16:45:48.94331-03	1
2	Patrícia Almeida	F	22233344455	1987-09-05	81988880002	patricia.almeida@ebdteste.org	Rua do Cooperador	12	Centro	Recife	PE	50010001	Secretária da EBD	2026-07-13 09:00:00-03	2026-07-19 16:45:48.94331-03	1
3	André Lima	M	33344455566	1978-11-22	81988880003	andre.lima@ebdteste.org	Av. Central	200	Boa Vista	Recife	PE	50060000	Pastor e superintendente	2026-07-13 09:00:00-03	2026-07-19 16:45:48.94331-03	1
4	Daniela Souza	F	44455566677	1991-04-13	81988880004	daniela.souza@ebdteste.org	Rua da Paz	88	Pina	Recife	PE	51010000	Tesoureira da EBD	2026-07-13 09:00:00-03	2026-07-19 16:45:48.94331-03	1
5	Pedro Santos	M	55566677788	2016-03-09	81988880005	pedro.santos@ebdteste.org	Rua Primavera	14	Casa Amarela	Recife	PE	52020000	Aluno da classe de Crianças Menores	2026-07-13 09:00:00-03	2026-07-19 16:45:48.94331-03	1
6	Elisa Santos	F	66677788899	2018-12-25	81988880006	elisa.santos@ebdteste.org	Rua Primavera	14	Casa Amarela	Recife	PE	52020000	Aluna da classe de Crianças Menores	2026-07-13 09:00:00-03	2026-07-19 16:45:48.94331-03	1
7	Mariana Silva	F	77788899900	2010-01-19	81988880007	mariana.silva@ebdteste.org	Rua das Mangueiras	40	Torre	Recife	PE	50710000	Aluna da classe de Crianças Maiores	2026-07-13 09:00:00-03	2026-07-19 16:45:48.94331-03	1
8	Sofia Nunes	F	88899900011	2012-02-02	81988880008	sofia.nunes@ebdteste.org	Rua das Mangueiras	42	Torre	Recife	PE	50710001	Aluna da classe de Crianças Maiores	2026-07-13 09:00:00-03	2026-07-19 16:45:48.94331-03	1
9	Lucas Silva	M	99900011122	2008-06-30	81988880009	lucas.silva@ebdteste.org	Rua do Estudante	18	Várzea	Recife	PE	50820000	Aluno da classe de Adolescentes	2026-07-13 09:00:00-03	2026-07-19 16:45:48.94331-03	1
10	Gabriel Nunes	M	00011122233	2011-09-11	81988880010	gabriel.nunes@ebdteste.org	Rua do Estudante	20	Várzea	Recife	PE	50820001	Aluno transferido entre classes	2026-07-13 09:00:00-03	2026-07-19 16:45:48.94331-03	1
11	Thiago Costa	M	10111222334	2002-07-08	81988880011	thiago.costa@ebdteste.org	Rua do Sol	150	Madalena	Recife	PE	50610000	Aluno da classe de Jovens	2026-07-13 09:00:00-03	2026-07-19 16:45:48.94331-03	1
12	Camila Costa	F	12131415161	2004-05-16	81988880012	camila.costa@ebdteste.org	Rua do Sol	152	Madalena	Recife	PE	50610001	Aluna da classe de Jovens	2026-07-13 09:00:00-03	2026-07-19 16:45:48.94331-03	1
13	Bruno Rocha	M	13141516171	1989-08-14	81988880013	bruno.rocha@ebdteste.org	Rua das Palmeiras	90	Boa Viagem	Recife	PE	51030000	Aluno da classe de Senhores	2026-07-13 09:00:00-03	2026-07-19 16:45:48.94331-03	1
14	Aline Freitas	F	14151617181	1993-10-21	81988880014	aline.freitas@ebdteste.org	Rua das Palmeiras	92	Boa Viagem	Recife	PE	51030001	Aluna da classe de Senhores	2026-07-13 09:00:00-03	2026-07-19 16:45:48.94331-03	1
15	Juliana Rocha	F	15161718191	1996-01-24	81988880015	juliana.rocha@ebdteste.org	Rua das Acácias	55	Imbiribeira	Recife	PE	51150000	Aluna da classe de Senhoras	2026-07-13 09:00:00-03	2026-07-19 16:45:48.94331-03	1
16	Marta Cunha	F	16171819202	1984-03-03	81988880016	marta.cunha@ebdteste.org	Rua das Acácias	57	Imbiribeira	Recife	PE	51150001	Aluna da classe de Senhoras	2026-07-13 09:00:00-03	2026-07-19 16:45:48.94331-03	1
22	Teste	nao_informado		\N							  			2026-07-19 15:56:35.410223-03	2026-07-19 16:45:48.94331-03	1
28	Breno	M		\N							  			2026-07-21 10:36:38.156523-03	2026-07-21 10:36:38.156523-03	1
29	Maicon	M		\N							  			2026-07-22 09:45:51.775941-03	2026-07-22 09:45:51.775941-03	1
30	Teste API	M		2010-01-01							  			2026-07-22 09:57:10.46098-03	2026-07-22 09:57:10.46098-03	1
\.


--
-- Data for Name: ebd_pessoa_funcao; Type: TABLE DATA; Schema: public; Owner: u0_a377
--

COPY public.ebd_pessoa_funcao (id_pessoa_funcao, id_pessoa, id_funcao, data_inicio, data_fim, ativo, observacao) FROM stdin;
1	1	1	2026-07-13	\N	t	Diretor e professor da EBD
2	1	4	2026-07-13	\N	t	Direção geral do trabalho
3	2	2	2026-07-13	\N	t	Secretaria da EBD
4	3	3	2026-07-13	\N	t	Apoio pastoral
5	3	5	2026-07-13	\N	t	Supervisão das classes
6	4	6	2026-07-13	\N	t	Controle de ofertas
7	4	7	2026-07-13	\N	t	Apoio administrativo
\.


--
-- Data for Name: ebd_usuario; Type: TABLE DATA; Schema: public; Owner: u0_a377
--

COPY public.ebd_usuario (id_usuario, id_pessoa, login, senha_hash, ultimo_login, ativo, criado_em, id_cadastro) FROM stdin;
1	1	ricardo.almeida	$2b$12$ExemploHashRicardo123456	\N	t	2026-07-13 09:00:00-03	1
2	2	patricia.almeida	$2b$12$ExemploHashPatricia12345	\N	t	2026-07-13 09:00:00-03	1
3	3	andre.lima	$2b$12$ExemploHashAndre123456789	\N	t	2026-07-13 09:00:00-03	1
4	4	daniela.souza	$2b$12$ExemploHashDaniela123456	\N	t	2026-07-13 09:00:00-03	1
9	22	teste	$2a$12$grrXxe8uuXpmYJlFfPMXxOuJhVfyMRRHKEduFKPO68p4qVVeWaC3i	2026-07-22 09:54:23.874625-03	t	2026-07-19 15:56:35.410223-03	1
\.


--
-- Data for Name: ebd_usuario_perfil; Type: TABLE DATA; Schema: public; Owner: u0_a377
--

COPY public.ebd_usuario_perfil (id_usuario_perfil, id_usuario, id_perfil) FROM stdin;
1	1	1
2	2	2
3	2	3
4	3	4
5	4	5
10	9	1
\.


--
-- Name: ebd_aluno_classe_id_aluno_classe_seq; Type: SEQUENCE SET; Schema: public; Owner: u0_a377
--

SELECT pg_catalog.setval('public.ebd_aluno_classe_id_aluno_classe_seq', 22, true);


--
-- Name: ebd_aluno_id_aluno_seq; Type: SEQUENCE SET; Schema: public; Owner: u0_a377
--

SELECT pg_catalog.setval('public.ebd_aluno_id_aluno_seq', 21, true);


--
-- Name: ebd_aluno_status_historico_id_aluno_status_historico_seq; Type: SEQUENCE SET; Schema: public; Owner: u0_a377
--

SELECT pg_catalog.setval('public.ebd_aluno_status_historico_id_aluno_status_historico_seq', 14, true);


--
-- Name: ebd_cadastro_id_cadastro_seq; Type: SEQUENCE SET; Schema: public; Owner: u0_a377
--

SELECT pg_catalog.setval('public.ebd_cadastro_id_cadastro_seq', 3, true);


--
-- Name: ebd_chamada_aluno_id_chamada_aluno_seq; Type: SEQUENCE SET; Schema: public; Owner: u0_a377
--

SELECT pg_catalog.setval('public.ebd_chamada_aluno_id_chamada_aluno_seq', 61, true);


--
-- Name: ebd_chamada_id_chamada_seq; Type: SEQUENCE SET; Schema: public; Owner: u0_a377
--

SELECT pg_catalog.setval('public.ebd_chamada_id_chamada_seq', 31, true);


--
-- Name: ebd_chamada_visitante_id_chamada_visitante_seq; Type: SEQUENCE SET; Schema: public; Owner: u0_a377
--

SELECT pg_catalog.setval('public.ebd_chamada_visitante_id_chamada_visitante_seq', 9, true);


--
-- Name: ebd_classe_id_classe_seq; Type: SEQUENCE SET; Schema: public; Owner: u0_a377
--

SELECT pg_catalog.setval('public.ebd_classe_id_classe_seq', 30, true);


--
-- Name: ebd_funcao_id_funcao_seq; Type: SEQUENCE SET; Schema: public; Owner: u0_a377
--

SELECT pg_catalog.setval('public.ebd_funcao_id_funcao_seq', 7, true);


--
-- Name: ebd_perfil_id_perfil_seq; Type: SEQUENCE SET; Schema: public; Owner: u0_a377
--

SELECT pg_catalog.setval('public.ebd_perfil_id_perfil_seq', 5, true);


--
-- Name: ebd_pessoa_funcao_id_pessoa_funcao_seq; Type: SEQUENCE SET; Schema: public; Owner: u0_a377
--

SELECT pg_catalog.setval('public.ebd_pessoa_funcao_id_pessoa_funcao_seq', 7, true);


--
-- Name: ebd_pessoa_id_pessoa_seq; Type: SEQUENCE SET; Schema: public; Owner: u0_a377
--

SELECT pg_catalog.setval('public.ebd_pessoa_id_pessoa_seq', 30, true);


--
-- Name: ebd_usuario_id_usuario_seq; Type: SEQUENCE SET; Schema: public; Owner: u0_a377
--

SELECT pg_catalog.setval('public.ebd_usuario_id_usuario_seq', 11, true);


--
-- Name: ebd_usuario_perfil_id_usuario_perfil_seq; Type: SEQUENCE SET; Schema: public; Owner: u0_a377
--

SELECT pg_catalog.setval('public.ebd_usuario_perfil_id_usuario_perfil_seq', 10, true);


--
-- Name: account account_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: u0_a377
--

ALTER TABLE ONLY neon_auth.account
    ADD CONSTRAINT account_pkey PRIMARY KEY (id);


--
-- Name: invitation invitation_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: u0_a377
--

ALTER TABLE ONLY neon_auth.invitation
    ADD CONSTRAINT invitation_pkey PRIMARY KEY (id);


--
-- Name: jwks jwks_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: u0_a377
--

ALTER TABLE ONLY neon_auth.jwks
    ADD CONSTRAINT jwks_pkey PRIMARY KEY (id);


--
-- Name: member member_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: u0_a377
--

ALTER TABLE ONLY neon_auth.member
    ADD CONSTRAINT member_pkey PRIMARY KEY (id);


--
-- Name: organization organization_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: u0_a377
--

ALTER TABLE ONLY neon_auth.organization
    ADD CONSTRAINT organization_pkey PRIMARY KEY (id);


--
-- Name: organization organization_slug_key; Type: CONSTRAINT; Schema: neon_auth; Owner: u0_a377
--

ALTER TABLE ONLY neon_auth.organization
    ADD CONSTRAINT organization_slug_key UNIQUE (slug);


--
-- Name: project_config project_config_endpoint_id_key; Type: CONSTRAINT; Schema: neon_auth; Owner: u0_a377
--

ALTER TABLE ONLY neon_auth.project_config
    ADD CONSTRAINT project_config_endpoint_id_key UNIQUE (endpoint_id);


--
-- Name: project_config project_config_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: u0_a377
--

ALTER TABLE ONLY neon_auth.project_config
    ADD CONSTRAINT project_config_pkey PRIMARY KEY (id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: u0_a377
--

ALTER TABLE ONLY neon_auth.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (id);


--
-- Name: session session_token_key; Type: CONSTRAINT; Schema: neon_auth; Owner: u0_a377
--

ALTER TABLE ONLY neon_auth.session
    ADD CONSTRAINT session_token_key UNIQUE (token);


--
-- Name: user user_email_key; Type: CONSTRAINT; Schema: neon_auth; Owner: u0_a377
--

ALTER TABLE ONLY neon_auth."user"
    ADD CONSTRAINT user_email_key UNIQUE (email);


--
-- Name: user user_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: u0_a377
--

ALTER TABLE ONLY neon_auth."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);


--
-- Name: verification verification_pkey; Type: CONSTRAINT; Schema: neon_auth; Owner: u0_a377
--

ALTER TABLE ONLY neon_auth.verification
    ADD CONSTRAINT verification_pkey PRIMARY KEY (id);


--
-- Name: ebd_aluno_classe ebd_aluno_classe_pkey; Type: CONSTRAINT; Schema: public; Owner: u0_a377
--

ALTER TABLE ONLY public.ebd_aluno_classe
    ADD CONSTRAINT ebd_aluno_classe_pkey PRIMARY KEY (id_aluno_classe);


--
-- Name: ebd_aluno ebd_aluno_pkey; Type: CONSTRAINT; Schema: public; Owner: u0_a377
--

ALTER TABLE ONLY public.ebd_aluno
    ADD CONSTRAINT ebd_aluno_pkey PRIMARY KEY (id_aluno);


--
-- Name: ebd_aluno_status_historico ebd_aluno_status_historico_pkey; Type: CONSTRAINT; Schema: public; Owner: u0_a377
--

ALTER TABLE ONLY public.ebd_aluno_status_historico
    ADD CONSTRAINT ebd_aluno_status_historico_pkey PRIMARY KEY (id_aluno_status_historico);


--
-- Name: ebd_cadastro ebd_cadastro_pkey; Type: CONSTRAINT; Schema: public; Owner: u0_a377
--

ALTER TABLE ONLY public.ebd_cadastro
    ADD CONSTRAINT ebd_cadastro_pkey PRIMARY KEY (id_cadastro);


--
-- Name: ebd_chamada_aluno ebd_chamada_aluno_pkey; Type: CONSTRAINT; Schema: public; Owner: u0_a377
--

ALTER TABLE ONLY public.ebd_chamada_aluno
    ADD CONSTRAINT ebd_chamada_aluno_pkey PRIMARY KEY (id_chamada_aluno);


--
-- Name: ebd_chamada ebd_chamada_pkey; Type: CONSTRAINT; Schema: public; Owner: u0_a377
--

ALTER TABLE ONLY public.ebd_chamada
    ADD CONSTRAINT ebd_chamada_pkey PRIMARY KEY (id_chamada);


--
-- Name: ebd_chamada_visitante ebd_chamada_visitante_pkey; Type: CONSTRAINT; Schema: public; Owner: u0_a377
--

ALTER TABLE ONLY public.ebd_chamada_visitante
    ADD CONSTRAINT ebd_chamada_visitante_pkey PRIMARY KEY (id_chamada_visitante);


--
-- Name: ebd_classe ebd_classe_pkey; Type: CONSTRAINT; Schema: public; Owner: u0_a377
--

ALTER TABLE ONLY public.ebd_classe
    ADD CONSTRAINT ebd_classe_pkey PRIMARY KEY (id_classe);


--
-- Name: ebd_funcao ebd_funcao_pkey; Type: CONSTRAINT; Schema: public; Owner: u0_a377
--

ALTER TABLE ONLY public.ebd_funcao
    ADD CONSTRAINT ebd_funcao_pkey PRIMARY KEY (id_funcao);


--
-- Name: ebd_perfil ebd_perfil_pkey; Type: CONSTRAINT; Schema: public; Owner: u0_a377
--

ALTER TABLE ONLY public.ebd_perfil
    ADD CONSTRAINT ebd_perfil_pkey PRIMARY KEY (id_perfil);


--
-- Name: ebd_pessoa_funcao ebd_pessoa_funcao_pkey; Type: CONSTRAINT; Schema: public; Owner: u0_a377
--

ALTER TABLE ONLY public.ebd_pessoa_funcao
    ADD CONSTRAINT ebd_pessoa_funcao_pkey PRIMARY KEY (id_pessoa_funcao);


--
-- Name: ebd_pessoa ebd_pessoa_pkey; Type: CONSTRAINT; Schema: public; Owner: u0_a377
--

ALTER TABLE ONLY public.ebd_pessoa
    ADD CONSTRAINT ebd_pessoa_pkey PRIMARY KEY (id_pessoa);


--
-- Name: ebd_usuario_perfil ebd_usuario_perfil_pkey; Type: CONSTRAINT; Schema: public; Owner: u0_a377
--

ALTER TABLE ONLY public.ebd_usuario_perfil
    ADD CONSTRAINT ebd_usuario_perfil_pkey PRIMARY KEY (id_usuario_perfil);


--
-- Name: ebd_usuario ebd_usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: u0_a377
--

ALTER TABLE ONLY public.ebd_usuario
    ADD CONSTRAINT ebd_usuario_pkey PRIMARY KEY (id_usuario);


--
-- Name: ebd_aluno uq_ebd_aluno_pessoa; Type: CONSTRAINT; Schema: public; Owner: u0_a377
--

ALTER TABLE ONLY public.ebd_aluno
    ADD CONSTRAINT uq_ebd_aluno_pessoa UNIQUE (id_pessoa);


--
-- Name: ebd_chamada uq_ebd_chamada; Type: CONSTRAINT; Schema: public; Owner: u0_a377
--

ALTER TABLE ONLY public.ebd_chamada
    ADD CONSTRAINT uq_ebd_chamada UNIQUE (id_classe, data_chamada);


--
-- Name: ebd_chamada_aluno uq_ebd_chamada_aluno; Type: CONSTRAINT; Schema: public; Owner: u0_a377
--

ALTER TABLE ONLY public.ebd_chamada_aluno
    ADD CONSTRAINT uq_ebd_chamada_aluno UNIQUE (id_chamada, id_aluno_classe);


--
-- Name: ebd_usuario_perfil uq_ebd_usuario_perfil; Type: CONSTRAINT; Schema: public; Owner: u0_a377
--

ALTER TABLE ONLY public.ebd_usuario_perfil
    ADD CONSTRAINT uq_ebd_usuario_perfil UNIQUE (id_usuario, id_perfil);


--
-- Name: ebd_usuario uq_ebd_usuario_pessoa; Type: CONSTRAINT; Schema: public; Owner: u0_a377
--

ALTER TABLE ONLY public.ebd_usuario
    ADD CONSTRAINT uq_ebd_usuario_pessoa UNIQUE (id_pessoa);


--
-- Name: account_userId_idx; Type: INDEX; Schema: neon_auth; Owner: u0_a377
--

CREATE INDEX "account_userId_idx" ON neon_auth.account USING btree ("userId");


--
-- Name: invitation_email_idx; Type: INDEX; Schema: neon_auth; Owner: u0_a377
--

CREATE INDEX invitation_email_idx ON neon_auth.invitation USING btree (email);


--
-- Name: invitation_organizationId_idx; Type: INDEX; Schema: neon_auth; Owner: u0_a377
--

CREATE INDEX "invitation_organizationId_idx" ON neon_auth.invitation USING btree ("organizationId");


--
-- Name: member_organizationId_idx; Type: INDEX; Schema: neon_auth; Owner: u0_a377
--

CREATE INDEX "member_organizationId_idx" ON neon_auth.member USING btree ("organizationId");


--
-- Name: member_userId_idx; Type: INDEX; Schema: neon_auth; Owner: u0_a377
--

CREATE INDEX "member_userId_idx" ON neon_auth.member USING btree ("userId");


--
-- Name: organization_slug_uidx; Type: INDEX; Schema: neon_auth; Owner: u0_a377
--

CREATE UNIQUE INDEX organization_slug_uidx ON neon_auth.organization USING btree (slug);


--
-- Name: session_userId_idx; Type: INDEX; Schema: neon_auth; Owner: u0_a377
--

CREATE INDEX "session_userId_idx" ON neon_auth.session USING btree ("userId");


--
-- Name: verification_identifier_idx; Type: INDEX; Schema: neon_auth; Owner: u0_a377
--

CREATE INDEX verification_identifier_idx ON neon_auth.verification USING btree (identifier);


--
-- Name: idx_ebd_aluno_classe_aluno; Type: INDEX; Schema: public; Owner: u0_a377
--

CREATE INDEX idx_ebd_aluno_classe_aluno ON public.ebd_aluno_classe USING btree (id_aluno);


--
-- Name: idx_ebd_aluno_classe_classe; Type: INDEX; Schema: public; Owner: u0_a377
--

CREATE INDEX idx_ebd_aluno_classe_classe ON public.ebd_aluno_classe USING btree (id_classe);


--
-- Name: idx_ebd_aluno_status; Type: INDEX; Schema: public; Owner: u0_a377
--

CREATE INDEX idx_ebd_aluno_status ON public.ebd_aluno USING btree (status);


--
-- Name: idx_ebd_aluno_status_historico_aluno; Type: INDEX; Schema: public; Owner: u0_a377
--

CREATE INDEX idx_ebd_aluno_status_historico_aluno ON public.ebd_aluno_status_historico USING btree (id_aluno);


--
-- Name: idx_ebd_aluno_status_historico_chamada; Type: INDEX; Schema: public; Owner: u0_a377
--

CREATE INDEX idx_ebd_aluno_status_historico_chamada ON public.ebd_aluno_status_historico USING btree (id_chamada);


--
-- Name: idx_ebd_aluno_status_historico_data; Type: INDEX; Schema: public; Owner: u0_a377
--

CREATE INDEX idx_ebd_aluno_status_historico_data ON public.ebd_aluno_status_historico USING btree (criado_em DESC);


--
-- Name: idx_ebd_chamada_aluno_aluno_classe; Type: INDEX; Schema: public; Owner: u0_a377
--

CREATE INDEX idx_ebd_chamada_aluno_aluno_classe ON public.ebd_chamada_aluno USING btree (id_aluno_classe);


--
-- Name: idx_ebd_chamada_aluno_chamada; Type: INDEX; Schema: public; Owner: u0_a377
--

CREATE INDEX idx_ebd_chamada_aluno_chamada ON public.ebd_chamada_aluno USING btree (id_chamada);


--
-- Name: idx_ebd_chamada_visitante_chamada; Type: INDEX; Schema: public; Owner: u0_a377
--

CREATE INDEX idx_ebd_chamada_visitante_chamada ON public.ebd_chamada_visitante USING btree (id_chamada);


--
-- Name: idx_ebd_classe_id_cadastro; Type: INDEX; Schema: public; Owner: u0_a377
--

CREATE INDEX idx_ebd_classe_id_cadastro ON public.ebd_classe USING btree (id_cadastro);


--
-- Name: idx_ebd_pessoa_funcao_funcao; Type: INDEX; Schema: public; Owner: u0_a377
--

CREATE INDEX idx_ebd_pessoa_funcao_funcao ON public.ebd_pessoa_funcao USING btree (id_funcao);


--
-- Name: idx_ebd_pessoa_funcao_pessoa; Type: INDEX; Schema: public; Owner: u0_a377
--

CREATE INDEX idx_ebd_pessoa_funcao_pessoa ON public.ebd_pessoa_funcao USING btree (id_pessoa);


--
-- Name: idx_ebd_pessoa_id_cadastro; Type: INDEX; Schema: public; Owner: u0_a377
--

CREATE INDEX idx_ebd_pessoa_id_cadastro ON public.ebd_pessoa USING btree (id_cadastro);


--
-- Name: idx_ebd_pessoa_nome; Type: INDEX; Schema: public; Owner: u0_a377
--

CREATE INDEX idx_ebd_pessoa_nome ON public.ebd_pessoa USING btree (lower(btrim(nome)));


--
-- Name: idx_ebd_pessoa_telefone; Type: INDEX; Schema: public; Owner: u0_a377
--

CREATE INDEX idx_ebd_pessoa_telefone ON public.ebd_pessoa USING btree (telefone) WHERE (telefone <> ''::text);


--
-- Name: idx_ebd_usuario_id_cadastro; Type: INDEX; Schema: public; Owner: u0_a377
--

CREATE INDEX idx_ebd_usuario_id_cadastro ON public.ebd_usuario USING btree (id_cadastro);


--
-- Name: idx_ebd_usuario_perfil_perfil; Type: INDEX; Schema: public; Owner: u0_a377
--

CREATE INDEX idx_ebd_usuario_perfil_perfil ON public.ebd_usuario_perfil USING btree (id_perfil);


--
-- Name: idx_ebd_usuario_perfil_usuario; Type: INDEX; Schema: public; Owner: u0_a377
--

CREATE INDEX idx_ebd_usuario_perfil_usuario ON public.ebd_usuario_perfil USING btree (id_usuario);


--
-- Name: uq_ebd_aluno_classe_ativa; Type: INDEX; Schema: public; Owner: u0_a377
--

CREATE UNIQUE INDEX uq_ebd_aluno_classe_ativa ON public.ebd_aluno_classe USING btree (id_aluno) WHERE (ativo = true);


--
-- Name: uq_ebd_aluno_matricula; Type: INDEX; Schema: public; Owner: u0_a377
--

CREATE UNIQUE INDEX uq_ebd_aluno_matricula ON public.ebd_aluno USING btree (matricula) WHERE (matricula <> ''::text);


--
-- Name: uq_ebd_classe_nome; Type: INDEX; Schema: public; Owner: u0_a377
--

CREATE UNIQUE INDEX uq_ebd_classe_nome ON public.ebd_classe USING btree (id_cadastro, lower(btrim(nome)));


--
-- Name: uq_ebd_funcao_nome; Type: INDEX; Schema: public; Owner: u0_a377
--

CREATE UNIQUE INDEX uq_ebd_funcao_nome ON public.ebd_funcao USING btree (lower(btrim(nome)));


--
-- Name: uq_ebd_perfil_nome; Type: INDEX; Schema: public; Owner: u0_a377
--

CREATE UNIQUE INDEX uq_ebd_perfil_nome ON public.ebd_perfil USING btree (lower(btrim(nome)));


--
-- Name: uq_ebd_pessoa_cpf; Type: INDEX; Schema: public; Owner: u0_a377
--

CREATE UNIQUE INDEX uq_ebd_pessoa_cpf ON public.ebd_pessoa USING btree (cpf) WHERE (cpf <> ''::text);


--
-- Name: uq_ebd_pessoa_funcao_ativa; Type: INDEX; Schema: public; Owner: u0_a377
--

CREATE UNIQUE INDEX uq_ebd_pessoa_funcao_ativa ON public.ebd_pessoa_funcao USING btree (id_pessoa, id_funcao) WHERE (ativo = true);


--
-- Name: uq_ebd_usuario_login; Type: INDEX; Schema: public; Owner: u0_a377
--

CREATE UNIQUE INDEX uq_ebd_usuario_login ON public.ebd_usuario USING btree (lower(btrim(login)));


--
-- Name: ebd_aluno_classe trg_ebd_aluno_classe_validar_cadastro; Type: TRIGGER; Schema: public; Owner: u0_a377
--

CREATE TRIGGER trg_ebd_aluno_classe_validar_cadastro BEFORE INSERT OR UPDATE OF id_aluno, id_classe ON public.ebd_aluno_classe FOR EACH ROW EXECUTE FUNCTION public.fn_ebd_trg_validar_aluno_classe_cadastro();


--
-- Name: ebd_cadastro trg_ebd_cadastro_criar_classes_padrao; Type: TRIGGER; Schema: public; Owner: u0_a377
--

CREATE TRIGGER trg_ebd_cadastro_criar_classes_padrao AFTER INSERT ON public.ebd_cadastro FOR EACH ROW EXECUTE FUNCTION public.fn_ebd_trg_cadastro_criar_classes_padrao();


--
-- Name: ebd_pessoa trg_ebd_pessoa_atualizado_em; Type: TRIGGER; Schema: public; Owner: u0_a377
--

CREATE TRIGGER trg_ebd_pessoa_atualizado_em BEFORE UPDATE ON public.ebd_pessoa FOR EACH ROW EXECUTE FUNCTION public.fn_ebd_set_atualizado_em();


--
-- Name: account account_userId_fkey; Type: FK CONSTRAINT; Schema: neon_auth; Owner: u0_a377
--

ALTER TABLE ONLY neon_auth.account
    ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES neon_auth."user"(id) ON DELETE CASCADE;


--
-- Name: invitation invitation_inviterId_fkey; Type: FK CONSTRAINT; Schema: neon_auth; Owner: u0_a377
--

ALTER TABLE ONLY neon_auth.invitation
    ADD CONSTRAINT "invitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES neon_auth."user"(id) ON DELETE CASCADE;


--
-- Name: invitation invitation_organizationId_fkey; Type: FK CONSTRAINT; Schema: neon_auth; Owner: u0_a377
--

ALTER TABLE ONLY neon_auth.invitation
    ADD CONSTRAINT "invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES neon_auth.organization(id) ON DELETE CASCADE;


--
-- Name: member member_organizationId_fkey; Type: FK CONSTRAINT; Schema: neon_auth; Owner: u0_a377
--

ALTER TABLE ONLY neon_auth.member
    ADD CONSTRAINT "member_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES neon_auth.organization(id) ON DELETE CASCADE;


--
-- Name: member member_userId_fkey; Type: FK CONSTRAINT; Schema: neon_auth; Owner: u0_a377
--

ALTER TABLE ONLY neon_auth.member
    ADD CONSTRAINT "member_userId_fkey" FOREIGN KEY ("userId") REFERENCES neon_auth."user"(id) ON DELETE CASCADE;


--
-- Name: session session_userId_fkey; Type: FK CONSTRAINT; Schema: neon_auth; Owner: u0_a377
--

ALTER TABLE ONLY neon_auth.session
    ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES neon_auth."user"(id) ON DELETE CASCADE;


--
-- Name: ebd_classe ebd_classe_id_cadastro_fkey; Type: FK CONSTRAINT; Schema: public; Owner: u0_a377
--

ALTER TABLE ONLY public.ebd_classe
    ADD CONSTRAINT ebd_classe_id_cadastro_fkey FOREIGN KEY (id_cadastro) REFERENCES public.ebd_cadastro(id_cadastro);


--
-- Name: ebd_pessoa ebd_pessoa_id_cadastro_fkey; Type: FK CONSTRAINT; Schema: public; Owner: u0_a377
--

ALTER TABLE ONLY public.ebd_pessoa
    ADD CONSTRAINT ebd_pessoa_id_cadastro_fkey FOREIGN KEY (id_cadastro) REFERENCES public.ebd_cadastro(id_cadastro);


--
-- Name: ebd_usuario ebd_usuario_id_cadastro_fkey; Type: FK CONSTRAINT; Schema: public; Owner: u0_a377
--

ALTER TABLE ONLY public.ebd_usuario
    ADD CONSTRAINT ebd_usuario_id_cadastro_fkey FOREIGN KEY (id_cadastro) REFERENCES public.ebd_cadastro(id_cadastro);


--
-- Name: ebd_aluno_status_historico fk_aluno_status_hist_aluno; Type: FK CONSTRAINT; Schema: public; Owner: u0_a377
--

ALTER TABLE ONLY public.ebd_aluno_status_historico
    ADD CONSTRAINT fk_aluno_status_hist_aluno FOREIGN KEY (id_aluno) REFERENCES public.ebd_aluno(id_aluno) ON DELETE CASCADE;


--
-- Name: ebd_aluno_status_historico fk_aluno_status_hist_chamada; Type: FK CONSTRAINT; Schema: public; Owner: u0_a377
--

ALTER TABLE ONLY public.ebd_aluno_status_historico
    ADD CONSTRAINT fk_aluno_status_hist_chamada FOREIGN KEY (id_chamada) REFERENCES public.ebd_chamada(id_chamada) ON DELETE SET NULL;


--
-- Name: ebd_aluno_status_historico fk_aluno_status_hist_chamada_aluno; Type: FK CONSTRAINT; Schema: public; Owner: u0_a377
--

ALTER TABLE ONLY public.ebd_aluno_status_historico
    ADD CONSTRAINT fk_aluno_status_hist_chamada_aluno FOREIGN KEY (id_chamada_aluno) REFERENCES public.ebd_chamada_aluno(id_chamada_aluno) ON DELETE SET NULL;


--
-- Name: ebd_aluno_classe fk_ebd_aluno_classe_aluno; Type: FK CONSTRAINT; Schema: public; Owner: u0_a377
--

ALTER TABLE ONLY public.ebd_aluno_classe
    ADD CONSTRAINT fk_ebd_aluno_classe_aluno FOREIGN KEY (id_aluno) REFERENCES public.ebd_aluno(id_aluno) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ebd_aluno_classe fk_ebd_aluno_classe_classe; Type: FK CONSTRAINT; Schema: public; Owner: u0_a377
--

ALTER TABLE ONLY public.ebd_aluno_classe
    ADD CONSTRAINT fk_ebd_aluno_classe_classe FOREIGN KEY (id_classe) REFERENCES public.ebd_classe(id_classe) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ebd_aluno fk_ebd_aluno_pessoa; Type: FK CONSTRAINT; Schema: public; Owner: u0_a377
--

ALTER TABLE ONLY public.ebd_aluno
    ADD CONSTRAINT fk_ebd_aluno_pessoa FOREIGN KEY (id_pessoa) REFERENCES public.ebd_pessoa(id_pessoa) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ebd_chamada_aluno fk_ebd_chamada_aluno_aluno_classe; Type: FK CONSTRAINT; Schema: public; Owner: u0_a377
--

ALTER TABLE ONLY public.ebd_chamada_aluno
    ADD CONSTRAINT fk_ebd_chamada_aluno_aluno_classe FOREIGN KEY (id_aluno_classe) REFERENCES public.ebd_aluno_classe(id_aluno_classe) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ebd_chamada_aluno fk_ebd_chamada_aluno_chamada; Type: FK CONSTRAINT; Schema: public; Owner: u0_a377
--

ALTER TABLE ONLY public.ebd_chamada_aluno
    ADD CONSTRAINT fk_ebd_chamada_aluno_chamada FOREIGN KEY (id_chamada) REFERENCES public.ebd_chamada(id_chamada) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ebd_chamada fk_ebd_chamada_classe; Type: FK CONSTRAINT; Schema: public; Owner: u0_a377
--

ALTER TABLE ONLY public.ebd_chamada
    ADD CONSTRAINT fk_ebd_chamada_classe FOREIGN KEY (id_classe) REFERENCES public.ebd_classe(id_classe) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ebd_chamada_visitante fk_ebd_chamada_visitante_chamada; Type: FK CONSTRAINT; Schema: public; Owner: u0_a377
--

ALTER TABLE ONLY public.ebd_chamada_visitante
    ADD CONSTRAINT fk_ebd_chamada_visitante_chamada FOREIGN KEY (id_chamada) REFERENCES public.ebd_chamada(id_chamada) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ebd_pessoa_funcao fk_ebd_pessoa_funcao_funcao; Type: FK CONSTRAINT; Schema: public; Owner: u0_a377
--

ALTER TABLE ONLY public.ebd_pessoa_funcao
    ADD CONSTRAINT fk_ebd_pessoa_funcao_funcao FOREIGN KEY (id_funcao) REFERENCES public.ebd_funcao(id_funcao) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ebd_pessoa_funcao fk_ebd_pessoa_funcao_pessoa; Type: FK CONSTRAINT; Schema: public; Owner: u0_a377
--

ALTER TABLE ONLY public.ebd_pessoa_funcao
    ADD CONSTRAINT fk_ebd_pessoa_funcao_pessoa FOREIGN KEY (id_pessoa) REFERENCES public.ebd_pessoa(id_pessoa) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ebd_usuario_perfil fk_ebd_usuario_perfil_perfil; Type: FK CONSTRAINT; Schema: public; Owner: u0_a377
--

ALTER TABLE ONLY public.ebd_usuario_perfil
    ADD CONSTRAINT fk_ebd_usuario_perfil_perfil FOREIGN KEY (id_perfil) REFERENCES public.ebd_perfil(id_perfil) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ebd_usuario_perfil fk_ebd_usuario_perfil_usuario; Type: FK CONSTRAINT; Schema: public; Owner: u0_a377
--

ALTER TABLE ONLY public.ebd_usuario_perfil
    ADD CONSTRAINT fk_ebd_usuario_perfil_usuario FOREIGN KEY (id_usuario) REFERENCES public.ebd_usuario(id_usuario) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ebd_usuario fk_ebd_usuario_pessoa; Type: FK CONSTRAINT; Schema: public; Owner: u0_a377
--

ALTER TABLE ONLY public.ebd_usuario
    ADD CONSTRAINT fk_ebd_usuario_pessoa FOREIGN KEY (id_pessoa) REFERENCES public.ebd_pessoa(id_pessoa) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict bGRjZxZJx0tTFzXl5xV02lLYYpYhYQNXA3Ope9HewnBifk8s8EBFO4LXlbKPyqC

