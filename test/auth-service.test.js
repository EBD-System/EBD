'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.DATABASE_URL = 'postgres://test';
process.env.CORS_ORIGINS = '';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { HttpError } = require('../src/utils/httpError');
const { freshRequire, createNoopLogger, callMiddleware } = require('./helpers');

function base64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function sha256(text) {
  return crypto.createHash('sha256').update(String(text)).digest('hex');
}

function parseExpiresIn(value) {
  if (typeof value !== 'string') return 0;
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) return 0;
  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };
  return amount * multipliers[unit];
}

const bcryptMock = {
  hashSync(password) {
    return `hash:${sha256(password)}`;
  },
  async compare(password, hash) {
    return hash === `hash:${sha256(password)}`;
  }
};

const jwtMock = {
  sign(payload, secret, options = {}) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const normalizedPayload = { ...payload };
    const expiresInMs = parseExpiresIn(options.expiresIn);
    if (expiresInMs > 0) {
      normalizedPayload.exp = Math.floor((Date.now() + expiresInMs) / 1000);
    }
    const encodedHeader = base64Url(JSON.stringify(header));
    const encodedPayload = base64Url(JSON.stringify(normalizedPayload));
    const signature = sha256(`${encodedHeader}.${encodedPayload}.${secret}`);
    return `${encodedHeader}.${encodedPayload}.${signature}`;
  },
  verify(token, secret) {
    const [encodedHeader, encodedPayload, signature] = String(token).split('.');
    if (!encodedHeader || !encodedPayload || !signature) {
      throw new Error('Invalid token format');
    }
    const expected = sha256(`${encodedHeader}.${encodedPayload}.${secret}`);
    if (expected !== signature) {
      throw new Error('invalid signature');
    }
    return JSON.parse(Buffer.from(encodedPayload, 'base64').toString('utf8'));
  }
};

const dotenvMock = {
  config() {
    return { parsed: process.env };
  }
};

function loadAuthService(repositoryMock) {
  return freshRequire('src/modules/auth/service.js', {
    'src/modules/auth/repository.js': repositoryMock
  }, {
    bcryptjs: bcryptMock,
    jsonwebtoken: jwtMock,
    dotenv: dotenvMock
  });
}

test('autenticação - regras do serviço e do middleware', async (t) => {
  await t.test('login válido emite JWT com claims canônicas e atualiza last_login', async () => {
    const calls = { lastLogin: null };
    const authService = loadAuthService({
      findUserByLogin: async (login) => ({
        id_usuario: 1,
        id_pessoa: 10,
        login,
        senha_hash: bcryptMock.hashSync('senha-secreta'),
        ativo: true,
        pessoa_nome: 'Ana Silva',
        profiles: ['Administrador']
      }),
      updateLastLogin: async (idUsuario) => {
        calls.lastLogin = idUsuario;
      },
      getUserMe: async () => null,
      getUserCadastroContext: async () => 12
    });

    const result = await authService.login(
      { login: 'ana', senha: 'senha-secreta' },
      { requestId: 'req-login', log: createNoopLogger() }
    );

    assert.equal(calls.lastLogin, 1);
    assert.equal(result.user.id_usuario, 1);
    assert.equal(result.user.id_pessoa, 10);
    assert.equal(result.user.id_cadastro, 12);
    assert.equal(result.user.login, 'ana');
    assert.equal(result.user.pessoa_nome, 'Ana Silva');
    assert.deepEqual(result.user.profiles, ['Administrador']);

    const payload = jwtMock.verify(result.token, 'test-secret');
    assert.equal(payload.sub, 1);
    assert.equal(payload.id_usuario, 1);
    assert.equal(payload.id_pessoa, 10);
    assert.equal(payload.id_cadastro, 12);
    assert.equal(payload.login, 'ana');
    assert.deepEqual(payload.profiles, ['Administrador']);
  });

  await t.test('login inexistente retorna credenciais inválidas', async () => {
    const authService = loadAuthService({
      findUserByLogin: async () => null,
      updateLastLogin: async () => {},
      getUserMe: async () => null,
      getUserCadastroContext: async () => null
    });

    await assert.rejects(
      () => authService.login({ login: 'inexistente', senha: 'qualquer' }, { log: createNoopLogger() }),
      (error) => error instanceof HttpError
        && error.statusCode === 401
        && error.stage === 'auth'
        && error.message === 'Credenciais inválidas.'
    );
  });

  await t.test('senha incorreta retorna credenciais inválidas', async () => {
    const authService = loadAuthService({
      findUserByLogin: async (login) => ({
        id_usuario: 2,
        id_pessoa: 20,
        login,
        senha_hash: bcryptMock.hashSync('senha-correta'),
        ativo: true,
        pessoa_nome: 'Bruno Souza',
        profiles: ['Secretaria']
      }),
      updateLastLogin: async () => {},
      getUserMe: async () => null,
      getUserCadastroContext: async () => 7
    });

    await assert.rejects(
      () => authService.login({ login: 'bruno', senha: 'senha-errada' }, { log: createNoopLogger() }),
      (error) => error instanceof HttpError
        && error.statusCode === 401
        && error.stage === 'auth'
        && error.message === 'Credenciais inválidas.'
    );
  });

  await t.test('usuário inativo é bloqueado antes do JWT', async () => {
    const authService = loadAuthService({
      findUserByLogin: async (login) => ({
        id_usuario: 3,
        id_pessoa: 30,
        login,
        senha_hash: bcryptMock.hashSync('qualquer'),
        ativo: false,
        pessoa_nome: 'Carla Lima',
        profiles: ['Administrador']
      }),
      updateLastLogin: async () => {},
      getUserMe: async () => null,
      getUserCadastroContext: async () => 9
    });

    await assert.rejects(
      () => authService.login({ login: 'carla', senha: 'qualquer' }, { log: createNoopLogger() }),
      (error) => error instanceof HttpError
        && error.statusCode === 401
        && error.stage === 'auth'
        && error.message === 'Credenciais inválidas.'
    );
  });

  await t.test('login sem campos obrigatórios é rejeitado com 400', async () => {
    const authService = loadAuthService({
      findUserByLogin: async () => null,
      updateLastLogin: async () => {},
      getUserMe: async () => null,
      getUserCadastroContext: async () => null
    });

    await assert.rejects(
      () => authService.login({}, { log: createNoopLogger() }),
      (error) => error instanceof HttpError
        && error.statusCode === 400
        && error.stage === 'auth'
        && error.message === 'Login e senha são obrigatórios.'
    );
  });

  await t.test('middleware exige tenant explícito no JWT', async () => {
    const { authenticate } = freshRequire('src/middlewares/auth.js', {
      'src/modules/auth/repository.js': {
        getUserMe: async (idUsuario) => ({ id_usuario: idUsuario })
      }
    }, {
      jsonwebtoken: jwtMock,
      dotenv: dotenvMock
    });

    const validToken = jwtMock.sign(
      {
        sub: 8,
        id_usuario: 8,
        id_pessoa: 80,
        id_cadastro: 7,
        login: 'ana',
        profiles: ['Administrador']
      },
      'test-secret',
      { expiresIn: '1h' }
    );

    const authorizedReq = {
      headers: { authorization: `Bearer ${validToken}` }
    };

    const authError = await callMiddleware(authenticate, authorizedReq);
    assert.equal(authError, undefined);
    assert.equal(authorizedReq.tenantId, 7);
    assert.equal(authorizedReq.user.id_cadastro, 7);
    assert.deepEqual(authorizedReq.user.profiles, ['Administrador']);

    const missingTenantToken = jwtMock.sign(
      {
        sub: 9,
        id_usuario: 9,
        id_pessoa: 90,
        login: 'sem-tenant',
        profiles: ['Administrador']
      },
      'test-secret',
      { expiresIn: '1h' }
    );

    const rejectedReq = {
      headers: { authorization: `Bearer ${missingTenantToken}` }
    };

    const missingTenantError = await callMiddleware(authenticate, rejectedReq);
    assert.ok(missingTenantError instanceof HttpError);
    assert.equal(missingTenantError.statusCode, 401);
    assert.equal(missingTenantError.stage, 'auth');
    assert.equal(missingTenantError.message, 'Token inválido ou expirado.');
  });
});
