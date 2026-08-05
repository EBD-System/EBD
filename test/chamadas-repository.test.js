'use strict';

process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');

const { HttpError } = require('../src/utils/httpError');
const { todayISO } = require('../src/utils/date');
const { freshRequire } = require('./helpers');

function buildRepository(stubs = {}) {
  return freshRequire(
    'src/modules/chamadas/repository.js',
    {
      'src/db/index.js': {
        query: stubs.query || (async () => ({ rows: [] })),
        withTransaction:
          stubs.withTransaction ||
          (async (work) =>
            work({
              query: stubs.clientQuery || (async () => ({ rows: [] }))
            }))
      }
    }
  );
}

test('repositório de chamadas normaliza data_chamada antes de bloquear mutações', async (t) => {
  await t.test('permite alterar presença quando a chamada é do mesmo dia civil', async () => {
    const callDate = todayISO();
    const callDateAsDate = new Date(`${callDate}T03:00:00.000Z`);

    const repository = buildRepository({
      query: async (sql) => {
        if (sql.includes('FROM public.ebd_chamada ch')) {
          return {
            rows: [
              {
                id_chamada: 15,
                id_classe: 3,
                data_chamada: callDateAsDate,
                fechada: false,
                status_aluno: 'ativo'
              }
            ]
          };
        }

        if (sql.includes('FROM public.ebd_classe c')) {
          return { rows: [{ id_classe: 3, ativo: true }] };
        }

        return { rows: [] };
      },
      clientQuery: async (sql) => {
        if (sql.includes('FROM public.ebd_chamada ch')) {
          return {
            rows: [
              {
                id_chamada: 15,
                id_classe: 3,
                data_chamada: callDateAsDate,
                fechada: false,
                status_aluno: 'ativo'
              }
            ]
          };
        }
        if (sql.includes('FROM public.ebd_chamada_aluno ca')) {
          return {
            rows: [
              {
                id_chamada_aluno: 31,
                status_atual: 'ausente',
                observacao_atual: '',
                id_chamada: 15,
                id_classe: 3,
                data_chamada: callDateAsDate,
                fechada: false,
                status_aluno: 'ativo'
              }
            ]
          };
        }

        if (sql.includes('UPDATE public.ebd_chamada_aluno')) {
          return {
            rows: [
              {
                id_chamada_aluno: 31,
                status: 'presente',
                observacao: ''
              }
            ]
          };
        }

        return { rows: [] };
      }
    });

    const updated = await repository.updateAttendanceStatus(15, 21, 'presente', '', 7);
    assert.deepEqual(updated, {
      id_chamada_aluno: 31,
      status: 'presente',
      observacao: ''
    });
  });

  await t.test('não exige vínculo ativo para localizar a linha histórica da chamada', async () => {
    const callDate = todayISO();
    const callDateAsDate = new Date(`${callDate}T03:00:00.000Z`);

    const repository = buildRepository({
      query: async (sql) => {
        if (sql.includes('FROM public.ebd_chamada ch')) {
          return {
            rows: [
              {
                id_chamada: 15,
                id_classe: 3,
                data_chamada: callDateAsDate,
                fechada: false,
                status_aluno: 'ativo'
              }
            ]
          };
        }

        if (sql.includes('FROM public.ebd_classe c')) {
          return { rows: [{ id_classe: 3, ativo: true }] };
        }

        return { rows: [] };
      },
      clientQuery: async (sql) => {
        if (sql.includes('FROM public.ebd_chamada ch')) {
          return {
            rows: [
              {
                id_chamada: 15,
                id_classe: 3,
                data_chamada: callDateAsDate,
                fechada: false,
                status_aluno: 'ativo'
              }
            ]
          };
        }
        if (sql.includes('ac.ativo = TRUE')) {
          return { rows: [] };
        }

        if (sql.includes('FROM public.ebd_chamada_aluno ca')) {
          return {
            rows: [
              {
                id_chamada_aluno: 31,
                status_atual: 'ausente',
                observacao_atual: '',
                id_chamada: 15,
                id_classe: 3,
                data_chamada: callDateAsDate,
                fechada: false,
                status_aluno: 'ativo'
              }
            ]
          };
        }

        if (sql.includes('UPDATE public.ebd_chamada_aluno')) {
          return {
            rows: [
              {
                id_chamada_aluno: 31,
                status: 'presente',
                observacao: ''
              }
            ]
          };
        }

        return { rows: [] };
      }
    });

    const updated = await repository.updateAttendanceStatus(15, 21, 'presente', '', 7);
    assert.deepEqual(updated, {
      id_chamada_aluno: 31,
      status: 'presente',
      observacao: ''
    });
  });

  await t.test('permite reabrir chamada quando o registro pertence ao mesmo dia civil', async () => {
    const callDate = todayISO();
    const callDateAsDate = new Date(`${callDate}T03:00:00.000Z`);

    const repository = buildRepository({
      query: async (sql) => {
        if (sql.includes('FROM public.ebd_chamada ch')) {
          return {
            rows: [
              {
                id_chamada: 15,
                id_classe: 3,
                data_chamada: callDateAsDate,
                fechada: true
              }
            ]
          };
        }

        return { rows: [] };
      }
    });

    await assert.doesNotReject(() => repository.reopenAttendance(15, false, 7));
  });

  await t.test('continua bloqueando quando o dia civil é diferente', async () => {
    const pastCallDate = new Date('2026-07-20T03:00:00.000Z');

    const repository = buildRepository({
      query: async (sql) => {
        if (sql.includes('FROM public.ebd_chamada ch')) {
          return {
            rows: [
              {
                id_chamada: 15,
                id_classe: 3,
                data_chamada: pastCallDate,
                fechada: false
              }
            ]
          };
        }

        return { rows: [] };
      },
      clientQuery: async (sql) => {
        if (sql.includes('FROM public.ebd_chamada ch')) {
          return {
            rows: [
              {
                id_chamada: 15,
                id_classe: 3,
                data_chamada: pastCallDate,
                fechada: false,
                status_aluno: 'ativo'
              }
            ]
          };
        }
        if (sql.includes('FROM public.ebd_chamada_aluno ca')) {
          return {
            rows: [
              {
                id_chamada_aluno: 31,
                status_atual: 'ausente',
                observacao_atual: '',
                id_chamada: 15,
                id_classe: 3,
                data_chamada: pastCallDate,
                fechada: false,
                status_aluno: 'ativo'
              }
            ]
          };
        }

        return { rows: [] };
      }
    });

    await assert.rejects(
      () => repository.updateAttendanceStatus(15, 21, 'presente', '', 7),
      (error) => error instanceof HttpError && error.statusCode === 400 && error.stage === 'attendance'
    );
  });


});
