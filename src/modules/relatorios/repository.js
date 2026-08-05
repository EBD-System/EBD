const { query } = require('../../db');

async function getPresenceRanking(date, idCadastro) {
  const result = await query(
    `
    WITH tenant_classes AS (
      SELECT id_classe, nome
      FROM public.ebd_classe
      WHERE id_cadastro = $2
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
      FROM public.ebd_chamada c
      INNER JOIN tenant_classes tc
        ON tc.id_classe = c.id_classe
      INNER JOIN public.ebd_chamada_aluno ca
        ON ca.id_chamada = c.id_chamada
      INNER JOIN public.ebd_aluno_classe ac
        ON ac.id_aluno_classe = ca.id_aluno_classe
       AND ac.id_classe = c.id_classe
      INNER JOIN public.ebd_aluno a
        ON a.id_aluno = ac.id_aluno
      INNER JOIN public.ebd_pessoa p
        ON p.id_pessoa = a.id_pessoa
       AND p.id_cadastro = $2
      WHERE c.data_chamada = $1
        AND a.status = 'ativo'
      GROUP BY c.id_classe, tc.nome
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
    ORDER BY b.percentual_presenca DESC, b.classe ASC
    `,
    [date, idCadastro]
  );
  return result.rows;
}

async function getVisitorRanking(date, idCadastro) {
  const result = await query(
    `
    WITH tenant_classes AS (
      SELECT id_classe, nome
      FROM public.ebd_classe
      WHERE id_cadastro = $2
    ),
    base AS (
      SELECT
        c.id_classe,
        tc.nome AS classe,
        COALESCE(SUM(c.visitantes), 0)::integer AS visitantes
      FROM public.ebd_chamada c
      INNER JOIN tenant_classes tc
        ON tc.id_classe = c.id_classe
      WHERE c.data_chamada = $1
      GROUP BY c.id_classe, tc.nome
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
    ORDER BY b.visitantes DESC, b.classe ASC
    `,
    [date, idCadastro]
  );
  return result.rows;
}

async function getOfferRanking(date, idCadastro) {
  const result = await query(
    `
    WITH tenant_classes AS (
      SELECT id_classe, nome
      FROM public.ebd_classe
      WHERE id_cadastro = $2
    ),
    base AS (
      SELECT
        c.id_classe,
        tc.nome AS classe,
        COALESCE(SUM(c.oferta), 0)::numeric(10,2) AS valor_oferta
      FROM public.ebd_chamada c
      INNER JOIN tenant_classes tc
        ON tc.id_classe = c.id_classe
      WHERE c.data_chamada = $1
      GROUP BY c.id_classe, tc.nome
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
    ORDER BY b.valor_oferta DESC, b.classe ASC
    `,
    [date, idCadastro]
  );
  return result.rows;
}

async function getBirthdays(date, idCadastro) {
  const result = await query(
    `
    WITH tenant_people AS (
      SELECT
        id_pessoa,
        nome,
        data_nascimento
      FROM public.ebd_pessoa
      WHERE data_nascimento IS NOT NULL
        AND id_cadastro = $2
    ),
    base AS (
      SELECT
        p.id_pessoa,
        p.nome,
        p.data_nascimento,
        public.fn_ebd_data_aniversario_no_ano(p.data_nascimento, EXTRACT(YEAR FROM $1::date)::integer) AS aniversario_no_ano,
        EXTRACT(YEAR FROM AGE($1::date, p.data_nascimento))::integer AS idade
      FROM tenant_people p
    )
    SELECT
      'semana_passada'::text AS periodo,
      b.id_pessoa,
      b.nome,
      b.data_nascimento,
      b.aniversario_no_ano,
      b.idade
    FROM base b
    WHERE b.aniversario_no_ano BETWEEN ($1::date - INTERVAL '7 days')::date
                                   AND ($1::date - INTERVAL '1 day')::date

    UNION ALL

    SELECT
      'semana_seguinte'::text AS periodo,
      b.id_pessoa,
      b.nome,
      b.data_nascimento,
      b.aniversario_no_ano,
      b.idade
    FROM base b
    WHERE b.aniversario_no_ano BETWEEN ($1::date + INTERVAL '1 day')::date
                                   AND ($1::date + INTERVAL '7 days')::date

    UNION ALL

    SELECT
      'mes_atual'::text AS periodo,
      b.id_pessoa,
      b.nome,
      b.data_nascimento,
      b.aniversario_no_ano,
      b.idade
    FROM base b
    WHERE EXTRACT(MONTH FROM b.data_nascimento) = EXTRACT(MONTH FROM $1::date)

    UNION ALL

    SELECT
      'trimestre_atual'::text AS periodo,
      b.id_pessoa,
      b.nome,
      b.data_nascimento,
      b.aniversario_no_ano,
      b.idade
    FROM base b
    WHERE EXTRACT(QUARTER FROM b.data_nascimento) = EXTRACT(QUARTER FROM $1::date)

    ORDER BY periodo, aniversario_no_ano, nome
    `,
    [date, idCadastro]
  );
  return result.rows;
}


async function getPeriodReport(startDate, endDate, idCadastro) {
  const summaryResult = await query(
    `
    WITH tenant_classes AS (
      SELECT id_classe
      FROM public.ebd_classe
      WHERE id_cadastro = $3
    ),
    base AS (
      SELECT
        c.id_chamada,
        c.id_classe,
        c.data_chamada,
        COALESCE(c.oferta, 0)::numeric(10,2) AS oferta,
        COALESCE(c.visitantes, 0)::integer AS visitantes,
        COALESCE(c.biblias, 0)::integer AS biblias,
        COALESCE(c.revistas, 0)::integer AS revistas,
        COUNT(*) FILTER (WHERE ca.status IN ('presente', 'atrasado'))::bigint AS presences
      FROM public.ebd_chamada c
      INNER JOIN tenant_classes tc
        ON tc.id_classe = c.id_classe
      INNER JOIN public.ebd_chamada_aluno ca
        ON ca.id_chamada = c.id_chamada
      INNER JOIN public.ebd_aluno_classe ac
        ON ac.id_aluno_classe = ca.id_aluno_classe
       AND ac.id_classe = c.id_classe
      INNER JOIN public.ebd_aluno a
        ON a.id_aluno = ac.id_aluno
       AND a.status = 'ativo'
      WHERE c.data_chamada BETWEEN $1 AND $2
      GROUP BY c.id_chamada, c.id_classe, c.data_chamada, c.oferta, c.visitantes, c.biblias, c.revistas
    )
    SELECT
      COUNT(*)::bigint AS total_records,
      COUNT(DISTINCT id_classe)::bigint AS classes,
      COALESCE(SUM(presences), 0)::bigint AS presences,
      COALESCE(SUM(visitantes), 0)::integer AS visitors,
      COALESCE(SUM(biblias), 0)::integer AS biblias,
      COALESCE(SUM(revistas), 0)::integer AS revistas,
      COALESCE(SUM(oferta), 0)::numeric(10,2) AS offerings
    FROM base
    `,
    [startDate, endDate, idCadastro]
  );

  const activitiesResult = await query(
    `
    WITH tenant_classes AS (
      SELECT id_classe, nome
      FROM public.ebd_classe
      WHERE id_cadastro = $3
    ),
    base AS (
      SELECT
        c.id_chamada,
        c.id_classe,
        c.data_chamada,
        tc.nome AS classe,
        COALESCE(c.oferta, 0)::numeric(10,2) AS oferta,
        COALESCE(c.visitantes, 0)::integer AS visitantes,
        COALESCE(c.biblias, 0)::integer AS biblias,
        COALESCE(c.revistas, 0)::integer AS revistas,
        COUNT(*) FILTER (WHERE ca.status IN ('presente', 'atrasado'))::bigint AS presentes,
        COUNT(*) FILTER (WHERE ca.status = 'atrasado')::bigint AS atrasados,
        COUNT(*) FILTER (WHERE ca.status = 'ausente')::bigint AS ausentes,
        COUNT(*)::bigint AS total_alunos
      FROM public.ebd_chamada c
      INNER JOIN tenant_classes tc
        ON tc.id_classe = c.id_classe
      INNER JOIN public.ebd_chamada_aluno ca
        ON ca.id_chamada = c.id_chamada
      INNER JOIN public.ebd_aluno_classe ac
        ON ac.id_aluno_classe = ca.id_aluno_classe
       AND ac.id_classe = c.id_classe
      INNER JOIN public.ebd_aluno a
        ON a.id_aluno = ac.id_aluno
       AND a.status = 'ativo'
      WHERE c.data_chamada BETWEEN $1 AND $2
      GROUP BY c.id_chamada, c.id_classe, c.data_chamada, tc.nome, c.oferta, c.visitantes, c.biblias, c.revistas
    )
    SELECT
      data_chamada AS date,
      classe AS title,
      CONCAT(
        'Presentes: ',
        presentes,
        ' | Atrasados: ',
        atrasados,
        ' | Ausentes: ',
        ausentes,
        ' | Visitantes: ',
        visitantes
      ) AS description,
      oferta AS value,
      id_chamada,
      id_classe,
      presentes,
      atrasados,
      ausentes,
      total_alunos,
      visitantes,
      biblias,
      revistas
    FROM base
    ORDER BY data_chamada ASC, classe ASC, id_chamada ASC
    `,
    [startDate, endDate, idCadastro]
  );

  return {
    summary: summaryResult.rows[0] || {
      total_records: 0,
      classes: 0,
      presences: 0,
      visitors: 0,
      offerings: 0
    },
    activities: activitiesResult.rows
  };
}

module.exports = {
  getPresenceRanking,
  getVisitorRanking,
  getOfferRanking,
  getBirthdays,
  getPeriodReport
};
