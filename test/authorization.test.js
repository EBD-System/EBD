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
  const normalized = String(input).replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, 'base64').toString('utf8');
}

function sha256(text) {
  return crypto.createHash('sha256').update(String(text)).digest('hex');
}

function createToken(payload, options = {}) {
  const secret = options.secret || process.env.JWT_SECRET;
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
        request_id: 'req-authz',
        method: 'GET',
        route: '/api/v1/people',
        path: '/api/v1/people'
      })
    }
  }).errorHandler;
}

function buildAuthMiddleware() {
  return freshRequire('src/middlewares/auth.js', {
    'src/modules/auth/repository.js': {
      getUserMe: async (idUsuario) => ({ id_usuario: idUsuario })
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
  });
}

function buildAuthorizationServices() {
  const peopleByTenant = {
    7: {
      list: [{ id_pessoa: 71, id_cadastro: 7, nome: 'Pessoa do tenant 7' }],
      resources: {
        33: { id_pessoa: 33, id_cadastro: 7, nome: 'Maria do tenant 7' }
      }
    },
    8: {
      list: [{ id_pessoa: 81, id_cadastro: 8, nome: 'Pessoa do tenant 8' }],
      resources: {
        44: { id_pessoa: 44, id_cadastro: 8, nome: 'Joana do tenant 8' }
      }
    }
  };

  const peopleService = {
    list: async (source = {}) => {
      const tenant = source.tenantId;
      const bucket = peopleByTenant[tenant] || { list: [] };
      return {
        tenantId: tenant,
        items: bucket.list
      };
    },
    get: async (idPessoa, source = {}) => {
      const tenant = source.tenantId;
      const resource = peopleByTenant[tenant]?.resources?.[Number(idPessoa)] || null;
      if (!resource) {
        throw new HttpError(404, 'Pessoa não encontrada.', 'people');
      }
      return resource;
    },
    create: async (payload, source = {}) => ({
      id_pessoa: 100,
      id_cadastro: source.tenantId,
      ...payload
    }),
    update: async (idPessoa, payload, source = {}) => ({
      id_pessoa: Number(idPessoa),
      id_cadastro: source.tenantId,
      ...payload
    })
  };

  const studentsService = {
    list: async () => [],
    get: async () => null,
    enroll: async (payload, source = {}) => {
      if (source.tenantId !== 7) {
        throw new HttpError(404, 'Pessoa ou classe não encontrada no tenant atual.', 'students');
      }

      return {
        id_aluno: 44,
        id_cadastro: source.tenantId,
        id_pessoa: Number(payload.idPessoa),
        nome: 'Joana da Silva',
        status: 'ativo',
        matricula: payload.matricula || '2026-001',
        id_aluno_classe: 555,
        id_classe: Number(payload.idClasse),
        classe: 'Turma B',
        data_inicio: payload.dataInicio || '2026-07-17',
        data_fim: null,
        ativo_classe: true,
        observacao: payload.observacao || ''
      };
    },
    activate: async () => null,
    inactivate: async () => null,
    history: async () => [],
    statusHistory: async () => [],
    classes: async () => []
  };

  return { peopleService, studentsService };
}

async function runMiddleware(middleware, req) {
  return callMiddleware(middleware, req);
}

test('autorização HTTP e escopo de tenant', async (t) => {
  const { authenticate, requireProfiles } = buildAuthMiddleware();
  const errorHandler = buildErrorHandler();
  const { peopleService, studentsService } = buildAuthorizationServices();

  await t.test('usuário autorizado passa no middleware e consegue operar no tenant correto', async () => {
    const token = createToken({
      sub: 8,
      id_usuario: 8,
      id_pessoa: 80,
      id_cadastro: 7,
      login: 'ana',
      profiles: ['Administrador']
    });

    const req = {
      headers: { authorization: `Bearer ${token}` },
      originalUrl: '/api/v1/people',
      body: {
        nome: 'Joana da Silva',
        email: 'joana@example.com'
      }
    };

    const authError = await runMiddleware(authenticate, req);
    assert.equal(authError, undefined);

    const roleError = await runMiddleware(requireProfiles('Administrador'), req);
    assert.equal(roleError, undefined);

    const created = await peopleService.create(req.body, req);
    assert.deepEqual(created, {
      id_pessoa: 100,
      id_cadastro: 7,
      nome: 'Joana da Silva',
      email: 'joana@example.com'
    });
  });

  await t.test('usuário sem permissão recebe 403 padronizado', async () => {
    const token = createToken({
      sub: 8,
      id_usuario: 8,
      id_pessoa: 80,
      id_cadastro: 7,
      login: 'ana',
      profiles: ['Professor']
    });

    const req = {
      headers: { authorization: `Bearer ${token}` },
      originalUrl: '/api/v1/people'
    };

    const authError = await runMiddleware(authenticate, req);
    assert.equal(authError, undefined);

    const forbiddenError = await runMiddleware(requireProfiles('Administrador'), req);
    assert.ok(forbiddenError instanceof HttpError);
    assert.equal(forbiddenError.statusCode, 403);
    assert.equal(forbiddenError.stage, 'auth');

    const res = createRes();
    errorHandler(forbiddenError, req, res, () => {});
    assert.deepEqual(res.payload, {
      ok: false,
      source: 'backend',
      stage: 'auth',
      message: 'Perfil sem permissão para esta operação.',
      error: {
        statusCode: 403,
        stage: 'auth'
      }
    });
  });

  await t.test('acesso sem autenticação é rejeitado com 401 padronizado', async () => {
    const req = { headers: {}, originalUrl: '/api/v1/people/33' };
    const authError = await runMiddleware(authenticate, req);

    assert.ok(authError instanceof HttpError);
    assert.equal(authError.statusCode, 401);
    assert.equal(authError.stage, 'auth');

    const res = createRes();
    errorHandler(authError, req, res, () => {});
    assert.deepEqual(res.payload, {
      ok: false,
      source: 'backend',
      stage: 'auth',
      message: 'Token não informado.',
      error: {
        statusCode: 401,
        stage: 'auth'
      }
    });
  });

  await t.test('tenant diferente recebe a sua própria lista sem vazamento de dados', async () => {
    const tokenTenant7 = createToken({
      sub: 8,
      id_usuario: 8,
      id_pessoa: 80,
      id_cadastro: 7,
      login: 'ana',
      profiles: ['Administrador']
    });

    const tokenTenant8 = createToken({
      sub: 9,
      id_usuario: 9,
      id_pessoa: 90,
      id_cadastro: 8,
      login: 'bia',
      profiles: ['Administrador']
    });

    const reqTenant7 = {
      headers: { authorization: `Bearer ${tokenTenant7}` },
      originalUrl: '/api/v1/people'
    };
    const reqTenant8 = {
      headers: { authorization: `Bearer ${tokenTenant8}` },
      originalUrl: '/api/v1/people'
    };

    await runMiddleware(authenticate, reqTenant7);
    await runMiddleware(authenticate, reqTenant8);

    const tenant7 = await peopleService.list(reqTenant7);
    const tenant8 = await peopleService.list(reqTenant8);

    assert.equal(tenant7.tenantId, 7);
    assert.equal(tenant8.tenantId, 8);
    assert.equal(tenant7.items[0].id_cadastro, 7);
    assert.equal(tenant8.items[0].id_cadastro, 8);
  });

  await t.test('tentativa de acessar recurso de outro tenant retorna 404', async () => {
    const tokenTenant8 = createToken({
      sub: 9,
      id_usuario: 9,
      id_pessoa: 90,
      id_cadastro: 8,
      login: 'bia',
      profiles: ['Administrador']
    });

    const req = {
      headers: { authorization: `Bearer ${tokenTenant8}` },
      originalUrl: '/api/v1/people/33'
    };

    await runMiddleware(authenticate, req);

    await assert.rejects(
      () => peopleService.get(33, req),
      (error) => error instanceof HttpError && error.statusCode === 404 && error.stage === 'people'
    );
  });

  await t.test('matrícula bloqueia uso de recursos fora do tenant atual', async () => {
    const tokenTenant7 = createToken({
      sub: 8,
      id_usuario: 8,
      id_pessoa: 80,
      id_cadastro: 7,
      login: 'ana',
      profiles: ['Administrador']
    });

    const tokenTenant8 = createToken({
      sub: 9,
      id_usuario: 9,
      id_pessoa: 90,
      id_cadastro: 8,
      login: 'bia',
      profiles: ['Administrador']
    });

    const reqTenant7 = {
      headers: { authorization: `Bearer ${tokenTenant7}` },
      originalUrl: '/api/v1/students/enroll'
    };
    const reqTenant8 = {
      headers: { authorization: `Bearer ${tokenTenant8}` },
      originalUrl: '/api/v1/students/enroll'
    };

    await runMiddleware(authenticate, reqTenant7);
    await runMiddleware(authenticate, reqTenant8);

    const allowed = await studentsService.enroll(
      {
        idPessoa: 33,
        idClasse: 44,
        matricula: '2026-001',
        dataInicio: '2026-07-17'
      },
      reqTenant7
    );

    assert.deepEqual(allowed, {
      id_aluno: 44,
      id_cadastro: 7,
      id_pessoa: 33,
      nome: 'Joana da Silva',
      status: 'ativo',
      matricula: '2026-001',
      id_aluno_classe: 555,
      id_classe: 44,
      classe: 'Turma B',
      data_inicio: '2026-07-17',
      data_fim: null,
      ativo_classe: true,
      observacao: ''
    });

    await assert.rejects(
      () => studentsService.enroll(
        {
          idPessoa: 33,
          idClasse: 44,
          matricula: '2026-002',
          dataInicio: '2026-07-17'
        },
        reqTenant8
      ),
      (error) => error instanceof HttpError && error.statusCode === 404 && error.stage === 'students'
    );
  });
});
