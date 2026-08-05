'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.DATABASE_URL = 'postgres://test';
process.env.CORS_ORIGINS = '';

const test = require('node:test');
const assert = require('node:assert/strict');

const { freshRequire } = require('./helpers');

test('normalização do sexo de pessoa entre API e banco', async (t) => {
  await t.test('util converte aliases da API para armazenamento e volta para a representação da API', async () => {
    const { normalizeSexoForStorage, normalizeSexoForApi, normalizePersonSexo } = freshRequire('src/utils/sexo.js');

    assert.equal(normalizeSexoForStorage('masculino'), 'M');
    assert.equal(normalizeSexoForStorage('feminino'), 'F');
    assert.equal(normalizeSexoForStorage('M'), 'M');
    assert.equal(normalizeSexoForStorage('F'), 'F');
    assert.equal(normalizeSexoForStorage('outro'), 'outro');
    assert.equal(normalizeSexoForStorage('nao_informado'), 'nao_informado');

    assert.equal(normalizeSexoForApi('M'), 'masculino');
    assert.equal(normalizeSexoForApi('F'), 'feminino');
    assert.equal(normalizeSexoForApi('outro'), 'outro');
    assert.equal(normalizeSexoForApi('nao_informado'), 'nao_informado');

    assert.equal(normalizePersonSexo({ sexo: 'M' }).sexo, 'masculino');
    assert.equal(normalizePersonSexo({ sexo: 'F' }).sexo, 'feminino');
  });

  await t.test('people repository grava valores compatíveis com a constraint e devolve a forma da API', async () => {
    const calls = [];
    const peopleRepository = freshRequire(
      'src/modules/pessoas/repository.js',
      {
        'src/db/index.js': {
          query: async (sql, params) => {
            calls.push({ sql, params });
            if (calls.length === 1) {
              return { rows: [{ exists: true }] };
            }
            return {
              rows: [
                {
                  id_pessoa: 10,
                  nome: 'Ana',
                  sexo: 'F',
                  cpf: '00000000000',
                  data_nascimento: null,
                  telefone: '',
                  email: '',
                  logradouro: '',
                  numero: '',
                  bairro: '',
                  cidade: '',
                  uf: '',
                  cep: '',
                  observacao: ''
                }
              ]
            };
          }
        }
      }
    );

    const created = await peopleRepository.createPerson({
      idCadastro: 7,
      nome: 'Ana',
      sexo: 'feminino'
    });

    assert.equal(calls[1].params[2], 'F');
    assert.equal(calls[1].params[5], '');
    assert.equal(created.sexo, 'feminino');

    calls.length = 0;
    const updatedRepo = freshRequire(
      'src/modules/pessoas/repository.js',
      {
        'src/db/index.js': {
          query: async (sql, params) => {
            calls.push({ sql, params });
            if (calls.length === 1) {
              return { rows: [{ exists: true }] };
            }
            return {
              rows: [
                {
                  id_pessoa: 10,
                  nome: 'Ana',
                  sexo: 'M'
                }
              ]
            };
          }
        }
      }
    );

    const updated = await updatedRepo.updatePerson(10, {
      idCadastro: 7,
      sexo: 'masculino',
      telefone: '(11) 91234-5678'
    });

    assert.equal(calls[1].params[2], 'M');
    assert.equal(calls[1].params[5], '11912345678');
    assert.equal(updated.sexo, 'masculino');
  });


  await t.test('students repository devolve sexo na forma textual da API para a edição', async () => {
    const calls = [];
    const studentsRepository = freshRequire(
      'src/modules/alunos/repository.js',
      {
        'src/db/index.js': {
          query: async (sql, params) => {
            calls.push({ sql, params });
            return {
              rows: [
                {
                  id_aluno: 41,
                  id_pessoa: 9,
                  nome: 'Joana',
                  sexo: 'F',
                  cpf: '',
                  data_nascimento: null,
                  telefone: '',
                  email: '',
                  logradouro: '',
                  numero: '',
                  bairro: '',
                  cidade: '',
                  uf: '',
                  cep: '',
                  matricula: 'ALU0041',
                  status: 'ativo',
                  data_cadastro: '2026-08-03',
                  data_desligamento: null,
                  motivo_desligamento: '',
                  inactive_reason: '',
                  observacao: '',
                  id_aluno_classe: 77,
                  id_classe: 5,
                  classe: 'Senhores',
                  data_inicio: '2026-08-03',
                  data_fim: null,
                  motivo: '',
                  ativo_classe: true
                }
              ]
            };
          }
        }
      }
    );

    const listed = await studentsRepository.listStudents({ idCadastro: 7 });
    assert.equal(calls.length, 1);
    assert.equal(listed[0].sexo, 'feminino');

    const found = await studentsRepository.getStudentById(41, 7);
    assert.equal(calls.length, 2);
    assert.equal(found.sexo, 'feminino');
  });

  await t.test('auth repository também grava o sexo canônico no banco', async () => {
    const calls = [];
    const authRepository = freshRequire(
      'src/modules/auth/repository.js',
      {
        'src/db/index.js': {
          query: async () => ({ rows: [] })
        }
      }
    );

    const client = {
      query: async (sql, params) => {
        calls.push({ sql, params });
        if (calls.length === 1) {
          return { rows: [{ exists: true }] };
        }
        return {
          rows: [
            {
              id_pessoa: 99,
              nome: 'Beatriz',
              sexo: 'F'
            }
          ]
        };
      }
    };

    const person = await authRepository.createPerson(client, {
      idCadastro: 8,
      nome: 'Beatriz',
      sexo: 'feminino',
      telefone: '(11) 98888-0000'
    });

    assert.equal(calls[1].params[2], 'F');
    assert.equal(calls[1].params[5], '11988880000');
    assert.equal(person.sexo, 'feminino');
  });
});
