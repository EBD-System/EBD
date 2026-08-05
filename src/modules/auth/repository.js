const { query } = require('../../db');
const { canonicalizeProfile, normalizeProfiles } = require('../../utils/profiles');
const { normalizeSexoForStorage, normalizePersonSexo } = require('../../utils/sexo');
const { stripNonDigits } = require('../../utils/telefone');

async function tableHasColumnOnPool(tableName, columnName) {
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

async function findUserByLogin(login) {
  const userHasTenant = await tableHasColumnOnPool('ebd_usuario', 'id_cadastro');
  const personHasTenant = !userHasTenant && await tableHasColumnOnPool('ebd_pessoa', 'id_cadastro');

  const tenantSelect = userHasTenant
    ? ', u.id_cadastro AS id_cadastro'
    : personHasTenant
      ? ', p.id_cadastro AS id_cadastro'
      : ', NULL::bigint AS id_cadastro';

  const tenantGroupBy = userHasTenant
    ? ', u.id_cadastro'
    : personHasTenant
      ? ', p.id_cadastro'
      : '';

  const result = await query(
    `
    SELECT
      u.id_usuario,
      u.id_pessoa,
      u.login,
      u.senha_hash,
      u.ativo,
      p.nome AS pessoa_nome
      ${tenantSelect},
      ARRAY_REMOVE(ARRAY_AGG(DISTINCT perf.nome), NULL) AS profiles
    FROM public.ebd_usuario u
    INNER JOIN public.ebd_pessoa p
      ON p.id_pessoa = u.id_pessoa
    LEFT JOIN public.ebd_usuario_perfil up
      ON up.id_usuario = u.id_usuario
    LEFT JOIN public.ebd_perfil perf
      ON perf.id_perfil = up.id_perfil
     AND perf.ativo = TRUE
    WHERE LOWER(BTRIM(u.login)) = LOWER(BTRIM($1))
    GROUP BY u.id_usuario, u.id_pessoa, u.login, u.senha_hash, u.ativo, p.nome${tenantGroupBy}
    `,
    [login]
  );

  if (!result.rows[0]) return null;
  return {
    ...result.rows[0],
    profiles: normalizeProfiles(result.rows[0].profiles)
  };
}

async function updateLastLogin(idUsuario) {
  await query(
    'UPDATE public.ebd_usuario SET ultimo_login = NOW() WHERE id_usuario = $1',
    [idUsuario]
  );
}

async function getUserMe(idUsuario) {
  const result = await query(
    `
    SELECT
      u.id_usuario,
      u.id_pessoa,
      u.login,
      u.ultimo_login,
      u.ativo,
      p.nome AS pessoa_nome,
      p.email AS email,
      ARRAY_REMOVE(ARRAY_AGG(DISTINCT perf.nome), NULL) AS profiles
    FROM public.ebd_usuario u
    INNER JOIN public.ebd_pessoa p
      ON p.id_pessoa = u.id_pessoa
    LEFT JOIN public.ebd_usuario_perfil up
      ON up.id_usuario = u.id_usuario
    LEFT JOIN public.ebd_perfil perf
      ON perf.id_perfil = up.id_perfil
     AND perf.ativo = TRUE
    WHERE u.id_usuario = $1
    GROUP BY u.id_usuario, u.id_pessoa, u.login, u.ultimo_login, u.ativo, p.nome, p.email
    `,
    [idUsuario]
  );

  if (!result.rows[0]) return null;
  return {
    ...result.rows[0],
    profiles: normalizeProfiles(result.rows[0].profiles)
  };
}

async function getUserCadastroContext(idUsuario) {
  const userHasTenant = await tableHasColumnOnPool('ebd_usuario', 'id_cadastro');
  if (userHasTenant) {
    const result = await query(
      `
      SELECT id_cadastro
      FROM public.ebd_usuario
      WHERE id_usuario = $1
      `,
      [idUsuario]
    );
    const idCadastro = result.rows[0]?.id_cadastro;
    if (idCadastro != null) return Number(idCadastro);
  }

  const personHasTenant = await tableHasColumnOnPool('ebd_pessoa', 'id_cadastro');
  if (personHasTenant) {
    const result = await query(
      `
      SELECT p.id_cadastro
      FROM public.ebd_usuario u
      INNER JOIN public.ebd_pessoa p
        ON p.id_pessoa = u.id_pessoa
      WHERE u.id_usuario = $1
      `,
      [idUsuario]
    );
    const idCadastro = result.rows[0]?.id_cadastro;
    if (idCadastro != null) return Number(idCadastro);
  }

  return null;
}

async function findPersonByCpf(client, cpf) {
  if (!cpf) return null;

  const result = await client.query(
    `
    SELECT
      id_pessoa,
      nome,
      sexo,
      cpf,
      data_nascimento,
      telefone,
      email,
      logradouro,
      numero,
      bairro,
      cidade,
      uf,
      cep,
      observacao,
      criado_em,
      atualizado_em
    FROM public.ebd_pessoa
    WHERE cpf = $1
    `,
    [cpf]
  );

  return normalizePersonSexo(result.rows[0] || null);
}

async function tableHasColumn(client, tableName, columnName) {
  const result = await client.query(
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

async function createCadastro(client, data) {
  const nome = String(data.nome || '').trim();
  if (!nome) {
    throw new Error('Nome do cadastro é obrigatório.');
  }

  const result = await client.query(
    `
    INSERT INTO public.ebd_cadastro (
      nome,
      ativo
    )
    VALUES ($1, TRUE)
    RETURNING
      id_cadastro,
      nome,
      ativo,
      criado_em
    `,
    [nome]
  );

  return result.rows[0];
}

async function createPerson(client, data) {
  const hasTenantColumn = await tableHasColumn(client, 'ebd_pessoa', 'id_cadastro');
  const params = [];
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

  values.forEach((value) => params.push(value));

  const placeholders = params.map((_value, index) => `$${index + 1}`).join(', ');

  const result = await client.query(
    `
    INSERT INTO public.ebd_pessoa (
      ${columns.join(', ')}
    )
    VALUES (${placeholders})
    RETURNING
      id_pessoa,
      nome,
      sexo,
      cpf,
      data_nascimento,
      telefone,
      email,
      logradouro,
      numero,
      bairro,
      cidade,
      uf,
      cep,
      observacao,
      criado_em,
      atualizado_em
    `,
    params
  );

  return normalizePersonSexo(result.rows[0]);
}

async function createUser(client, data) {
  const hasTenantColumn = await tableHasColumn(client, 'ebd_usuario', 'id_cadastro');
  const params = [];
  const columns = [];
  const values = [];

  if (hasTenantColumn && data.idCadastro != null) {
    columns.push('id_cadastro');
    values.push(data.idCadastro);
  }

  columns.push('id_pessoa', 'login', 'senha_hash', 'ativo');
  values.push(data.idPessoa, data.login, data.senhaHash, true);

  values.forEach((value) => params.push(value));

  const placeholders = params.map((_value, index) => `$${index + 1}`).join(', ');

  const result = await client.query(
    `
    INSERT INTO public.ebd_usuario (
      ${columns.join(', ')}
    )
    VALUES (${placeholders})
    RETURNING
      id_usuario,
      id_pessoa,
      login,
      ultimo_login,
      ativo,
      criado_em
    `,
    params
  );

  return result.rows[0];
}

async function findProfileByName(client, profileName) {
  const normalizedProfile = canonicalizeProfile(profileName);
  if (!normalizedProfile) return null;

  const result = await client.query(
    `
    SELECT id_perfil, nome
    FROM public.ebd_perfil
    WHERE LOWER(BTRIM(nome)) = LOWER(BTRIM($1))
      AND ativo = TRUE
    LIMIT 1
    `,
    [normalizedProfile]
  );

  return normalizePersonSexo(result.rows[0] || null);
}

async function linkUserProfile(client, idUsuario, idPerfil) {
  await client.query(
    `
    INSERT INTO public.ebd_usuario_perfil (
      id_usuario,
      id_perfil
    )
    VALUES ($1, $2)
    ON CONFLICT (id_usuario, id_perfil) DO NOTHING
    `,
    [idUsuario, idPerfil]
  );
}

module.exports = {
  findUserByLogin,
  updateLastLogin,
  getUserMe,
  getUserCadastroContext,
  findPersonByCpf,
  createCadastro,
  createPerson,
  createUser,
  findProfileByName,
  linkUserProfile
};
