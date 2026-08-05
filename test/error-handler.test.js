'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.DATABASE_URL = 'postgres://test';
process.env.CORS_ORIGINS = '';

const test = require('node:test');
const assert = require('node:assert/strict');

const { HttpError } = require('../src/utils/httpError');
const { buildSuccessResponse } = require('../src/utils/response');
const { notFound } = require('../src/middlewares/notFound');
const { freshRequire } = require('./helpers');

function buildTestRuntime() {
  const { errorHandler } = freshRequire('src/middlewares/errorHandler.js', {}, {
    '../utils/logger': {
      logger: {
        error() {},
        warn() {},
        info() {},
        debug() {}
      },
      getRequestContext: () => ({
        request_id: 'req-test',
        method: 'GET',
        route: 'test',
        path: 'test'
      })
    }
  });

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

  async function requestJson(path) {
    const res = createRes();
    const req = {
      method: 'GET',
      originalUrl: path,
      url: path,
      requestId: 'req-test'
    };

    if (path === '/ok') {
      res.status(200).json(buildSuccessResponse({ alive: true }, 'Servidor ativo.'));
      return { status: res.statusCode, body: res.payload };
    }

    const routeError = {
      '/errors/400': new HttpError(400, 'Requisição inválida.', 'validation'),
      '/errors/401': new HttpError(401, 'Credenciais inválidas.', 'auth'),
      '/errors/403': new HttpError(403, 'Acesso negado.', 'auth'),
      '/errors/409': new HttpError(409, 'Recurso já existe.', 'conflict'),
      '/malformed-json': Object.assign(new SyntaxError('Unexpected token } in JSON at position 10'), {
        status: 400,
        body: '{"login":',
        type: 'entity.parse.failed'
      }),
      '/service/error': new Error('service exploded')
    }[path];

    if (path === '/missing-route') {
      notFound(req, res, (error) => errorHandler(error, req, res, () => {}));
      return { status: res.statusCode, body: res.payload };
    }

    errorHandler(routeError || new HttpError(404, 'Rota não encontrada.', 'routing'), req, res, () => {});
    return { status: res.statusCode, body: res.payload };
  }

  return { requestJson };
}

test('tratamento global de erros mantém o envelope oficial e o servidor ativo', async (t) => {
  const { requestJson } = buildTestRuntime();
  const successEnvelope = buildSuccessResponse({ alive: true }, 'Servidor ativo.');

  const cases = [
    {
      path: '/errors/400',
      statusCode: 400,
      stage: 'validation',
      message: 'Requisição inválida.'
    },
    {
      path: '/errors/401',
      statusCode: 401,
      stage: 'auth',
      message: 'Credenciais inválidas.'
    },
    {
      path: '/errors/403',
      statusCode: 403,
      stage: 'auth',
      message: 'Acesso negado.'
    },
    {
      path: '/missing-route',
      statusCode: 404,
      stage: 'routing',
      message: 'Rota não encontrada.'
    },
    {
      path: '/errors/409',
      statusCode: 409,
      stage: 'conflict',
      message: 'Recurso já existe.'
    },
    {
      path: '/malformed-json',
      statusCode: 400,
      stage: 'request',
      message: 'Requisição inválida.'
    },
    {
      path: '/service/error',
      statusCode: 500,
      stage: 'server',
      message: 'Erro interno do servidor.'
    }
  ];

  for (const testCase of cases) {
    const errorResponse = await requestJson(testCase.path);

    assert.equal(errorResponse.status, testCase.statusCode);
    assert.deepEqual(errorResponse.body, {
      ok: false,
      source: 'backend',
      stage: testCase.stage,
      message: testCase.message,
      error: {
        statusCode: testCase.statusCode,
        stage: testCase.stage
      }
    });

    const healthResponse = await requestJson('/ok');
    assert.equal(healthResponse.status, 200);
    assert.deepEqual(healthResponse.body, successEnvelope);
  }
});
