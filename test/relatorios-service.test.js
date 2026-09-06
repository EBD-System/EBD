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

test('Relatório do Aluno envia studentId e período e preserva o payload', async () => {
  let requestedUrl = '';

  const service = loadService(async (url) => {
    requestedUrl = String(url);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        data: {
          relatorio: 'aluno',
          title: 'Relatório do Aluno',
          periodo: {
            startDate: '2026-07-01',
            endDate: '2026-08-10'
          },
          aluno: {
            id_aluno: 7,
            nome: 'Maria da Silva',
            classe: 'Turma A'
          },
          resumo: {
            presencas: 8,
            atrasos: 1,
            ausencias: 2,
            percentual_presenca: 81.8
          },
          meses: [
            {
              mes: '2026-07',
              mes_nome: 'Julho 2026',
              total_chamadas: 5,
              presencas: 4,
              atrasos: 1,
              ausencias: 1,
              percentual_presenca: 80
            }
          ]
        }
      })
    };
  });

  const result = await service.fetchStudentReport({
    studentId: 7,
    startDate: '2026-07-01',
    endDate: '2026-08-10',
    token: 'token-de-teste'
  });

  assert.equal(result.found, true);
  assert.equal(result.report.aluno.nome, 'Maria da Silva');
  assert.match(requestedUrl, /\/reports\/student-report\?/);
  assert.match(requestedUrl, /studentId=7/);
  assert.match(requestedUrl, /startDate=2026-07-01/);
  assert.match(requestedUrl, /endDate=2026-08-10/);
});


test('Relatório do Aluno reconstrói a frequência mensal quando o endpoint retorna resumo sem meses', async () => {
  const requestedUrls = [];

  const service = loadService(async (url) => {
    requestedUrls.push(String(url));

    if (String(url).includes('/reports/student-report?')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          data: {
            relatorio: 'aluno',
            aluno: {
              id_aluno: 120,
              nome: 'Benjamim de França',
              classe: 'Shalon'
            },
            periodo: {
              startDate: '2026-08-04',
              endDate: '2026-08-11'
            },
            resumo: {
              total_chamadas: 1,
              presencas: 1,
              atrasos: 0,
              ausencias: 0,
              percentual_presenca: 100
            },
            meses: []
          }
        })
      };
    }

    assert.match(String(url), /\/reports\/period\/pdf\?/);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        data: {
          rows: [
            {
              id_aluno: 120,
              id_classe: 2,
              nome: 'Benjamim de França',
              classe: 'Shalon',
              data_chamada: '2026-08-08',
              status_presenca: 'presente'
            }
          ]
        }
      })
    };
  });

  const result = await service.fetchStudentReport({
    studentId: 120,
    studentName: 'Benjamim de França',
    classId: 2,
    startDate: '2026-08-04',
    endDate: '2026-08-11',
    token: 'token-de-teste'
  });

  assert.equal(result.found, true);
  assert.equal(result.report.resumo.presencas, 1);
  assert.equal(result.report.meses.length, 1);
  assert.equal(result.report.meses[0].mes, '2026-08');
  assert.equal(result.report.meses[0].mes_nome, 'Agosto 2026');
  assert.equal(result.report.meses[0].presencas, 1);
  assert.equal(result.report.meses[0].percentual_presenca, 100);
  assert.equal(requestedUrls.length, 2);
});



test('Relatório do Aluno gera a linha mensal a partir do resumo quando o período é de um único mês e o fallback não encontra linhas', async () => {
  const requestedUrls = [];

  const service = loadService(async (url) => {
    requestedUrls.push(String(url));

    if (String(url).includes('/reports/student-report?')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          data: {
            relatorio: 'aluno',
            aluno: {
              id_aluno: 33,
              id_classe: 2,
              nome: 'João Henrik',
              classe: 'Shalon'
            },
            periodo: {
              startDate: '2026-08-04',
              endDate: '2026-08-11'
            },
            resumo: {
              total_chamadas: 1,
              presencas: 1,
              atrasos: 0,
              ausencias: 0,
              percentual_presenca: 100
            },
            meses: []
          }
        })
      };
    }

    return {
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        data: {
          dailyPages: []
        }
      })
    };
  });

  const result = await service.fetchStudentReport({
    studentId: 33,
    studentName: 'João Henrik',
    classId: 2,
    startDate: '2026-08-04',
    endDate: '2026-08-11',
    token: 'token-de-teste'
  });

  assert.equal(result.found, true);
  assert.equal(result.report.meses.length, 1);
  assert.equal(result.report.meses[0].mes, '2026-08');
  assert.equal(result.report.meses[0].mes_nome, 'Agosto 2026');
  assert.equal(result.report.meses[0].total_chamadas, 1);
  assert.equal(result.report.meses[0].presencas, 1);
  assert.equal(result.report.meses[0].percentual_presenca, 100);
  assert.equal(requestedUrls.length, 2);
});

test('Relatório do Aluno mantém meses sem chamadas quando o fallback reconstrói uma série de vários meses', async () => {
  const service = loadService(async (url) => {
    if (String(url).includes('/reports/student-report?')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          data: {
            relatorio: 'aluno',
            aluno: { id_aluno: 7, nome: 'Maria da Silva', classe: 'Turma A', id_classe: 3 },
            periodo: { startDate: '2026-07-01', endDate: '2026-08-31' },
            resumo: { total_chamadas: 1, presencas: 1, atrasos: 0, ausencias: 0, percentual_presenca: 100 },
            meses: []
          }
        })
      };
    }

    return {
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        data: {
          rows: [
            { id_aluno: 7, id_classe: 3, nome: 'Maria da Silva', classe: 'Turma A', data_chamada: '2026-08-02', status_presenca: 'presente' }
          ]
        }
      })
    };
  });

  const result = await service.fetchStudentReport({
    studentId: 7,
    studentName: 'Maria da Silva',
    classId: 3,
    startDate: '2026-07-01',
    endDate: '2026-08-31',
    token: 'token-de-teste'
  });

  assert.equal(result.report.meses.length, 2);
  assert.equal(result.report.meses[0].mes, '2026-07');
  assert.equal(result.report.meses[0].total_chamadas, 0);
  assert.equal(result.report.meses[1].mes, '2026-08');
  assert.equal(result.report.meses[1].presencas, 1);
});

test('Relatório do Aluno usa fallback do detalhamento de presenças quando o endpoint individual falha', async () => {
  const requestedUrls = [];

  const service = loadService(async (url) => {
    requestedUrls.push(String(url));

    if (String(url).includes('/reports/student-report?')) {
      return {
        ok: false,
        status: 500,
        json: async () => ({
          message: 'O servidor encontrou um problema. Tente novamente em instantes.'
        })
      };
    }

    assert.match(String(url), /\/reports\/period\/pdf\?/);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        data: {
          rows: [
            {
              id_aluno: 7,
              id_classe: 3,
              nome: 'Maria da Silva',
              classe: 'Turma A',
              data_chamada: '2026-07-05',
              status_presenca: 'presente'
            },
            {
              id_aluno: 7,
              id_classe: 3,
              nome: 'Maria da Silva',
              classe: 'Turma A',
              data_chamada: '2026-07-12',
              status_presenca: 'atrasado'
            },
            {
              id_aluno: 7,
              id_classe: 3,
              nome: 'Maria da Silva',
              classe: 'Turma A',
              data_chamada: '2026-08-02',
              status_presenca: 'ausente'
            }
          ]
        }
      })
    };
  });

  const result = await service.fetchStudentReport({
    studentId: 7,
    studentName: 'Maria da Silva',
    classId: 3,
    startDate: '2026-07-01',
    endDate: '2026-08-10',
    token: 'token-de-teste'
  });

  assert.equal(result.found, true);
  assert.equal(result.report.aluno.nome, 'Maria da Silva');
  assert.equal(result.report.resumo.total_chamadas, 3);
  assert.equal(result.report.resumo.presencas, 2);
  assert.equal(result.report.resumo.atrasos, 1);
  assert.equal(result.report.resumo.ausencias, 1);
  assert.equal(result.report.resumo.percentual_presenca, (2 / 3) * 100);
  assert.equal(result.report.meses.length, 2);
  assert.equal(result.report.meses[0].mes, '2026-07');
  assert.equal(result.report.meses[0].presencas, 2);
  assert.equal(result.report.meses[1].mes, '2026-08');
  assert.equal(result.report.meses[1].ausencias, 1);
  assert.equal(requestedUrls.length, 2);
});

test('Relatório do Aluno usa os dados do período para corrigir resumo e frequência mensal quando a resposta individual vem incompleta', async () => {
  const requestedUrls = [];

  const service = loadService(async (url) => {
    requestedUrls.push(String(url));

    if (String(url).includes('/reports/student-report?')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          data: {
            relatorio: 'aluno',
            aluno: {
              id_aluno: 78,
              nome: 'Aux André',
              classe: 'Filhos de Sião'
            },
            periodo: {
              startDate: '2026-07-02',
              endDate: '2026-08-11'
            },
            resumo: {
              total_chamadas: 1,
              presencas: 0,
              atrasos: 0,
              ausencias: 1,
              percentual_presenca: 0
            },
            meses: []
          }
        })
      };
    }

    assert.match(String(url), /\/reports\/period\/pdf\?/);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        data: {
          rows: [
            {
              id_aluno: 78,
              id_classe: 5,
              nome: 'Aux André',
              classe: 'Filhos de Sião',
              data_chamada: '2026-08-09',
              status_presenca: 'presente'
            }
          ]
        }
      })
    };
  });

  const result = await service.fetchStudentReport({
    studentId: 78,
    studentName: 'Aux André',
    classId: 5,
    startDate: '2026-07-02',
    endDate: '2026-08-11',
    token: 'token-de-teste'
  });

  assert.equal(result.found, true);
  assert.equal(result.report.resumo.total_chamadas, 1);
  assert.equal(result.report.resumo.presencas, 1);
  assert.equal(result.report.resumo.ausencias, 0);
  assert.equal(result.report.resumo.percentual_presenca, 100);
  assert.equal(result.report.meses.length, 2);
  assert.equal(result.report.meses[0].mes, '2026-07');
  assert.equal(result.report.meses[0].total_chamadas, 0);
  assert.equal(result.report.meses[1].mes, '2026-08');
  assert.equal(result.report.meses[1].presencas, 1);
  assert.equal(result.report.meses[1].percentual_presenca, 100);
  assert.equal(requestedUrls.length, 2);
});
