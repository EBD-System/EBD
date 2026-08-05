'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.DATABASE_URL = 'postgres://test';
process.env.CORS_ORIGINS = '';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { HttpError } = require('../src/utils/httpError');
const { freshRequire, callMiddleware } = require('./helpers');

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input) {
  const normalized = String(input)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, 'base64').toString('utf8');
}

function sha256(text) {
  return crypto.createHash('sha256').update(String(text)).digest('hex');
}

function createToken(payload, options = {}) {
  const secret = options.secret || 'test-secret';
  const algorithm = options.algorithm || 'HS256';
  const header = { alg: algorithm, typ: 'JWT' };
  const normalizedPayload = { ...payload };

  if (options.expiresInSeconds != null) {
    normalizedPayload.exp = Math.floor(Date.now() / 1000) + options.expiresInSeconds;
  }

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = options.corruptPayload
    ? options.corruptPayload
    : base64UrlEncode(JSON.stringify(normalizedPayload));

  const signature = sha256(`${encodedHeader}.${encodedPayload}.${secret}`);
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function buildJwtMock() {
  return {
    verify(token, secret) {
      const parts = String(token || '').split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid token format');
      }

      const [encodedHeader, encodedPayload, signature] = parts;
      let header;
      let payload;

      try {
        header = JSON.parse(base64UrlDecode(encodedHeader));
      } catch (_error) {
        throw new Error('Invalid token header');
      }

      try {
        payload = JSON.parse(base64UrlDecode(encodedPayload));
      } catch (_error) {
        throw new Error('Invalid token payload');
      }

      if (header.alg !== 'HS256') {
        throw new Error('invalid algorithm');
      }

      const expectedSignature = sha256(`${encodedHeader}.${encodedPayload}.${secret}`);
      if (expectedSignature !== signature) {
        throw new Error('invalid signature');
      }

      if (payload.exp != null && Number(payload.exp) <= Math.floor(Date.now() / 1000)) {
        const error = new Error('jwt expired');
        error.name = 'TokenExpiredError';
        throw error;
      }

      return payload;
    }
  };
}

function buildErrorHandler() {
  return freshRequire('src/middlewares/errorHandler.js', {}, {
    '../utils/logger': {
      logger: {
        error() {},
        warn() {},
        info() {},
        debug() {}
      },
      getRequestContext: () => ({
        request_id: 'req-auth',
        method: 'GET',
        route: '/api/v1/auth/me',
        path: '/api/v1/auth/me'
      })
    }
  }).errorHandler;
}

function createRes() {
  return {
    statusCode: null,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return body;
    }
  };
}

function buildAuthMiddleware(userLookup = async () => ({ id_usuario: 1 })) {
  return freshRequire('src/middlewares/auth.js', {
    'src/modules/auth/repository.js': {
      getUserMe: userLookup
    }
  }, {
    jsonwebtoken: buildJwtMock(),
    dotenv: {
      config() {
        return { parsed: process.env };
      }
    },
    '../utils/logger': {
      logger: {
        warn() {},
        info() {},
        error() {},
        debug() {}
      }
    }
  }).authenticate;
}

async function runThroughHttpLayer(authenticate, req) {
  const errorHandler = buildErrorHandler();
  const res = createRes();
  const error = await callMiddleware(authenticate, req);
  if (error) {
    errorHandler(error, { requestId: 'req-auth' }, res, () => {});
  }
  return res;
}

test('middleware JWT - validação completa do contrato de autenticação', async (t) => {
  await t.test('token válido preenche o contexto autenticado', async () => {
    const authenticate = buildAuthMiddleware(async (idUsuario) => ({
      id_usuario: idUsuario
    }));

    const token = createToken(
      {
        sub: 8,
        id_usuario: 8,
        id_pessoa: 80,
        id_cadastro: 7,
        login: 'ana',
        profiles: ['Administrador']
      },
      { expiresInSeconds: 3600 }
    );

    const req = {
      headers: { authorization: `Bearer ${token}` },
      originalUrl: '/api/v1/auth/me'
    };

    const error = await callMiddleware(authenticate, req);
    assert.equal(error, undefined);
    assert.equal(req.tenantId, 7);
    assert.equal(req.user.sub, 8);
    assert.equal(req.user.id_usuario, 8);
    assert.equal(req.user.id_cadastro, 7);
    assert.equal(req.user.id_pessoa, 80);
    assert.equal(req.user.login, 'ana');
    assert.deepEqual(req.user.profiles, ['Administrador']);
  });

  await t.test('token ausente retorna 401', async () => {
    const authenticate = buildAuthMiddleware();
    const res = await runThroughHttpLayer(authenticate, { headers: {}, originalUrl: '/api/v1/auth/me' });

    assert.equal(res.statusCode, 401);
    assert.equal(res.payload.ok, false);
    assert.equal(res.payload.stage, 'auth');
    assert.equal(res.payload.message, 'Token não informado.');
    assert.equal(res.payload.error.statusCode, 401);
  });

  await t.test('token inválido retorna 401', async () => {
    const authenticate = buildAuthMiddleware();
    const res = await runThroughHttpLayer(authenticate, {
      headers: { authorization: 'Bearer invalid-token-claims' },
      originalUrl: '/api/v1/auth/me'
    });

    assert.equal(res.statusCode, 401);
    assert.equal(res.payload.ok, false);
    assert.equal(res.payload.stage, 'auth');
    assert.equal(res.payload.message, 'Token inválido ou expirado.');
    assert.equal(res.payload.error.statusCode, 401);
  });

  await t.test('assinatura inválida retorna 401', async () => {
    const authenticate = buildAuthMiddleware();
    const token = createToken(
      {
        sub: 8,
        id_usuario: 8,
        id_pessoa: 80,
        id_cadastro: 7,
        login: 'ana'
      },
      { expiresInSeconds: 3600 }
    );

    const tampered = `${token.slice(0, -1)}x`;
    const res = await runThroughHttpLayer(authenticate, {
      headers: { authorization: `Bearer ${tampered}` },
      originalUrl: '/api/v1/auth/me'
    });

    assert.equal(res.statusCode, 401);
    assert.equal(res.payload.ok, false);
    assert.equal(res.payload.stage, 'auth');
    assert.equal(res.payload.message, 'Token inválido ou expirado.');
    assert.equal(res.payload.error.statusCode, 401);
  });

  await t.test('algoritmo incorreto retorna 401', async () => {
    const authenticate = buildAuthMiddleware();
    const token = createToken(
      {
        sub: 8,
        id_usuario: 8,
        id_pessoa: 80,
        id_cadastro: 7,
        login: 'ana'
      },
      { algorithm: 'RS256', expiresInSeconds: 3600 }
    );

    const res = await runThroughHttpLayer(authenticate, {
      headers: { authorization: `Bearer ${token}` },
      originalUrl: '/api/v1/auth/me'
    });

    assert.equal(res.statusCode, 401);
    assert.equal(res.payload.ok, false);
    assert.equal(res.payload.stage, 'auth');
    assert.equal(res.payload.message, 'Token inválido ou expirado.');
    assert.equal(res.payload.error.statusCode, 401);
  });

  await t.test('payload corrompido retorna 401', async () => {
    const authenticate = buildAuthMiddleware();
    const token = createToken(
      {
        sub: 8,
        id_usuario: 8,
        id_pessoa: 80,
        id_cadastro: 7,
        login: 'ana'
      },
      { corruptPayload: 'payload-corrompido', expiresInSeconds: 3600 }
    );

    const res = await runThroughHttpLayer(authenticate, {
      headers: { authorization: `Bearer ${token}` },
      originalUrl: '/api/v1/auth/me'
    });

    assert.equal(res.statusCode, 401);
    assert.equal(res.payload.ok, false);
    assert.equal(res.payload.stage, 'auth');
    assert.equal(res.payload.message, 'Token inválido ou expirado.');
    assert.equal(res.payload.error.statusCode, 401);
  });

  await t.test('token expirado retorna 401', async () => {
    const authenticate = buildAuthMiddleware();
    const token = createToken(
      {
        sub: 8,
        id_usuario: 8,
        id_pessoa: 80,
        id_cadastro: 7,
        login: 'ana'
      },
      { expiresInSeconds: -10 }
    );

    const res = await runThroughHttpLayer(authenticate, {
      headers: { authorization: `Bearer ${token}` },
      originalUrl: '/api/v1/auth/me'
    });

    assert.equal(res.statusCode, 401);
    assert.equal(res.payload.ok, false);
    assert.equal(res.payload.stage, 'auth');
    assert.equal(res.payload.message, 'Token inválido ou expirado.');
    assert.equal(res.payload.error.statusCode, 401);
  });

  await t.test('tenant ausente retorna 401', async () => {
    const authenticate = buildAuthMiddleware();
    const token = createToken(
      {
        sub: 8,
        id_usuario: 8,
        id_pessoa: 80,
        login: 'ana',
        profiles: ['Administrador']
      },
      { expiresInSeconds: 3600 }
    );

    const res = await runThroughHttpLayer(authenticate, {
      headers: { authorization: `Bearer ${token}` },
      originalUrl: '/api/v1/auth/me'
    });

    assert.equal(res.statusCode, 401);
    assert.equal(res.payload.ok, false);
    assert.equal(res.payload.stage, 'auth');
    assert.equal(res.payload.message, 'Token inválido ou expirado.');
    assert.equal(res.payload.error.statusCode, 401);
  });

  await t.test('usuário inexistente retorna 401 quando a validação de contexto falha', async () => {
    const authenticate = buildAuthMiddleware(async () => null);
    const token = createToken(
      {
        sub: 999,
        id_usuario: 999,
        id_pessoa: 80,
        id_cadastro: 7,
        login: 'fantasma',
        profiles: ['Administrador']
      },
      { expiresInSeconds: 3600 }
    );

    const res = await runThroughHttpLayer(authenticate, {
      headers: { authorization: `Bearer ${token}` },
      originalUrl: '/api/v1/auth/me'
    });

    assert.equal(res.statusCode, 401);
    assert.equal(res.payload.ok, false);
    assert.equal(res.payload.stage, 'auth');
    assert.equal(res.payload.message, 'Usuário não encontrado.');
    assert.equal(res.payload.error.statusCode, 401);
  });
});
