const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { env } = require('../../config/env');
const { HttpError } = require('../../utils/httpError');
const { normalizeProfiles } = require('../../utils/profiles');
const { logger } = require('../../utils/logger');
const {
  findUserByLogin,
  updateLastLogin,
  getUserMe,
  getUserCadastroContext
} = require('./repository');

async function login({ login, senha }, source = {}) {
  if (!login || !senha) {
    throw new HttpError(400, 'Login e senha são obrigatórios.', 'auth');
  }

  const user = await findUserByLogin(login);
  if (!user || !user.ativo) {
    throw new HttpError(401, 'Credenciais inválidas.', 'auth');
  }

  const hash = String(user.senha_hash || '');
  let passwordMatches = false;
  try {
    passwordMatches = await bcrypt.compare(String(senha), hash);
  } catch (_error) {
    passwordMatches = false;
  }

  if (!passwordMatches) {
    throw new HttpError(401, 'Credenciais inválidas.', 'auth');
  }

  await updateLastLogin(user.id_usuario);

  const idCadastro = await getUserCadastroContext(user.id_usuario);
  const log = source?.log || logger;
  log.info('auth.login.success', {
    request_id: source.requestId || null,
    user_id: user.id_usuario,
    tenant_id: idCadastro ?? null,
    profiles: normalizeProfiles(user.profiles)
  });
  const profiles = normalizeProfiles(user.profiles);
  const token = jwt.sign(
    {
      sub: user.id_usuario,
      id_usuario: user.id_usuario,
      id_pessoa: user.id_pessoa,
      id_cadastro: idCadastro ?? undefined,
      login: user.login,
      profiles
    },
    env.jwtSecret,
    { expiresIn: '12h' }
  );

  return {
    token,
    user: {
      id_usuario: user.id_usuario,
      id_pessoa: user.id_pessoa,
      id_cadastro: idCadastro,
      login: user.login,
      pessoa_nome: user.pessoa_nome,
      profiles
    }
  };
}

async function me(idUsuario, source = {}) {
  const user = await getUserMe(idUsuario);
  if (!user) throw new HttpError(404, 'Usuário não encontrado.', 'auth');

  const idCadastro = user.id_cadastro ?? await getUserCadastroContext(idUsuario);

  return {
    id_usuario: user.id_usuario,
    id_pessoa: user.id_pessoa,
    id_cadastro: idCadastro ?? null,
    login: user.login,
    ultimo_login: user.ultimo_login,
    ativo: user.ativo,
    pessoa_nome: user.pessoa_nome,
    email: user.email,
    profiles: normalizeProfiles(user.profiles)
  };
}

module.exports = {
  login,
  me
};
