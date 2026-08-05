const { query } = require('../../db');
const { normalizeSexoForStorage, normalizePersonSexo } = require('../../utils/sexo');
const { stripNonDigits } = require('../../utils/telefone');

async function tableHasColumn(tableName, columnName) {
  const result = await query(
    `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = $2
    ) AS exists
    `,
    [tableName, columnName]
  );

  return Boolean(result.rows[0]?.exists);
}

function normalizePersonRows(rows) {
  return rows.map((row) => normalizePersonSexo(row));
}

async function listPeople({ idCadastro, search = '', limit = 50, offset = 0 }) {
  const params = [];
  const clauses = [];

  if (search) {
    params.push(`%${search}%`);
    params.push(search.replace(/\D/g, ''));
    clauses.push("(LOWER(p.nome) LIKE LOWER($1) OR LOWER(COALESCE(p.email, '')) LIKE LOWER($1) OR p.cpf = $2)");
  }

  params.push(idCadastro);
  clauses.push(`p.id_cadastro = $${params.length}`);

  const limitIndex = params.length + 1;
  params.push(limit, offset);

  const result = await query(
    `
    SELECT
      p.*,
      CASE WHEN u.id_usuario IS NULL THEN FALSE ELSE TRUE END AS possui_usuario
    FROM public.ebd_pessoa p
    LEFT JOIN public.ebd_usuario u
      ON u.id_pessoa = p.id_pessoa
     AND u.id_cadastro = p.id_cadastro
    WHERE ${clauses.join(' AND ')}
    ORDER BY p.nome
    LIMIT $${limitIndex}
    OFFSET $${limitIndex + 1}
    `,
    params
  );
  return normalizePersonRows(result.rows);
}

async function getPersonById(idPessoa, idCadastro) {
  const result = await query(
    `
    SELECT
      p.*,
      CASE WHEN u.id_usuario IS NULL THEN FALSE ELSE TRUE END AS possui_usuario
    FROM public.ebd_pessoa p
    LEFT JOIN public.ebd_usuario u
      ON u.id_pessoa = p.id_pessoa
     AND u.id_cadastro = p.id_cadastro
    WHERE p.id_pessoa = $1
      AND p.id_cadastro = $2
    `,
    [idPessoa, idCadastro]
  );
  return normalizePersonSexo(result.rows[0] || null);
}

async function createPerson(data) {
  const hasTenantColumn = await tableHasColumn('ebd_pessoa', 'id_cadastro');

  const columns = [];
  const values = [];

  if (hasTenantColumn && data.idCadastro != null) {
    columns.push('id_cadastro');
    values.push(data.idCadastro);
  }

  columns.push(
    'nome',
    'sexo',
    'cpf',
    'data_nascimento',
    'telefone',
    'email',
    'logradouro',
    'numero',
    'bairro',
    'cidade',
    'uf',
    'cep',
    'observacao'
  );

  values.push(
    data.nome,
    normalizeSexoForStorage(data.sexo),
    data.cpf || '',
    data.data_nascimento || null,
    stripNonDigits(data.telefone),
    data.email || '',
    data.logradouro || '',
    data.numero || '',
    data.bairro || '',
    data.cidade || '',
    data.uf || '',
    data.cep || '',
    data.observacao || ''
  );

  const placeholders = values.map((_value, index) => `$${index + 1}`).join(', ');

  const result = await query(
    `
    INSERT INTO public.ebd_pessoa (
      ${columns.join(', ')}
    )
    VALUES (${placeholders})
    RETURNING *
    `,
    values
  );

  return normalizePersonSexo(result.rows[0]);
}

async function updatePerson(idPessoa, data) {
  const hasTenantColumn = await tableHasColumn('ebd_pessoa', 'id_cadastro');
  const sets = [
    'nome = COALESCE($2, nome)',
    'sexo = COALESCE($3, sexo)',
    'cpf = COALESCE($4, cpf)',
    'data_nascimento = COALESCE($5, data_nascimento)',
    'telefone = COALESCE($6, telefone)',
    'email = COALESCE($7, email)',
    'logradouro = COALESCE($8, logradouro)',
    'numero = COALESCE($9, numero)',
    'bairro = COALESCE($10, bairro)',
    'cidade = COALESCE($11, cidade)',
    'uf = COALESCE($12, uf)',
    'cep = COALESCE($13, cep)',
    'observacao = COALESCE($14, observacao)'
  ];

  const params = [
    idPessoa,
    data.nome ?? null,
    data.sexo == null ? null : normalizeSexoForStorage(data.sexo),
    data.cpf ?? null,
    data.data_nascimento ?? null,
    data.telefone == null ? null : stripNonDigits(data.telefone),
    data.email ?? null,
    data.logradouro ?? null,
    data.numero ?? null,
    data.bairro ?? null,
    data.cidade ?? null,
    data.uf ?? null,
    data.cep ?? null,
    data.observacao ?? null
  ];

  let sql = `
    UPDATE public.ebd_pessoa
       SET ${sets.join(', ')}
     WHERE id_pessoa = $1
  `;

  if (hasTenantColumn && data.idCadastro != null) {
    params.push(data.idCadastro);
    sql += ` AND id_cadastro = $${params.length}`;
  }

  sql += ' RETURNING *';

  const result = await query(sql, params);
  return normalizePersonSexo(result.rows[0] || null);
}

module.exports = {
  listPeople,
  getPersonById,
  createPerson,
  updatePerson
};
