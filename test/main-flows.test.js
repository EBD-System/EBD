'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.DATABASE_URL = 'postgres://test';
process.env.CORS_ORIGINS = '';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { todayISO } = require('../src/utils/date');
const { HttpError } = require('../src/utils/httpError');
const { freshRequire, createNoopLogger, callMiddleware } = require('./helpers');
const { setAuthContext, getAuthContext, resetAuthContext, resetClassesContext, setClassesContext, getClassesContext } = require('../src/shared/flow-context');

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
      throw new Error('invalid token');
    }
    const expectedSignature = sha256(`${encodedHeader}.${encodedPayload}.${secret}`);
    if (expectedSignature !== signature) {
      throw new Error('invalid signature');
    }
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64').toString('utf8'));
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      throw new Error('jwt expired');
    }
    return payload;
  }
};

const dotenvMock = {
  config() {
    return { parsed: process.env };
  }
};

const DEFAULT_CLASSES = [
  { id_classe: 101, id_cadastro: 7, nome: 'Crianças Menores', ativo: true },
  { id_classe: 102, id_cadastro: 7, nome: 'Crianças Maiores', ativo: true },
  { id_classe: 103, id_cadastro: 7, nome: 'Adolescentes', ativo: true },
  { id_classe: 104, id_cadastro: 7, nome: 'Jovens', ativo: true },
  { id_classe: 105, id_cadastro: 7, nome: 'Senhores', ativo: true },
  { id_classe: 106, id_cadastro: 7, nome: 'Senhoras', ativo: true }
];


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

test('fluxos principais da API', async (t) => {
  resetAuthContext();
  resetClassesContext();

  await t.test('login oficial com teste e 123456 emite JWT, preserva tenant e salva contexto compartilhado', async () => {
    const hash = bcryptMock.hashSync('123456');
    const calls = {
      lastLogin: null
    };

    const authService = freshRequire('src/modules/auth/service.js', {
      'src/modules/auth/repository.js': {
        findUserByLogin: async (login) => ({
          id_usuario: 1,
          id_pessoa: 10,
          login,
          senha_hash: hash,
          ativo: true,
          pessoa_nome: 'Usuário de Teste',
          profiles: ['Administrador']
        }),
        updateLastLogin: async (idUsuario) => {
          calls.lastLogin = idUsuario;
        },
        getUserMe: async () => null,
        getUserCadastroContext: async () => 7
      }
    }, {
      bcryptjs: bcryptMock,
      jsonwebtoken: jwtMock,
      dotenv: dotenvMock
    });

    const { loginController } = freshRequire('src/modules/auth/controller.js', {
      'src/modules/auth/service.js': authService
    });

    const res = createRes();
    await loginController(
      { body: { login: 'teste', senha: '123456' } },
      res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.ok, true);
    assert.equal(res.payload.message, 'Login realizado com sucesso.');
    assert.equal(res.payload.data.token.length > 0, true);
    assert.equal(res.payload.data.user.id_usuario, 1);
    assert.equal(res.payload.data.user.id_pessoa, 10);
    assert.equal(res.payload.data.user.id_cadastro, 7);
    assert.equal(res.payload.data.user.login, 'teste');
    assert.equal(res.payload.data.user.pessoa_nome, 'Usuário de Teste');
    assert.deepEqual(res.payload.data.user.profiles, ['Administrador']);

    const payload = jwtMock.verify(res.payload.data.token, 'test-secret');
    assert.equal(payload.sub, 1);
    assert.equal(payload.id_usuario, 1);
    assert.equal(payload.id_pessoa, 10);
    assert.equal(payload.id_cadastro, 7);
    assert.equal(payload.login, 'teste');
    assert.deepEqual(payload.profiles, ['Administrador']);

    assert.equal(calls.lastLogin, 1);

    setAuthContext({
      token: res.payload.data.token,
      user: res.payload.data.user,
      payload
    });

    assert.equal(getAuthContext().token, res.payload.data.token);
    assert.equal(getAuthContext().user.id_cadastro, 7);
  });

  await t.test('token salvo no fluxo de login autentica a próxima requisição', async () => {
    const authContext = getAuthContext();
    assert.equal(typeof authContext.token, 'string');
    assert.equal(authContext.user.id_cadastro, 7);

    const { authenticate } = freshRequire('src/middlewares/auth.js', {
      'src/modules/auth/repository.js': {
        getUserMe: async (idUsuario) => ({
          id_usuario: idUsuario
        })
      }
    }, {
      jsonwebtoken: jwtMock,
      dotenv: dotenvMock
    });

    const req = {
      headers: { authorization: `Bearer ${authContext.token}` },
      originalUrl: '/api/v1/auth/me'
    };

    const error = await callMiddleware(authenticate, req);
    assert.equal(error, undefined);
    assert.equal(req.tenantId, 7);
    assert.equal(req.user.id_usuario, 1);
    assert.equal(req.user.id_cadastro, 7);
    assert.equal(req.user.login, 'teste');
  });

  await t.test('turmas padrão carregam após login e ficam disponíveis para próximos fluxos', async () => {
    const authContext = getAuthContext();
    assert.equal(typeof authContext.token, 'string');
    assert.equal(authContext.user.id_cadastro, 7);

    const { authenticate } = freshRequire('src/middlewares/auth.js', {
      'src/modules/auth/repository.js': {
        getUserMe: async (idUsuario) => ({
          id_usuario: idUsuario
        })
      }
    }, {
      jsonwebtoken: jwtMock,
      dotenv: dotenvMock
    });

    const { listController } = freshRequire('src/modules/classes/controller.js', {
      'src/modules/classes/repository.js': {
        listClasses: async (idCadastro, dateChamada) => {
          assert.equal(idCadastro, 7);
          assert.equal(dateChamada, undefined);
          return DEFAULT_CLASSES.map((row, index) => ({
            ...row,
            total_alunos_ativos: String(index + 1),
            chamada_ja_feita: index % 2 === 0,
            id_chamada: index % 2 === 0 ? 100 + index : null,
            chamada_fechada: index % 3 === 0
          }));
        },
        getClassById: async () => null,
        getClassStudents: async () => [],
        getClassAttendance: async () => []
      }
    }, {
      dotenv: dotenvMock
    });

    const req = {
      headers: { authorization: `Bearer ${authContext.token}` },
      originalUrl: '/api/v1/classes'
    };
    const res = createRes();

    const authError = await callMiddleware(authenticate, req);
    assert.equal(authError, undefined);
    assert.equal(req.user.id_cadastro, 7);
    assert.equal(req.tenantId, 7);

    await listController(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.ok, true);
    assert.equal(res.payload.message, 'Consulta de classes realizada com sucesso.');

    const classes = res.payload.data;
    assert.equal(classes.length, 6);
    assert.deepEqual(classes.map((row) => row.nome), [
      'Crianças Menores',
      'Crianças Maiores',
      'Adolescentes',
      'Jovens',
      'Senhores',
      'Senhoras'
    ]);
    assert.ok(classes.every((row) => row.id_cadastro === 7));
    assert.equal(classes[0].chamada_ja_feita, true);
    assert.equal(classes[1].chamada_ja_feita, false);

    const sharedClasses = setClassesContext({
      tenantId: req.user.id_cadastro,
      list: classes,
      ids: classes.map((row) => row.id_classe),
      idsByName: Object.fromEntries(classes.map((row) => [row.nome, row.id_classe])),
      byId: Object.fromEntries(classes.map((row) => [row.id_classe, row]))
    });

    assert.equal(sharedClasses.tenantId, 7);
    assert.equal(getClassesContext().list.length, 6);
    assert.equal(getClassesContext().ids.length, 6);
    assert.equal(getClassesContext().idsByName['Crianças Menores'], 101);
    assert.equal(getClassesContext().byId[106].nome, 'Senhoras');
  });

  await t.test('cadastro de pessoa preserva o tenant do contexto', async () => {
    const captured = {};

    const peopleService = freshRequire('src/modules/pessoas/service.js', {
      'src/modules/pessoas/repository.js': {
        listPeople: async () => [],
        getPersonById: async () => null,
        createPerson: async (payload) => {
          captured.payload = payload;
          return { id_pessoa: 33, ...payload };
        },
        updatePerson: async () => null
      }
    }, {
      dotenv: dotenvMock
    });

    const result = await peopleService.create(
      { nome: 'Maria de Lourdes', email: 'maria@example.com' },
      { user: { id_cadastro: 7 }, requestId: 'req-cadastro', log: createNoopLogger() }
    );

    assert.equal(captured.payload.idCadastro, 7);
    assert.equal(result.id_pessoa, 33);
    assert.equal(result.nome, 'Maria de Lourdes');
  });

  await t.test('matrícula valida pessoa, classe ativa e tenant', async () => {
    const captured = {};

    const studentsService = freshRequire('src/modules/alunos/service.js', {
      'src/modules/pessoas/repository.js': {
        getPersonById: async (idPessoa, idCadastro) => {
          if (idPessoa === 10 && idCadastro === 7) {
            return { id_pessoa: 10, nome: 'Maria de Lourdes' };
          }
          return null;
        }
      },
      'src/modules/classes/repository.js': {
        getClassById: async (idClasse, idCadastro) => {
          if (idClasse === 20 && idCadastro === 7) {
            return { id_classe: 20, nome: 'Turma A', ativo: true };
          }
          return null;
        }
      },
      'src/modules/alunos/repository.js': {
        listStudents: async () => [],
        getStudentById: async (idAluno, idCadastro) => {
          if (idAluno === 44 && idCadastro === 7) {
            return {
              id_aluno: 44,
              id_cadastro: 7,
              id_pessoa: 10,
              nome: 'Maria de Lourdes',
              email: 'maria@example.com',
              matricula: '2026-001',
              status: 'ativo',
              id_aluno_classe: 88,
              id_classe: 20,
              classe: 'Turma A',
              data_inicio: '2026-07-17',
              data_fim: null,
              ativo_classe: true,
              observacao: 'primeira matrícula'
            };
          }
          return null;
        },
        matriculateStudent: async (payload) => {
          captured.payload = payload;
          return 44;
        },
        activateStudent: async () => true,
        inactivateStudent: async () => true,
        getStudentHistory: async () => [],
        getStudentStatusHistory: async () => [],
        getStudentClasses: async () => []
      }
    }, {
      dotenv: dotenvMock
    });

    const result = await studentsService.enroll(
      {
        idPessoa: 10,
        idClasse: 20,
        matricula: '2026-001',
        dataInicio: '2026-07-17',
        observacao: 'primeira matrícula'
      },
      { user: { id_cadastro: 7 }, requestId: 'req-matricula', log: createNoopLogger() }
    );

    assert.equal(captured.payload.idCadastro, 7);
    assert.equal(captured.payload.idPessoa, 10);
    assert.equal(captured.payload.idClasse, 20);
    assert.deepEqual(result, {
      id_aluno: 44,
      id_cadastro: 7,
      id_pessoa: 10,
      nome: 'Maria de Lourdes',
      email: 'maria@example.com',
      matricula: '2026-001',
      status: 'ativo',
      id_aluno_classe: 88,
      id_classe: 20,
      classe: 'Turma A',
      data_inicio: '2026-07-17',
      data_fim: null,
      ativo_classe: true,
      observacao: 'primeira matrícula'
    });
  });

  await t.test('matrícula bloqueia turma inativa', async () => {
    const studentsService = freshRequire('src/modules/alunos/service.js', {
      'src/modules/pessoas/repository.js': {
        getPersonById: async () => ({ id_pessoa: 10, nome: 'Maria de Lourdes' })
      },
      'src/modules/classes/repository.js': {
        getClassById: async () => ({ id_classe: 20, nome: 'Turma A', ativo: false })
      },
      'src/modules/alunos/repository.js': {
        listStudents: async () => [],
        getStudentById: async () => null,
        matriculateStudent: async () => 44,
        activateStudent: async () => true,
        inactivateStudent: async () => true,
        getStudentHistory: async () => [],
        getStudentStatusHistory: async () => [],
        getStudentClasses: async () => []
      }
    }, {
      dotenv: dotenvMock
    });

    await assert.rejects(
      () => studentsService.enroll(
        { idPessoa: 10, idClasse: 20 },
        { user: { id_cadastro: 7 }, log: createNoopLogger() }
      ),
      (error) => error instanceof HttpError && error.statusCode === 400 && error.stage === 'students'
    );
  });

  await t.test('chamada abre no tenant certo e atualiza presença', async () => {
    const captured = {
      open: null,
      update: null,
      presentAll: null
    };

    const attendanceService = freshRequire('src/modules/chamadas/service.js', {
      'src/modules/classes/repository.js': {
        getClassById: async (idClasse, idCadastro) => {
          if (idClasse === 3 && idCadastro === 7) {
            return { id_classe: 3, nome: 'Turma A', ativo: true };
          }
          return null;
        }
      },
      'src/modules/chamadas/repository.js': {
        openAttendance: async (classId, date, idCadastro) => {
          captured.open = { classId, date, idCadastro };
          return 99;
        },
        getAttendanceByClassAndDate: async () => [],
        updateAttendanceStatus: async (callId, studentClassId, status, observation, idCadastro) => {
          captured.update = { callId, studentClassId, status, observation, idCadastro };
          return { id_chamada_aluno: 11, status, observacao: observation };
        },
        markAllPresent: async (callId, idCadastro) => {
          captured.presentAll = { callId, idCadastro };
        },
        markAllAbsent: async () => {},
        closeAttendance: async () => {},
        reopenAttendance: async () => {},
        registerVisitor: async () => null,
        registerOffer: async () => null,
        getCallSummary: async () => [],
        getClassSummary: async () => []
      }
    }, {
      dotenv: dotenvMock
    });

    const callDate = todayISO();
    const opened = await attendanceService.open({
      classId: 3,
      date: callDate,
      isAdmin: false,
      source: { user: { id_cadastro: 7 }, requestId: 'req-chamada', log: createNoopLogger() }
    });

    assert.deepEqual(opened, { id_chamada: 99, data_chamada: callDate });
    assert.deepEqual(captured.open, { classId: 3, date: callDate, idCadastro: 7 });

    const presence = await attendanceService.changeStatus({
      callId: 99,
      studentClassId: 44,
      status: 'presente',
      observation: 'pontual',
      source: { user: { id_cadastro: 7 }, log: createNoopLogger() }
    });

    assert.deepEqual(presence, {
      id_chamada_aluno: 11,
      status: 'presente',
      observacao: 'pontual'
    });
    assert.deepEqual(captured.update, {
      callId: 99,
      studentClassId: 44,
      status: 'presente',
      observation: 'pontual',
      idCadastro: 7
    });

    const bulk = await attendanceService.presentAll(99, {
      user: { id_cadastro: 7 },
      log: createNoopLogger()
    });

    assert.deepEqual(bulk, { id_chamada: 99, status: 'presente' });
    assert.deepEqual(captured.presentAll, { callId: 99, idCadastro: 7 });
  });

  await t.test('relatórios retornam envelope estável com tenant e data', async () => {
    const captured = {};

    const reportsService = freshRequire('src/modules/relatorios/service.js', {
      'src/modules/relatorios/repository.js': {
        getPresenceRanking: async (date, idCadastro) => {
          captured.presence = { date, idCadastro };
          return [
            { id_classe: 1, classe: 'Turma A', presentes: 10 },
            { id_classe: 2, classe: 'Turma B', presentes: 8 }
          ];
        },
        getVisitorRanking: async () => [],
        getOfferRanking: async () => [],
        getBirthdays: async () => []
      }
    }, {
      dotenv: dotenvMock
    });

    const result = await reportsService.presenceRanking('2026-07-17', {
      user: { id_cadastro: 7 }
    });

    assert.deepEqual(captured.presence, { date: '2026-07-17', idCadastro: 7 });
    assert.deepEqual(result, {
      relatorio: 'presenca',
      id_cadastro: 7,
      data_referencia: '2026-07-17',
      total_itens: 2,
      itens: [
        { id_classe: 1, classe: 'Turma A', presentes: 10 },
        { id_classe: 2, classe: 'Turma B', presentes: 8 }
      ]
    });
  });

  await t.test('validação de tenant bloqueia consulta sem id_cadastro', async () => {
    const peopleService = freshRequire('src/modules/pessoas/service.js', {
      'src/modules/pessoas/repository.js': {
        listPeople: async () => [],
        getPersonById: async () => null,
        createPerson: async () => null,
        updatePerson: async () => null
      }
    }, {
      dotenv: dotenvMock
    });

    await assert.rejects(
      () => peopleService.list({ query: {}, user: {} }),
      (error) => error instanceof HttpError && error.statusCode === 400 && error.stage === 'people'
    );
  });

  await t.test('autenticação e bloqueio de acesso indevido', async () => {
    const { authenticate, requireProfiles } = freshRequire('src/middlewares/auth.js', {
      'src/modules/auth/repository.js': {
        getUserMe: async (idUsuario) => ({ id_usuario: idUsuario })
      }
    }, {
      jsonwebtoken: jwtMock,
      dotenv: dotenvMock
    });

    const token = jwtMock.sign(
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
      headers: { authorization: `Bearer ${token}` }
    };

    const authError = await callMiddleware(authenticate, authorizedReq);
    assert.equal(authError, undefined);
    assert.equal(authorizedReq.tenantId, 7);
    assert.equal(authorizedReq.user.id_cadastro, 7);
    assert.deepEqual(authorizedReq.user.profiles, ['Administrador']);

    const originalWarn = console.warn;
    try {
      console.warn = () => {};
      const missingTokenError = await callMiddleware(authenticate, { headers: {} });
      assert.ok(missingTokenError instanceof HttpError);
      assert.equal(missingTokenError.statusCode, 401);
      assert.equal(missingTokenError.stage, 'auth');
    } finally {
      console.warn = originalWarn;
    }

    const adminOnly = requireProfiles('Administrador');
    const forbiddenReq = {
      user: {
        profiles: ['Professor']
      }
    };

    const forbiddenError = await callMiddleware(adminOnly, forbiddenReq);
    assert.ok(forbiddenError instanceof HttpError);
    assert.equal(forbiddenError.statusCode, 403);
    assert.equal(forbiddenError.stage, 'auth');
  });


  await t.test('async handlers forward errors and the global handler stays safe', async () => {
    const { asyncHandler } = freshRequire('src/utils/asyncHandler.js');

    const forwardedError = await callMiddleware(
      asyncHandler(async () => {
        throw new HttpError(401, 'Credenciais inválidas.', 'auth');
      })
    );

    assert.ok(forwardedError instanceof HttpError);
    assert.equal(forwardedError.statusCode, 401);
    assert.equal(forwardedError.stage, 'auth');

    const loggerMock = createNoopLogger();
    const { errorHandler } = freshRequire('src/middlewares/errorHandler.js', {}, {
      '../utils/logger': {
        logger: loggerMock,
        getRequestContext: () => ({
          request_id: 'req-err',
          method: 'POST',
          route: '/api/v1/auth/login',
          path: '/api/v1/auth/login'
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

    const knownRes = createRes();
    errorHandler(new HttpError(409, 'Recurso já existe.', 'auth'), { requestId: 'req-err' }, knownRes, () => {});
    assert.equal(knownRes.statusCode, 409);
    assert.deepEqual(knownRes.payload, {
      ok: false,
      source: 'backend',
      stage: 'auth',
      message: 'Recurso já existe.',
      error: {
        statusCode: 409,
        stage: 'auth'
      }
    });

    const unexpectedRes = createRes();
    errorHandler(new Error('boom'), { requestId: 'req-err' }, unexpectedRes, () => {});
    assert.equal(unexpectedRes.statusCode, 500);
    assert.equal(unexpectedRes.payload.message, 'Erro interno do servidor.');
    assert.equal(unexpectedRes.payload.error.statusCode, 500);
    assert.equal(unexpectedRes.payload.error.stage, 'server');
    assert.equal(Object.prototype.hasOwnProperty.call(unexpectedRes.payload, 'stack'), false);
  });
});
