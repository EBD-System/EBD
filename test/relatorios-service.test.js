const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

function loadService(fetchImpl) {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'src/modules/relatorios/services/relatorios.service.js'),
    'utf8'
  );

  const context = {
    APP_CONFIG: {
      resolveApiBaseUrl: () => 'http://localhost/api/v1'
    },
    APP_API_CLIENT: {
      safeJson: async (response) => response.json(),
      isFailurePayload: () => false,
      createApiError: (response, payload, options = {}) => {
        const error = new Error(payload?.message || options.fallbackMessage || 'API error');
        error.status = response.status;
        return error;
      }
    },
    fetch: fetchImpl,
    structuredClone,
    Intl,
    URLSearchParams,
    Object,
    Array,
    Number,
    String,
    Boolean,
    RegExp,
    JSON,
    Error,
    TypeError,
    Math,
    Date,
    console
  };

  context.globalThis = context;
  vm.runInNewContext(source, context, {
    filename: 'relatorios.service.js'
  });

  return context.APP_REPORTS_SERVICE;
}

test('Melhor da Classe não trunca a lista em 10 alunos', async () => {
  const students = Array.from({ length: 25 }, (_, index) => ({
    posicao: index + 1,
    nome: `Aluno ${index + 1}`,
    classe: 'Turma A',
    percentual_presenca: 100 - index
  }));

  const service = loadService(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      ok: true,
      data: {
        class_id: 1,
        class_label: 'Turma A',
        periodo: {
          startDate: '2026-07-01',
          endDate: '2026-08-10'
        },
        ranking: students
      }
    })
  }));

  const result = await service.fetchClassStudentsRanking({
    classId: 1,
    startDate: '2026-07-01',
    endDate: '2026-08-10',
    token: 'token-de-teste'
  });

  assert.equal(result.found, true);
  assert.equal(result.ranking.length, 25);
  assert.equal(result.ranking[0].nome, 'Aluno 1');
  assert.equal(result.ranking[24].nome, 'Aluno 25');
});

test('Ranking de classes continua preservando o limite de 10 itens', async () => {
  const students = Array.from({ length: 25 }, (_, index) => ({
    posicao: index + 1,
    nome: `Aluno ${index + 1}`,
    classe: 'Turma A',
    percentual_presenca: 100 - index
  }));

  const service = loadService(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      ok: true,
      data: {
        ranking: students
      }
    })
  }));

  const result = await service.fetchClassesRanking({
    startDate: '2026-07-01',
    endDate: '2026-08-10',
    token: 'token-de-teste'
  });

  assert.equal(result.found, true);
  assert.equal(result.ranking.length, 10);
  assert.equal(result.ranking[9].classe, 'Turma A');
});
