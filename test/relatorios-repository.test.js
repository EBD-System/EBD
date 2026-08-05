'use strict';

process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');

const { freshRequire } = require('./helpers');

function buildRepository(stubs = {}) {
  const calls = [];
  const repository = freshRequire(
    'src/modules/relatorios/repository.js',
    {
      'src/db/index.js': {
        query: async (sql, params) => {
          calls.push({ sql, params });
          return stubs.query ? stubs.query(sql, params, calls.length) : { rows: [] };
        }
      }
    }
  );

  return { repository, calls };
}

test('repositório de relatórios consolida matriculados a partir de todas as linhas da chamada', async () => {
  const { repository, calls } = buildRepository({
    query: async (_sql, _params, callNumber) => {
      if (callNumber === 1) {
        return {
          rows: [
            {
              total_records: 1,
              classes: 1,
              presences: 1,
              visitors: 0,
              biblias: 0,
              revistas: 0,
              offerings: 0
            }
          ]
        };
      }

      return {
        rows: [
          {
            date: '2026-08-05',
            title: 'Crianças Maiores',
            description: 'Presentes: 1 | Atrasados: 0 | Ausentes: 4 | Visitantes: 0',
            value: 0,
            id_chamada: 6,
            id_classe: 2,
            presentes: 1,
            atrasados: 0,
            ausentes: 4,
            total_alunos: 5,
            visitantes: 0,
            biblias: 0,
            revistas: 0
          }
        ]
      };
    }
  });

  const result = await repository.getPeriodReport('2026-08-05', '2026-08-05', 1);

  assert.equal(calls.length, 2);
  assert.match(calls[0].sql, /INNER JOIN public\.ebd_chamada_aluno ca/);
  assert.match(calls[0].sql, /INNER JOIN public\.ebd_aluno a/);
  assert.match(calls[1].sql, /COUNT\(\*\)::bigint AS total_alunos/);
  assert.doesNotMatch(
    calls[1].sql,
    /COUNT\(\*\) FILTER \(WHERE ca\.status IN \('presente', 'atrasado'\)\)::bigint AS total_alunos/
  );
  assert.deepEqual(result.summary, {
    total_records: 1,
    classes: 1,
    presences: 1,
    visitors: 0,
    biblias: 0,
    revistas: 0,
    offerings: 0
  });
  assert.equal(result.activities[0].total_alunos, 5);
});
