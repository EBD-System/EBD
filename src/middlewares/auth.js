const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const { HttpError } = require('../utils/httpError');
const { normalizeTenantId } = require('../utils/tenant');
const { hasAnyProfile, normalizeProfiles } = require('../utils/profiles');
const { logger } = require('../utils/logger');
const { getUserMe } = require('../modules/auth/repository');

function getTokenFromRequest(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme === 'Bearer' && token) return token;
  return null;
}

async function authenticate(req, _res, next) {
  try {
    const token = getTokenFromRequest(req);
    if (!token) throw new HttpError(401, 'Token não informado.', 'auth');

    const payload = jwt.verify(token, env.jwtSecret);
    const idUsuario = normalizeTenantId(payload.sub ?? payload.id_usuario);
    if (idUsuario === null) {
      throw new HttpError(401, 'Token inválido ou expirado.', 'auth');
    }

    // O contexto autenticado passou a aceitar somente o tenant explícito do JWT.
    // O fallback antigo por objeto "cadastro" foi removido para evitar leitura de claims legadas.
    const idCadastro = normalizeTenantId(payload.id_cadastro);
    if (idCadastro === null) {
      throw new HttpError(401, 'Token inválido ou expirado.', 'auth');
    }

    const user = await getUserMe(idUsuario);
    if (!user) {
      throw new HttpError(401, 'Usuário não encontrado.', 'auth');
    }

    req.user = {
      sub: idUsuario,
      id_usuario: idUsuario,
      id_pessoa: normalizeTenantId(payload.id_pessoa),
      id_cadastro: idCadastro,
      login: typeof payload.login === 'string' ? payload.login.trim() : '',
      profiles: normalizeProfiles(payload.profiles)
    };
    req.tenantId = idCadastro;

    return next();
  } catch (error) {
    if (error instanceof HttpError) {
      logger.warn('auth.token.rejected', {
        request_id: req.requestId || null,
        path: req.originalUrl || null,
        stage: error.stage || 'auth',
        message: error.message
      });
      return next(error);
    }

    logger.warn('auth.token.invalid', {
      request_id: req.requestId || null,
      path: req.originalUrl || null,
      stage: 'auth'
    });
    return next(new HttpError(401, 'Token inválido ou expirado.', 'auth'));
  }
}

function requireProfiles(...requiredProfiles) {
  const normalizedRequiredProfiles = normalizeProfiles(requiredProfiles);

  return (req, _res, next) => {
    const userProfiles = normalizeProfiles(req.user?.profiles);

    const allowed = hasAnyProfile(userProfiles, normalizedRequiredProfiles);

    if (!allowed) {
      return next(new HttpError(403, 'Perfil sem permissão para esta operação.', 'auth'));
    }

    return next();
  };
}

module.exports = {
  authenticate,
  requireProfiles
};
