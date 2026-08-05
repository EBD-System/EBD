'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.DATABASE_URL = 'postgres://test';
process.env.CORS_ORIGINS = '';

const test = require('node:test');
const assert = require('node:assert/strict');
const { freshRequire, callMiddleware } = require('./helpers');

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
        request_id: 'req-validation',
        method: 'POST',
        route: '/api/v1',
        path: '/api/v1'
      })
    }
  }).errorHandler;
}

async function assertStandard400(error, expected) {
  const errorHandler = buildErrorHandler();
  const res = createRes();
  errorHandler(error, { requestId: 'req-validation' }, res, () => {});

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.payload, {
    ok: false,
    source: 'backend',
    stage: expected.stage,
    message: expected.message,
    error: {
      statusCode: 400,
      stage: expected.stage
    }
  });
}

async function assertMiddleware400(validator, req, expected) {
  const error = await callMiddleware(validator, req);
  assert.ok(error, 'expected validation error');
  await assertStandard400(error, expected);
}

test('validação de requisições mantém o contrato HTTP 400 padronizado', async (t) => {
  const validation = freshRequire('src/middlewares/requestValidation.js');

  await t.test('campos obrigatórios ausentes e payload vazio', async () => {
    await assertMiddleware400(
      validation.validateLoginBody,
      { body: {} },
      { stage: 'auth', message: 'login é obrigatório.' }
    );

    await assertMiddleware400(
      validation.validateLoginBody,
      { body: [] },
      { stage: 'auth', message: 'O payload deve ser um objeto.' }
    );

    await assertMiddleware400(
      validation.validateStudentEnrollBody,
      { body: {} },
      { stage: 'students', message: 'idPessoa é obrigatório.' }
    );

    await assertMiddleware400(
      validation.validateStudentTransferBody,
      { body: {} },
      { stage: 'students', message: 'idClasseDestino é obrigatório.' }
    );
  });

  await t.test('tipos inválidos, ids inválidos e parâmetros inválidos', async () => {
    await assertMiddleware400(
      validation.validateLoginBody,
      { body: { login: 123, senha: 'senha' } },
      { stage: 'auth', message: 'login deve ser um texto.' }
    );

    await assertMiddleware400(
      validation.validateLoginBody,
      { body: { login: 'ana', senha: 123 } },
      { stage: 'auth', message: 'senha deve ser um texto.' }
    );

    await assertMiddleware400(
      validation.validatePositiveIdParam('id', 'people'),
      { params: { id: 'abc' } },
      { stage: 'people', message: 'id deve ser um número inteiro válido.' }
    );

    await assertMiddleware400(
      validation.validateAttendanceCallParams,
      { params: { callId: '0', studentClassId: '1' } },
      { stage: 'attendance', message: 'callId deve ser um número inteiro válido.' }
    );
  });

  await t.test('datas inválidas e query string inválida', async () => {
    await assertMiddleware400(
      validation.validateClassListQuery,
      { query: { date: '2026-02-30' } },
      { stage: 'classes', message: 'date deve estar no formato YYYY-MM-DD.' }
    );

    await assertMiddleware400(
      validation.validateReportsDateQuery,
      { query: { date: '17/07/2026' } },
      { stage: 'reports', message: 'date deve estar no formato YYYY-MM-DD.' }
    );

    await assertMiddleware400(
      validation.validateReportsPeriodQuery,
      { query: { startDate: '2026-07-18', endDate: '2026-07-17' } },
      { stage: 'reports', message: 'startDate não pode ser maior que endDate.' }
    );

    await assertMiddleware400(
      validation.validatePeopleListQuery,
      { query: { page: 'abc', limit: '50' } },
      { stage: 'people', message: 'page deve ser um número inteiro válido.' }
    );

    await assertMiddleware400(
      validation.validateStudentInactiveReasonsQuery,
      { query: {} },
      { stage: 'students', message: 'ids é obrigatório.' }
    );

    await assertMiddleware400(
      validation.validateStudentInactiveReasonsQuery,
      { query: { ids: '1,abc,3' } },
      { stage: 'students', message: 'ids deve ser um número inteiro válido.' }
    );

    await assertMiddleware400(
      validation.validateStudentsListQuery,
      { query: { classId: 'zero' } },
      { stage: 'students', message: 'classId deve ser um número inteiro válido.' }
    );
  });

  await t.test('telefone é normalizado para dígitos e respeita o limite do banco', async () => {
    const createReq = { body: { nome: 'Ana', telefone: '(81) 98888-0000' } };
    const updateReq = { body: { telefone: '81 99999-9999' } };

    const createError = await callMiddleware(validation.validatePersonCreateBody, createReq);
    assert.equal(createError, undefined);
    assert.equal(createReq.body.telefone, '81988880000');

    const updateError = await callMiddleware(validation.validatePersonUpdateBody, updateReq);
    assert.equal(updateError, undefined);
    assert.equal(updateReq.body.telefone, '81999999999');

    await assertMiddleware400(
      validation.validatePersonCreateBody,
      { body: { nome: 'Ana', telefone: '(11) 91234-5678-9' } },
      { stage: 'people', message: 'telefone deve conter no máximo 11 dígitos.' }
    );
  });

  await t.test('parâmetros de corpo com formato inválido', async () => {
    await assertMiddleware400(
      validation.validateAttendanceOpenBody,
      { body: { classId: 'abc', date: '2026-13-01' } },
      { stage: 'attendance', message: 'classId deve ser um número inteiro válido.' }
    );

    await assertMiddleware400(
      validation.validateStudentEnrollBody,
      { body: { idPessoa: '10', idClasse: '20', dataInicio: '2026-02-30' } },
      { stage: 'students', message: 'dataInicio deve estar no formato YYYY-MM-DD.' }
    );

    await assertMiddleware400(
      validation.validateStudentTransferBody,
      { body: { idClasseDestino: 'abc' } },
      { stage: 'students', message: 'idClasseDestino deve ser um número inteiro válido.' }
    );

    await assertMiddleware400(
      validation.validateAttendanceBatchChangeBody,
      { body: {} },
      { stage: 'attendance', message: 'students deve ser uma lista com pelo menos um item.' }
    );

    await assertMiddleware400(
      validation.validateAttendanceBatchChangeBody,
      { body: { students: [{ studentClassId: 'x', status: 'presente' }] } },
      { stage: 'attendance', message: 'students[0].studentClassId deve ser um número inteiro válido.' }
    );

    await assertMiddleware400(
      validation.validateAttendanceBatchChangeBody,
      {
        body: {
          students: [
            { studentClassId: 1, status: 'presente' },
            { studentClassId: 1, status: 'ausente' }
          ]
        }
      },
      { stage: 'attendance', message: 'students não pode conter studentClassId duplicado.' }
    );

    await assertMiddleware400(
      validation.validateAttendanceVisitorBody,
      { body: { name: '', observation: 'x' } },
      { stage: 'attendance', message: 'name é obrigatório.' }
    );

    await assertMiddleware400(
      validation.validateAttendanceSummaryBody,
      { body: {} },
      { stage: 'attendance', message: 'Informe ao menos um campo do resumo da chamada.' }
    );

    const summaryReq = {
      body: { oferta: '12.50', visitantes: '3', biblias: '2', revistas: '4' }
    };
    const summaryError = await callMiddleware(validation.validateAttendanceSummaryBody, summaryReq);
    assert.equal(summaryError, undefined);
    assert.deepEqual(summaryReq.body, {
      oferta: 12.5,
      visitantes: 3,
      biblias: 2,
      revistas: 4
    });
  });

  await t.test('JSON malformado vira 400 padronizado no error handler', async () => {
    const error = Object.assign(new SyntaxError('Unexpected token } in JSON at position 10'), {
      status: 400,
      body: '{"login":',
      type: 'entity.parse.failed'
    });

    await assertStandard400(error, {
      stage: 'request',
      message: 'Requisição inválida.'
    });
  });
});
