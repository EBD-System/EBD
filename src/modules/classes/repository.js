const { query } = require('../../db');

async function listClasses(idCadastro, dataChamada = null) {
  const result = await query(
    `
    SELECT *
    FROM public.fn_ebd_classes_do_cadastro($1, COALESCE($2::date, CURRENT_DATE))
    `,
    [idCadastro, dataChamada]
  );
  return result.rows;
}

async function getClassById(idClasse, idCadastro) {
  const result = await query(
    `
    SELECT *
    FROM public.ebd_classe
    WHERE id_classe = $1
      AND id_cadastro = $2
    `,
    [idClasse, idCadastro]
  );
  return result.rows[0] || null;
}

async function getClassStudents(idClasse, idCadastro) {
  const classRow = await getClassById(idClasse, idCadastro);
  if (!classRow) return [];

  const result = await query(
    `
    SELECT
      a.id_aluno,
      p.id_pessoa,
      p.nome,
      a.matricula,
      a.status,
      a.data_cadastro,
      a.data_desligamento,
      a.motivo_desligamento,
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
     AND p.id_cadastro = $2
    INNER JOIN public.ebd_aluno_classe ac
      ON ac.id_aluno = a.id_aluno
    INNER JOIN public.ebd_classe c
      ON c.id_classe = ac.id_classe
     AND c.id_cadastro = $2
    WHERE ac.id_classe = $1
      AND ac.ativo = TRUE
      AND a.status = 'ativo'
      AND p.id_cadastro = c.id_cadastro
    ORDER BY p.nome
    `,
    [idClasse, idCadastro]
  );

  return result.rows;
}

async function getClassAttendance(idClasse, dataChamada, idCadastro) {
  const classRow = await getClassById(idClasse, idCadastro);
  if (!classRow) return [];

  const result = await query(
    `
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
    FROM public.ebd_chamada c
    INNER JOIN public.ebd_classe cl
      ON cl.id_classe = c.id_classe
     AND cl.id_cadastro = $3
    INNER JOIN public.ebd_chamada_aluno ca
      ON ca.id_chamada = c.id_chamada
    INNER JOIN public.ebd_aluno_classe ac
      ON ac.id_aluno_classe = ca.id_aluno_classe
    INNER JOIN public.ebd_aluno a
      ON a.id_aluno = ac.id_aluno
    INNER JOIN public.ebd_pessoa p
      ON p.id_pessoa = a.id_pessoa
     AND p.id_cadastro = $3
    WHERE c.id_classe = $1
      AND c.data_chamada = $2
      AND p.id_cadastro = cl.id_cadastro
    ORDER BY p.nome
    `,
    [idClasse, dataChamada, idCadastro]
  );

  return result.rows;
}

module.exports = {
  listClasses,
  getClassById,
  getClassStudents,
  getClassAttendance
};
