'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.DATABASE_URL = 'postgres://test';
process.env.CORS_ORIGINS = '';

const test = require('node:test');
const assert = require('node:assert/strict');

const { HttpError } = require('../src/utils/httpError');
const { asyncHandler } = require('../src/utils/asyncHandler');
const { validateLoginBody } = require('../src/middlewares/requestValidation');
const { freshRequire, callMiddleware } = require('./helpers');

function buildController(serviceMock) {
  return freshRequire('src/modules/auth/controller.js', {
    'src/modules/auth/service.js': serviceMock
  });
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
        method: 'POST',
        route: '/api/v1/auth/login',
        path: '/api/v1/auth/login'
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

function buildResponseService() {
  return {
    login: async (body) => {
      if (body.login === 'inexistente') {
        throw new HttpError(401, 'Credenciais inválidas.', 'auth');
      }
      if (body.login === 'senha-incorreta') {
        throw new HttpError(401, 'Credenciais inválidas.', 'auth');
      }
      if (body.login === 'inativo') {
        throw new HttpError(401, 'Credenciais inválidas.', 'auth');
      }

      return {
        token: 'jwt.fake.token',
        user: {
          id_usuario: 1,
          id_pessoa: 10,
          id_cadastro: 7,
          login: body.login,
          pessoa_nome: 'Ana Silva',
          profiles: ['Administrador']
        }
      };
    },
    me: async () => ({
      id_usuario: 1,
      id_pessoa: 10,
      id_cadastro: 7,
      login: 'ana',
      ultimo_login: '2026-07-17T00:00:00.000Z',
      ativo: true,
      pessoa_nome: 'Ana Silva',
      email: 'ana@example.com',
      profiles: ['Administrador']
    })
  };
}

test('autenticação - contrato HTTP e envelope padronizado', async (t) => {
  const { loginController } = buildController(buildResponseService());
  const errorHandler = buildErrorHandler();

  await t.test('login válido retorna envelope de sucesso', async () => {
    const res = createRes();
    await loginController(
      { body: { login: 'ana', senha: 'senha-secreta' } },
      res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.ok, true);
    assert.equal(res.payload.message, 'Login realizado com sucesso.');
    assert.equal(res.payload.data.token, 'jwt.fake.token');
    assert.equal(res.payload.data.user.id_cadastro, 7);
  });

  await t.test('login sem campos obrigatórios retorna envelope de erro padronizado', async () => {
    const error = await callMiddleware(validateLoginBody, { body: {} });
    const res = createRes();
    errorHandler(error, { requestId: 'req-auth' }, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.equal(res.payload.ok, false);
    assert.equal(res.payload.source, 'backend');
    assert.equal(res.payload.stage, 'auth');
    assert.equal(res.payload.error.statusCode, 400);
  });

  await t.test('payload inválido retorna envelope de erro padronizado', async () => {
    const error = await callMiddleware(validateLoginBody, { body: [] });
    const res = createRes();
    errorHandler(error, { requestId: 'req-auth' }, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.equal(res.payload.ok, false);
    assert.equal(res.payload.source, 'backend');
    assert.equal(res.payload.stage, 'auth');
    assert.equal(res.payload.error.statusCode, 400);
  });

  await t.test('credenciais inválidas continuam padronizadas para inexistente, senha errada e usuário inativo', async () => {
    for (const login of ['inexistente', 'senha-incorreta', 'inativo']) {
      const res = createRes();
      const error = await callMiddleware(
        asyncHandler(loginController),
        {
          body: { login, senha: 'qualquer' }
        },
        res
      );
      errorHandler(error, { requestId: 'req-auth' }, res, () => {});

      assert.equal(res.statusCode, 401);
      assert.equal(res.payload.ok, false);
      assert.equal(res.payload.source, 'backend');
      assert.equal(res.payload.stage, 'auth');
      assert.equal(res.payload.error.statusCode, 401);
      assert.equal(res.payload.message, 'Credenciais inválidas.');
    }
  });
});
