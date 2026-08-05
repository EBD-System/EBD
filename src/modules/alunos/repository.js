const { query } = require('../../db');
const { normalizePersonSexo } = require('../../utils/sexo');

async function listStudents({ idCadastro, classId = null, status = null, inactive = false } = {}) {
  const params = [idCadastro];
  const filters = ['p.id_cadastro = $1'];

  if (classId) {
    params.push(classId);
    filters.push(`c.id_classe = $${params.length}`);
  }
  if (status) {
    params.push(status);
    filters.push(`a.status = $${params.length}`);
  }

  const baseSql = `
    SELECT
      a.id_aluno,
      a.id_pessoa,
      p.nome,
      p.sexo,
      p.cpf,
      p.data_nascimento,
      p.telefone,
      p.email,
      p.logradouro,
      p.numero,
      p.bairro,
      p.cidade,
      p.uf,
      p.cep,
      a.matricula,
      a.status,
      a.data_cadastro,
      a.data_desligamento,
      a.motivo_desligamento,
      COALESCE(NULLIF(a.motivo_desligamento, ''), NULLIF(status_hist.motivo, '')) AS inactive_reason,
      a.observacao,
      ac.id_aluno_classe,
      ac.id_classe,
      c.nome AS classe,
      ac.data_inicio,
      ac.data_fim,
      ac.motivo,
      ac.ativo AS ativo_classe
    FROM public.ebd_aluno a
    INNER JOIN public.ebd_pessoa p
      ON p.id_pessoa = a.id_pessoa
     AND p.id_cadastro = $1
    LEFT JOIN LATERAL (
      SELECT h.motivo
      FROM public.ebd_aluno_status_historico h
      WHERE h.id_aluno = a.id_aluno
        AND h.status_novo = 'inativo'
      ORDER BY h.criado_em DESC, h.id_aluno_status_historico DESC
      LIMIT 1
    ) status_hist ON TRUE
    LEFT JOIN public.ebd_aluno_classe ac
      ON ac.id_aluno = a.id_aluno
     AND ac.ativo = TRUE
    LEFT JOIN public.ebd_classe c
      ON c.id_classe = ac.id_classe
     AND c.id_cadastro = $1
    WHERE ${filters.join(' AND ')}
      ${inactive ? "AND a.status = 'inativo'" : ''}
    ORDER BY p.nome
  `;

  const result = await query(baseSql, params);
  return result.rows.map((row) => normalizePersonSexo(row));
}

async function getStudentById(idAluno, idCadastro) {
  const result = await query(
    `
    SELECT
      a.*,
      p.nome,
      p.sexo,
      p.cpf,
      p.data_nascimento,
      p.telefone,
      p.email,
      p.logradouro,
      p.numero,
      p.bairro,
      p.cidade,
      p.uf,
      p.cep,
      COALESCE(NULLIF(a.motivo_desligamento, ''), NULLIF(status_hist.motivo, '')) AS inactive_reason,
      ac.id_aluno_classe,
      ac.id_classe,
      c.nome AS classe,
      ac.data_inicio,
      ac.data_fim,
      ac.ativo AS ativo_classe,
      ac.motivo
    FROM public.ebd_aluno a
    INNER JOIN public.ebd_pessoa p
      ON p.id_pessoa = a.id_pessoa
     AND p.id_cadastro = $2
    LEFT JOIN LATERAL (
      SELECT h.motivo
      FROM public.ebd_aluno_status_historico h
      WHERE h.id_aluno = a.id_aluno
        AND h.status_novo = 'inativo'
      ORDER BY h.criado_em DESC, h.id_aluno_status_historico DESC
      LIMIT 1
    ) status_hist ON TRUE
    LEFT JOIN public.ebd_aluno_classe ac
      ON ac.id_aluno = a.id_aluno
     AND ac.ativo = TRUE
    LEFT JOIN public.ebd_classe c
      ON c.id_classe = ac.id_classe
     AND c.id_cadastro = $2
    WHERE a.id_aluno = $1
    `,
    [idAluno, idCadastro]
  );
  return normalizePersonSexo(result.rows[0] || null);
}

async function matriculateStudent({ idPessoa, matricula, idClasse, dataInicio, observacao, idCadastro = null }) {
  if (idCadastro !== null) {
    const validation = await query(
      `
      SELECT 1
      FROM public.ebd_pessoa p
      INNER JOIN public.ebd_classe c
        ON c.id_cadastro = p.id_cadastro
      WHERE p.id_pessoa = $1
        AND c.id_classe = $2
        AND p.id_cadastro = $3
        AND c.ativo = TRUE
      `,
      [idPessoa, idClasse, idCadastro]
    );

    if (!validation.rows[0]) {
      return null;
    }
  }

  const result = await query(
    'SELECT public.fn_ebd_matricular_aluno($1, $2, $3, $4, $5) AS id_aluno',
    [idPessoa, matricula || '', idClasse, dataInicio || null, observacao || '']
  );
  return result.rows[0]?.id_aluno || null;
}

async function activateStudent(idAluno, observacao = '', idCadastro = null) {
  if (idCadastro !== null) {
    const validation = await query(
      `
      SELECT 1
      FROM public.ebd_aluno a
      INNER JOIN public.ebd_pessoa p
        ON p.id_pessoa = a.id_pessoa
      WHERE a.id_aluno = $1
        AND p.id_cadastro = $2
      `,
      [idAluno, idCadastro]
    );

    if (!validation.rows[0]) {
      return false;
    }
  }

  await query('SELECT public.fn_ebd_ativar_aluno($1, $2)', [idAluno, observacao]);
  return true;
}

async function inactivateStudent(idAluno, motivo, observacao = '', idCadastro = null) {
  if (idCadastro !== null) {
    const validation = await query(
      `
      SELECT 1
      FROM public.ebd_aluno a
      INNER JOIN public.ebd_pessoa p
        ON p.id_pessoa = a.id_pessoa
      WHERE a.id_aluno = $1
        AND p.id_cadastro = $2
      `,
      [idAluno, idCadastro]
    );

    if (!validation.rows[0]) {
      return false;
    }
  }

  await query('SELECT public.fn_ebd_inativar_aluno($1, $2, $3)', [idAluno, motivo, observacao]);
  return true;
}

async function updateStudentObservation(idAluno, observacao, idCadastro = null) {
  if (idCadastro !== null) {
    const validation = await query(
      `
      SELECT 1
      FROM public.ebd_aluno a
      INNER JOIN public.ebd_pessoa p
        ON p.id_pessoa = a.id_pessoa
      WHERE a.id_aluno = $1
        AND p.id_cadastro = $2
      `,
      [idAluno, idCadastro]
    );

    if (!validation.rows[0]) {
      return null;
    }
  }

  const result = await query(
    `
    UPDATE public.ebd_aluno
       SET observacao = COALESCE($2, '')
     WHERE id_aluno = $1
     RETURNING *
    `,
    [idAluno, observacao || '']
  );

  return normalizePersonSexo(result.rows[0] || null);
}


async function transferStudent({ idAluno, idClasseDestino, dataInicio, motivo, observacao, idCadastro = null }) {
  if (idCadastro !== null) {
    const validation = await query(
      `
      SELECT 1
      FROM public.ebd_aluno a
      INNER JOIN public.ebd_pessoa p
        ON p.id_pessoa = a.id_pessoa
      WHERE a.id_aluno = $1
        AND p.id_cadastro = $2
      `,
      [idAluno, idCadastro]
    );

    if (!validation.rows[0]) {
      return null;
    }
  }

  const result = await query(
    'SELECT public.fn_ebd_transferir_aluno($1, $2, $3, $4, $5) AS id_aluno_classe',
    [idAluno, idClasseDestino, dataInicio || null, motivo || '', observacao || '']
  );
  return result.rows[0]?.id_aluno_classe || null;
}

async function getInactiveReasonsByStudentIds({ idCadastro, ids }) {
  const result = await query(
    `
    SELECT
      a.id_aluno,
      p.nome,
      a.status,
      a.data_desligamento,
      a.motivo_desligamento,
      COALESCE(NULLIF(a.motivo_desligamento, ''), NULLIF(status_hist.motivo, '')) AS inactive_reason
    FROM public.ebd_aluno a
    INNER JOIN public.ebd_pessoa p
      ON p.id_pessoa = a.id_pessoa
     AND p.id_cadastro = $1
    LEFT JOIN LATERAL (
      SELECT h.motivo
      FROM public.ebd_aluno_status_historico h
      WHERE h.id_aluno = a.id_aluno
        AND h.status_novo = 'inativo'
      ORDER BY h.criado_em DESC, h.id_aluno_status_historico DESC
      LIMIT 1
    ) status_hist ON TRUE
    WHERE a.id_aluno = ANY($2::bigint[])
    ORDER BY p.nome
    `,
    [idCadastro, ids]
  );

  return result.rows.map((row) => normalizePersonSexo(row));
}

async function getStudentHistory(idAluno) {
  const result = await query('SELECT * FROM public.fn_ebd_historico_aluno($1)', [idAluno]);
  return result.rows.map((row) => normalizePersonSexo(row));
}

async function getStudentStatusHistory(idAluno) {
  const result = await query('SELECT * FROM public.fn_ebd_historico_status_aluno($1)', [idAluno]);
  return result.rows.map((row) => normalizePersonSexo(row));
}

async function getStudentClasses(idAluno, idCadastro) {
  const result = await query(
    `
    SELECT
      ac.id_aluno_classe,
      ac.id_aluno,
      ac.id_classe,
      c.nome AS classe,
      ac.data_inicio,
      ac.data_fim,
      ac.motivo,
      ac.ativo
    FROM public.ebd_aluno_classe ac
    INNER JOIN public.ebd_aluno a
      ON a.id_aluno = ac.id_aluno
    INNER JOIN public.ebd_pessoa p
      ON p.id_pessoa = a.id_pessoa
     AND p.id_cadastro = $2
    INNER JOIN public.ebd_classe c
      ON c.id_classe = ac.id_classe
     AND c.id_cadastro = $2
    WHERE ac.id_aluno = $1
    ORDER BY ac.data_inicio DESC, ac.id_aluno_classe DESC
    `,
    [idAluno, idCadastro]
  );
  return result.rows.map((row) => normalizePersonSexo(row));
}

module.exports = {
  listStudents,
  getStudentById,
  matriculateStudent,
  activateStudent,
  inactivateStudent,
  updateStudentObservation,
  transferStudent,
  getInactiveReasonsByStudentIds,
  getStudentHistory,
  getStudentStatusHistory,
  getStudentClasses
};
