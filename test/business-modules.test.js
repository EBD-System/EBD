'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.DATABASE_URL = 'postgres://test';
process.env.CORS_ORIGINS = '';

const test = require('node:test');
const assert = require('node:assert/strict');

const { HttpError } = require('../src/utils/httpError');
const { todayISO } = require('../src/utils/date');
const { freshRequire, createNoopLogger } = require('./helpers');

function buildSource(overrides = {}) {
  return {
    user: { id_cadastro: 7, profiles: ['Administrador'] },
    requestId: 'req-modulos',
    log: createNoopLogger(),
    ...overrides
  };
}

function buildPeopleService(repoOverrides = {}) {
  return freshRequire(
    'src/modules/pessoas/service.js',
    {
      'src/modules/pessoas/repository.js': {
        listPeople: async () => [],
        getPersonById: async () => null,
        createPerson: async () => null,
        updatePerson: async () => null,
        ...repoOverrides
      }
    },
    {
      dotenv: {
        config() {
          return { parsed: process.env };
        }
      }
    }
  );
}

function buildClassesService(repoOverrides = {}) {
  return freshRequire(
    'src/modules/classes/service.js',
    {
      'src/modules/classes/repository.js': {
        listClasses: async () => [],
        getClassById: async () => null,
        getClassStudents: async () => [],
        getClassAttendance: async () => [],
        ...repoOverrides
      }
    },
    {
      dotenv: {
        config() {
          return { parsed: process.env };
        }
      }
    }
  );
}

function buildStudentsService(repoOverrides = {}, deps = {}) {
  return freshRequire(
    'src/modules/alunos/service.js',
    {
      'src/modules/pessoas/repository.js': {
        getPersonById: async () => null,
        ...(deps.peopleRepo || {})
      },
      'src/modules/classes/repository.js': {
        getClassById: async () => null,
        ...(deps.classesRepo || {})
      },
      'src/modules/alunos/repository.js': {
        listStudents: async () => [],
        getStudentById: async () => null,
        matriculateStudent: async () => null,
        activateStudent: async () => true,
        inactivateStudent: async () => true,
        updateStudentObservation: async () => null,
        transferStudent: async () => null,
        getStudentHistory: async () => [],
        getStudentStatusHistory: async () => [],
        getStudentClasses: async () => [],
        getInactiveReasonsByStudentIds: async () => [],
        ...repoOverrides
      }
    },
    {
      dotenv: {
        config() {
          return { parsed: process.env };
        }
      }
    }
  );
}

function buildAttendanceService(repoOverrides = {}, deps = {}) {
  return freshRequire(
    'src/modules/chamadas/service.js',
    {
      'src/modules/classes/repository.js': {
        getClassById: async () => null,
        ...(deps.classesRepo || {})
      },
      'src/modules/chamadas/repository.js': {
        openAttendance: async () => null,
        getAttendanceByClassAndDate: async () => [],
        updateAttendanceStatus: async () => null,
        updateAttendanceStatuses: async () => null,
        markAllPresent: async () => null,
        markAllAbsent: async () => null,
        closeAttendance: async () => null,
        reopenAttendance: async () => null,
        registerVisitor: async () => null,
        registerOffer: async () => null,
        saveCallSummary: async () => null,
        getCallSummary: async () => [],
        getClassSummary: async () => [],
        ...repoOverrides
      }
    },
    {
      dotenv: {
        config() {
          return { parsed: process.env };
        }
      }
    }
  );
}

function buildReportsService(repoOverrides = {}) {
  return freshRequire(
    'src/modules/relatorios/service.js',
    {
      'src/modules/relatorios/repository.js': {
        getPresenceRanking: async () => [],
        getVisitorRanking: async () => [],
        getOfferRanking: async () => [],
        getBirthdays: async () => [],
        getPeriodReport: async () => ({ summary: {}, activities: [] }),
        ...repoOverrides
      }
    },
    {
      dotenv: {
        config() {
          return { parsed: process.env };
        }
      }
    }
  );
}

test('integração dos módulos de negócio', async (t) => {
  await t.test('pessoas preserva CRUD, validações e tenant', async () => {
    const calls = { batch: null };
    const peopleService = buildPeopleService({
      listPeople: async (args) => {
        calls.list = args;
        return [
          { id_pessoa: 11, id_cadastro: 7, nome: 'Ana', possui_usuario: true },
          { id_pessoa: 12, id_cadastro: 7, nome: 'Bia', possui_usuario: false }
        ];
      },
      getPersonById: async (idPessoa, idCadastro) => {
        calls.get = { idPessoa, idCadastro };
        if (idPessoa === 11 && idCadastro === 7) {
          return { id_pessoa: 11, id_cadastro: 7, nome: 'Ana' };
        }
        return null;
      },
      createPerson: async (payload) => {
        calls.create = payload;
        return { id_pessoa: 31, ...payload };
      },
      updatePerson: async (idPessoa, payload) => {
        calls.update = { idPessoa, payload };
        return idPessoa === 11 ? { id_pessoa: 11, ...payload } : null;
      }
    });

    const list = await peopleService.list({ query: { page: '2', limit: '500', search: 'ana' }, user: { id_cadastro: 7 } });
    assert.equal(calls.list.idCadastro, 7);
    assert.equal(calls.list.limit, 200);
    assert.equal(calls.list.offset, 200);
    assert.equal(calls.list.search, 'ana');
    assert.equal(list.length, 2);

    const person = await peopleService.get(11, { user: { id_cadastro: 7 } });
    assert.equal(calls.get.idCadastro, 7);
    assert.equal(person.nome, 'Ana');

    await assert.rejects(
      () => peopleService.get(11, { user: { id_cadastro: 8 } }),
      (error) => error instanceof HttpError && error.statusCode === 404 && error.stage === 'people'
    );

    await assert.rejects(
      () => peopleService.create({ email: 'sem-nome@exemplo.com' }, { user: { id_cadastro: 7 } }),
      (error) => error instanceof HttpError && error.statusCode === 400 && error.stage === 'people'
    );

    const created = await peopleService.create(
      {
        nome: 'Maria',
        email: 'maria@example.com',
        cpf: '00000000000'
      },
      buildSource()
    );
    assert.equal(calls.create.idCadastro, 7);
    assert.equal(created.id_pessoa, 31);

    const updated = await peopleService.update(
      11,
      { nome: 'Ana Silva', email: 'ana.silva@example.com' },
      buildSource()
    );
    assert.equal(calls.update.payload.idCadastro, 7);
    assert.equal(updated.nome, 'Ana Silva');

    await assert.rejects(
      () => peopleService.update(99, { nome: 'Inexistente' }, buildSource()),
      (error) => error instanceof HttpError && error.statusCode === 404 && error.stage === 'people'
    );

    await assert.rejects(
      () => peopleService.list({ query: {}, user: {} }),
      (error) => error instanceof HttpError && error.statusCode === 400 && error.stage === 'people'
    );
  });

  await t.test('atualiza a observação do aluno no registro correto', async () => {
    const captured = {};

    const studentsService = buildStudentsService({
      getStudentById: async (idAluno, idCadastro) => (
        idAluno === 41 && idCadastro === 7
          ? { id_aluno: 41, id_pessoa: 11, observacao: 'antiga' }
          : null
      ),
      updateStudentObservation: async (idAluno, observacao, idCadastro) => {
        captured.update = { idAluno, observacao, idCadastro };
        return { id_aluno: idAluno, observacao, id_cadastro: idCadastro };
      }
    }, {
      peopleRepo: {
        getPersonById: async (idPessoa, idCadastro) => (
          idPessoa === 11 && idCadastro === 7 ? { id_pessoa: 11, nome: 'Maria' } : null
        )
      },
      classesRepo: {
        getClassById: async () => null
      }
    });

    const result = await studentsService.updateObservation(
      41,
      'nova observação',
      buildSource()
    );

    assert.deepEqual(captured.update, { idAluno: 41, observacao: 'nova observação', idCadastro: 7 });
    assert.deepEqual(result, { id_aluno: 41, observacao: 'nova observação', id_cadastro: 7 });
  });

  await t.test('classes aplica isolamento por tenant e respeita ausência de dados', async () => {
    const calls = {};
    const classesService = buildClassesService({
      listClasses: async (idCadastro, dateChamada) => {
        calls.list = { idCadastro, dateChamada };
        return [
          {
            id_classe: 1,
            id_cadastro: 7,
            nome: 'Turma A',
            ativo: true,
            total_alunos_ativos: '8',
            chamada_ja_feita: true,
            id_chamada: 15,
            chamada_fechada: false
          }
        ];
      },
      getClassById: async (idClasse, idCadastro) => {
        calls.get = { idClasse, idCadastro };
        return idClasse === 1 && idCadastro === 7
          ? { id_classe: 1, id_cadastro: 7, nome: 'Turma A', ativo: true }
          : null;
      },
      getClassStudents: async (idClasse, idCadastro) => {
        calls.students = { idClasse, idCadastro };
        return idClasse === 1 && idCadastro === 7
          ? [{ id_aluno: 21, id_pessoa: 31, nome: 'Maria', status: 'ativo' }]
          : [];
      },
      getClassAttendance: async (idClasse, date, idCadastro) => {
        calls.attendance = { idClasse, date, idCadastro };
        return idClasse === 1 && idCadastro === 7
          ? [{ id_chamada: 50, classe: 'Turma A', data_chamada: date, presentes: 1 }]
          : [];
      }
    });

    const classes = await classesService.list({ ...buildSource(), query: { date: '2026-07-21' } });
    assert.deepEqual(calls.list, { idCadastro: 7, dateChamada: '2026-07-21' });
    assert.equal(classes[0].nome, 'Turma A');
    assert.equal(classes[0].chamada_ja_feita, true);

    const classRow = await classesService.get(1, buildSource());
    assert.deepEqual(calls.get, { idClasse: 1, idCadastro: 7 });
    assert.equal(classRow.ativo, true);

    await assert.rejects(
      () => classesService.get(1, { user: { id_cadastro: 8 } }),
      (error) => error instanceof HttpError && error.statusCode === 404 && error.stage === 'classes'
    );

    const students = await classesService.students(1, buildSource());
    assert.deepEqual(calls.students, { idClasse: 1, idCadastro: 7 });
    assert.equal(students[0].nome, 'Maria');

    const attendance = await classesService.attendance(1, '2026-07-17', buildSource());
    assert.deepEqual(calls.attendance, { idClasse: 1, date: '2026-07-17', idCadastro: 7 });
    assert.equal(attendance[0].id_chamada, 50);

    const emptyStudents = await classesService.students(2, buildSource());
    assert.deepEqual(emptyStudents, []);

    const emptyAttendance = await classesService.attendance(2, '2026-07-17', buildSource());
    assert.deepEqual(emptyAttendance, []);
  });

  await t.test('alunos cobre matrícula, duplicidade e regras de status', async () => {
    const calls = {};
    const studentsService = buildStudentsService({
      listStudents: async (args) => {
        calls.list = args;
        return [
          { id_aluno: 41, id_cadastro: 7, nome: 'Joana', status: 'ativo' },
          { id_aluno: 42, id_cadastro: 7, nome: 'Lia', status: 'inativo' }
        ];
      },
      getStudentById: async (idAluno, idCadastro) => {
        calls.get = { idAluno, idCadastro };
        if (idAluno === 41 && idCadastro === 7) {
          return { id_aluno: 41, id_cadastro: 7, nome: 'Joana', status: 'ativo', id_aluno_classe: 301, id_classe: 22 };
        }
        if (idAluno === 99 && idCadastro === 7) {
          return {
            id_aluno: 99,
            id_cadastro: 7,
            id_pessoa: 11,
            nome: 'Maria',
            status: 'ativo',
            matricula: '2026-001',
            id_aluno_classe: 902,
            id_classe: 22,
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
        calls.enroll = payload;
        if (payload.idPessoa === 11 && payload.idClasse === 22 && payload.idCadastro === 7) {
          return 99;
        }
        return null;
      },
      activateStudent: async (idAluno, observacao, idCadastro) => {
        calls.activate = { idAluno, observacao, idCadastro };
        return idAluno === 41 && idCadastro === 7;
      },
      inactivateStudent: async (idAluno, motivo, observacao, idCadastro) => {
        calls.inactivate = { idAluno, motivo, observacao, idCadastro };
        return idAluno === 41 && idCadastro === 7;
      },
      updateStudentObservation: async (idAluno, observacao, idCadastro) => {
        calls.updateObservation = { idAluno, observacao, idCadastro };
        return { id_aluno: idAluno, observacao, id_cadastro: idCadastro };
      },
      transferStudent: async (payload) => {
        calls.transfer = payload;
        return payload.idAluno === 41 && payload.idClasseDestino === 24 && payload.idCadastro === 7 ? 555 : null;
      },
      getStudentHistory: async (idAluno) => {
        calls.history = idAluno;
        return [{ tipo: 'matricula', id_aluno: idAluno }];
      },
      getStudentStatusHistory: async (idAluno) => {
        calls.statusHistory = idAluno;
        return [{ status: 'ativo', id_aluno: idAluno }];
      },
      getStudentClasses: async (idAluno, idCadastro) => {
        calls.classes = { idAluno, idCadastro };
        return [{ id_classe: 22, classe: 'Turma A' }];
      },
      getInactiveReasonsByStudentIds: async (payload) => {
        calls.inactiveReasons = payload;
        return payload.ids.map((id) => ({
          id_aluno: id,
          nome: `Aluno ${id}`,
          status: 'inativo',
          data_desligamento: '2026-07-17',
          motivo_desligamento: `Motivo ${id}`,
          inactive_reason: `Motivo ${id}`
        }));
      }
    }, {
      peopleRepo: {
        getPersonById: async (idPessoa, idCadastro) => (
          idPessoa === 11 && idCadastro === 7 ? { id_pessoa: 11, nome: 'Maria' } : null
        )
      },
      classesRepo: {
        getClassById: async (idClasse, idCadastro) => {
          if (idClasse === 22 && idCadastro === 7) {
            return { id_classe: 22, nome: 'Turma A', ativo: true };
          }
          if (idClasse === 23 && idCadastro === 7) {
            return { id_classe: 23, nome: 'Turma Inativa', ativo: false };
          }
          if (idClasse === 24 && idCadastro === 7) {
            return { id_classe: 24, nome: 'Turma B', ativo: true };
          }
          return null;
        }
      }
    });

    const list = await studentsService.list({ query: { classId: '22', status: 'ativo', inactive: 'true' }, user: { id_cadastro: 7 } });
    assert.deepEqual(calls.list, { idCadastro: 7, classId: 22, status: 'ativo', inactive: true });
    assert.equal(list.length, 2);

    const inactiveReasons = await studentsService.inactiveReasons([41, '42', 0, 'abc'], buildSource());
    assert.deepEqual(calls.inactiveReasons, { idCadastro: 7, ids: [41, 42] });
    assert.deepEqual(inactiveReasons, [
      {
        id_aluno: 41,
        nome: 'Aluno 41',
        status: 'inativo',
        data_desligamento: '2026-07-17',
        motivo_desligamento: 'Motivo 41',
        inactive_reason: 'Motivo 41'
      },
      {
        id_aluno: 42,
        nome: 'Aluno 42',
        status: 'inativo',
        data_desligamento: '2026-07-17',
        motivo_desligamento: 'Motivo 42',
        inactive_reason: 'Motivo 42'
      }
    ]);

    await assert.rejects(
      () => studentsService.inactiveReasons([], buildSource()),
      (error) => error instanceof HttpError && error.statusCode === 400 && error.stage === 'students'
    );

    const enrolled = await studentsService.enroll(
      { idPessoa: 11, idClasse: 22, matricula: '2026-001', dataInicio: '2026-07-17', observacao: 'primeira matrícula' },
      buildSource()
    );
    assert.equal(calls.enroll.idCadastro, 7);
    assert.equal(calls.enroll.idPessoa, 11);
    assert.equal(calls.enroll.idClasse, 22);
    assert.deepEqual(enrolled, {
      id_aluno: 99,
      id_cadastro: 7,
      id_pessoa: 11,
      nome: 'Maria',
      status: 'ativo',
      matricula: '2026-001',
      id_aluno_classe: 902,
      id_classe: 22,
      classe: 'Turma A',
      data_inicio: '2026-07-17',
      data_fim: null,
      ativo_classe: true,
      observacao: 'primeira matrícula'
    });

    await assert.rejects(
      () => studentsService.enroll({ idPessoa: 11, idClasse: 23 }, buildSource()),
      (error) => error instanceof HttpError && error.statusCode === 400 && error.stage === 'students'
    );

    const duplicateStudentsService = buildStudentsService(
      {
        matriculateStudent: async () => {
          throw new HttpError(409, 'A pessoa já está matriculada como aluno.', 'students');
        }
      },
      {
        peopleRepo: {
          getPersonById: async (idPessoa, idCadastro) => (
            idPessoa === 11 && idCadastro === 7 ? { id_pessoa: 11, nome: 'Maria' } : null
          )
        },
        classesRepo: {
          getClassById: async (idClasse, idCadastro) => (
            idClasse === 22 && idCadastro === 7
              ? { id_classe: 22, nome: 'Turma A', ativo: true }
              : null
          )
        }
      }
    );

    await assert.rejects(
      () => duplicateStudentsService.enroll({ idPessoa: 11, idClasse: 22 }, buildSource()),
      (error) => error instanceof HttpError && error.statusCode === 409 && error.stage === 'students'
    );

    const activated = await studentsService.activate(41, 'reativado', buildSource());
    assert.deepEqual(calls.activate, { idAluno: 41, observacao: 'reativado', idCadastro: 7 });
    assert.deepEqual(activated, { id_aluno: 41, status: 'ativo' });

    await assert.rejects(
      () => studentsService.inactivate(41, '', 'observação', buildSource()),
      (error) => error instanceof HttpError && error.statusCode === 400 && error.stage === 'students'
    );

    const inactivated = await studentsService.inactivate(41, 'transferência', 'saída registrada', buildSource());
    assert.deepEqual(calls.inactivate, { idAluno: 41, motivo: 'transferência', observacao: 'saída registrada', idCadastro: 7 });
    assert.deepEqual(inactivated, { id_aluno: 41, status: 'inativo' });

    const transferred = await studentsService.transfer(
      41,
      { idClasseDestino: 24, dataInicio: '2026-07-18', motivo: 'Mudança de turma', observacao: 'registro oficial' },
      buildSource()
    );
    assert.deepEqual(calls.transfer, {
      idAluno: 41,
      idClasseDestino: 24,
      dataInicio: '2026-07-18',
      motivo: 'Mudança de turma',
      observacao: 'registro oficial',
      idCadastro: 7
    });
    assert.deepEqual(transferred, {
      id_aluno: 41,
      id_aluno_classe: 555,
      id_classe_origem: 22,
      id_classe_destino: 24,
      data_inicio: '2026-07-18'
    });

    await assert.rejects(
      () => studentsService.transfer(41, { idClasseDestino: 22 }, buildSource()),
      (error) => error instanceof HttpError && error.statusCode === 400 && error.stage === 'students'
    );

    const history = await studentsService.history(41, buildSource());
    const statusHistory = await studentsService.statusHistory(41, buildSource());
    const classes = await studentsService.classes(41, buildSource());

    assert.equal(calls.history, 41);
    assert.equal(calls.statusHistory, 41);
    assert.deepEqual(calls.classes, { idAluno: 41, idCadastro: 7 });
    assert.equal(history[0].tipo, 'matricula');
    assert.equal(statusHistory[0].status, 'ativo');
    assert.equal(classes[0].id_classe, 22);

    await assert.rejects(
      () => studentsService.get(41, { user: { id_cadastro: 8 } }),
      (error) => error instanceof HttpError && error.statusCode === 404 && error.stage === 'students'
    );
  });

  await t.test('chamada cobre abertura, presença, visitantes, oferta e bloqueios', async () => {
    const calls = {};
    const attendanceService = buildAttendanceService({
      openAttendance: async (classId, date, idCadastro) => {
        calls.open = { classId, date, idCadastro };
        return 501;
      },
      getAttendanceByClassAndDate: async (classId, date, idCadastro) => {
        calls.detail = { classId, date, idCadastro };
        return classId === 33 && idCadastro === 7 ? [{ id_chamada: 501, classe: 'Turma A', data_chamada: date }] : [];
      },
      updateAttendanceStatus: async (callId, studentClassId, status, observation, idCadastro) => {
        calls.change = { callId, studentClassId, status, observation, idCadastro };
        return { id_chamada_aluno: 900, status, observacao: observation };
      },
      updateAttendanceStatuses: async (callId, students, idCadastro) => {
        calls.batch = { callId, students, idCadastro };
        return students.map((student, index) => ({
          id_chamada_aluno: 1000 + index,
          status: student.status,
          observacao: student.observacao
        }));
      },
      markAllPresent: async (callId, idCadastro) => {
        calls.presentAll = { callId, idCadastro };
      },
      markAllAbsent: async (callId, idCadastro) => {
        calls.absentAll = { callId, idCadastro };
      },
      closeAttendance: async (callId, idCadastro) => {
        calls.close = { callId, idCadastro };
      },
      reopenAttendance: async (callId, isAdmin, idCadastro) => {
        calls.reopen = { callId, isAdmin, idCadastro };
        if (idCadastro !== 7) {
          throw new HttpError(404, 'Chamada não encontrada.', 'attendance');
        }
      },
      registerVisitor: async (callId, name, observation, idCadastro) => {
        calls.visitor = { callId, name, observation, idCadastro };
        return 77;
      },
      registerOffer: async (callId, value, idCadastro) => {
        calls.offer = { callId, value, idCadastro };
        return value;
      },
      saveCallSummary: async (callId, summary, idCadastro) => {
        calls.saveSummary = { callId, summary, idCadastro };
        return {
          id_chamada: callId,
          oferta: Number(summary.oferta || 0),
          visitantes: Number(summary.visitantes || 0),
          biblias: Number(summary.biblias || 0),
          revistas: Number(summary.revistas || 0)
        };
      },
      getCallSummary: async (date, idCadastro) => {
        calls.summary = { date, idCadastro };
        return [];
      },
      getClassSummary: async (classId, date, idCadastro) => {
        calls.classSummary = { classId, date, idCadastro };
        return [];
      }
    }, {
      classesRepo: {
        getClassById: async (idClasse, idCadastro) => {
          if (idClasse === 33 && idCadastro === 7) {
            return { id_classe: 33, nome: 'Turma A', ativo: true };
          }
          if (idClasse === 34 && idCadastro === 7) {
            return { id_classe: 34, nome: 'Turma Inativa', ativo: false };
          }
          return null;
        }
      }
    });

    const opened = await attendanceService.open({ classId: 33, date: todayISO(), source: buildSource() });
    assert.deepEqual(calls.open, { classId: 33, date: todayISO(), idCadastro: 7 });
    assert.deepEqual(opened, { id_chamada: 501, data_chamada: todayISO() });

    await assert.rejects(
      () => attendanceService.open({ classId: 34, date: todayISO(), source: buildSource() }),
      (error) => error instanceof HttpError && error.statusCode === 400 && error.stage === 'attendance'
    );

    await assert.rejects(
      () => attendanceService.open({ classId: 33, date: '2026-07-16', source: buildSource() }),
      (error) => error instanceof HttpError && error.statusCode === 403 && error.stage === 'attendance'
    );

    const detail = await attendanceService.getClassAttendance({ classId: 33, date: '2026-07-17', source: buildSource() });
    assert.deepEqual(calls.detail, { classId: 33, date: '2026-07-17', idCadastro: 7 });
    assert.equal(detail.length, 1);

    const changed = await attendanceService.changeStatus({
      callId: 501,
      studentClassId: 700,
      status: 'presente',
      observation: 'pontual',
      source: buildSource()
    });
    assert.deepEqual(calls.change, {
      callId: 501,
      studentClassId: 700,
      status: 'presente',
      observation: 'pontual',
      idCadastro: 7
    });
    assert.deepEqual(changed, {
      id_chamada_aluno: 900,
      status: 'presente',
      observacao: 'pontual'
    });

    const batch = await attendanceService.changeStatusBatch({
      callId: 501,
      students: [
        { studentClassId: 700, status: 'presente', observacao: 'pontual' },
        { studentClassId: 701, status: 'ausente', observacao: 'faltou' }
      ],
      source: buildSource()
    });

    assert.deepEqual(calls.batch, {
      callId: 501,
      students: [
        { studentClassId: 700, status: 'presente', observacao: 'pontual' },
        { studentClassId: 701, status: 'ausente', observacao: 'faltou' }
      ],
      idCadastro: 7
    });
    assert.deepEqual(batch, {
      id_chamada: 501,
      total_alteracoes: 2,
      itens: [
        { id_chamada_aluno: 1000, status: 'presente', observacao: 'pontual' },
        { id_chamada_aluno: 1001, status: 'ausente', observacao: 'faltou' }
      ]
    });

    await assert.rejects(
      () => attendanceService.changeStatus({ callId: 501, studentClassId: 700, status: 'talvez', source: buildSource() }),
      (error) => error instanceof HttpError && error.statusCode === 400 && error.stage === 'attendance'
    );

    await attendanceService.presentAll(501, buildSource());
    await attendanceService.absentAll(501, buildSource());
    await attendanceService.close(501, buildSource());
    await attendanceService.reopen(501, true, buildSource());
    const visitor = await attendanceService.addVisitor(501, { name: 'Visitante', observation: 'acompanhante' }, buildSource());
    const offer = await attendanceService.addOffer(501, { value: '12.50' }, buildSource());
    const savedSummary = await attendanceService.saveSummary(501, {
      oferta: '12.50',
      visitantes: '3',
      biblias: '2',
      revistas: '4'
    }, buildSource());
    const summary = await attendanceService.summary('2026-07-17', buildSource());
    const classSummary = await attendanceService.classSummary(33, '2026-07-17', buildSource());

    assert.deepEqual(calls.presentAll, { callId: 501, idCadastro: 7 });
    assert.deepEqual(calls.absentAll, { callId: 501, idCadastro: 7 });
    assert.deepEqual(calls.close, { callId: 501, idCadastro: 7 });
    assert.deepEqual(calls.reopen, { callId: 501, isAdmin: true, idCadastro: 7 });
    assert.deepEqual(calls.visitor, { callId: 501, name: 'Visitante', observation: 'acompanhante', idCadastro: 7 });
    assert.deepEqual(calls.offer, { callId: 501, value: 12.5, idCadastro: 7 });
    assert.deepEqual(calls.saveSummary, {
      callId: 501,
      summary: {
        oferta: '12.50',
        visitantes: '3',
        biblias: '2',
        revistas: '4'
      },
      idCadastro: 7
    });
    assert.deepEqual(calls.summary, { date: '2026-07-17', idCadastro: 7 });
    assert.deepEqual(calls.classSummary, { classId: 33, date: '2026-07-17', idCadastro: 7 });
    assert.deepEqual(visitor, { id_chamada_visitante: 77 });
    assert.deepEqual(offer, { oferta: 12.5 });
    assert.deepEqual(savedSummary, {
      id_chamada: 501,
      oferta: 12.5,
      visitantes: 3,
      biblias: 2,
      revistas: 4
    });
    assert.deepEqual(summary, []);
    assert.deepEqual(classSummary, []);

    await assert.rejects(
      () => attendanceService.reopen(501, false, buildSource({ user: { id_cadastro: 8 } })),
      (error) => error instanceof HttpError && error.statusCode === 404 && error.stage === 'attendance'
    );
  });

  await t.test('relatórios devolvem envelope estável, períodos e zero itens quando não há dados', async () => {
    const calls = {};
    const reportsService = buildReportsService({
      getPresenceRanking: async (date, idCadastro) => {
        calls.presence = { date, idCadastro };
        return [
          { id_classe: 1, classe: 'Turma A', presentes: 10, percentual_presenca: 100, posicao: 1 }
        ];
      },
      getVisitorRanking: async (date, idCadastro) => {
        calls.visitors = { date, idCadastro };
        return [];
      },
      getOfferRanking: async (date, idCadastro) => {
        calls.offers = { date, idCadastro };
        return [];
      },
      getBirthdays: async (date, idCadastro) => {
        calls.birthdays = { date, idCadastro };
        return [
          { periodo: 'semana_passada', nome: 'Ana', aniversario_no_ano: '2026-07-10' },
          { periodo: 'semana_seguinte', nome: 'Bia', aniversario_no_ano: '2026-07-20' },
          { periodo: 'mes_atual', nome: 'Carla', aniversario_no_ano: '2026-07-25' },
          { periodo: 'trimestre_atual', nome: 'Dora', aniversario_no_ano: '2026-08-02' }
        ];
      },
      getPeriodReport: async (startDate, endDate, idCadastro) => {
        calls.period = { startDate, endDate, idCadastro };
        return {
          summary: {
            total_records: 9,
            classes: 2,
            presences: 24,
            visitors: 7,
            offerings: 42.5
          },
          activities: [
            {
              date: '2026-07-01',
              title: 'Turma A',
              description: 'Presentes: 13 | Atrasados: 1 | Ausentes: 2 | Visitantes: 3',
              value: 42.5,
              id_chamada: 201,
              id_classe: 1,
              presentes: 13,
              atrasados: 1,
              ausentes: 2,
              total_alunos: 16,
              visitantes: 3
            }
          ]
        };
      }
    });

    const presence = await reportsService.presenceRanking('2026-07-17', buildSource());
    const visitors = await reportsService.visitorRanking('2026-07-17', buildSource());
    const offers = await reportsService.offerRanking('2026-07-17', buildSource());
    const birthdays = await reportsService.birthdays('2026-07-17', buildSource());
    const period = await reportsService.periodReport('2026-07-01', '2026-07-17', buildSource());

    assert.deepEqual(calls.presence, { date: '2026-07-17', idCadastro: 7 });
    assert.deepEqual(calls.visitors, { date: '2026-07-17', idCadastro: 7 });
    assert.deepEqual(calls.offers, { date: '2026-07-17', idCadastro: 7 });
    assert.deepEqual(calls.birthdays, { date: '2026-07-17', idCadastro: 7 });
    assert.deepEqual(calls.period, { startDate: '2026-07-01', endDate: '2026-07-17', idCadastro: 7 });

    assert.deepEqual(presence, {
      relatorio: 'presenca',
      id_cadastro: 7,
      data_referencia: '2026-07-17',
      total_itens: 1,
      itens: [
        { id_classe: 1, classe: 'Turma A', presentes: 10, percentual_presenca: 100, posicao: 1 }
      ]
    });

    assert.deepEqual(visitors, {
      relatorio: 'visitantes',
      id_cadastro: 7,
      data_referencia: '2026-07-17',
      total_itens: 0,
      itens: []
    });

    assert.deepEqual(offers, {
      relatorio: 'ofertas',
      id_cadastro: 7,
      data_referencia: '2026-07-17',
      total_itens: 0,
      itens: []
    });

    assert.deepEqual(birthdays, {
      relatorio: 'aniversariantes',
      id_cadastro: 7,
      data_referencia: '2026-07-17',
      total_itens: 4,
      itens: [
        { periodo: 'semana_passada', nome: 'Ana', aniversario_no_ano: '2026-07-10' },
        { periodo: 'semana_seguinte', nome: 'Bia', aniversario_no_ano: '2026-07-20' },
        { periodo: 'mes_atual', nome: 'Carla', aniversario_no_ano: '2026-07-25' },
        { periodo: 'trimestre_atual', nome: 'Dora', aniversario_no_ano: '2026-08-02' }
      ]
    });

    assert.deepEqual(period, {
      relatorio: 'periodo',
      source: 'backend',
      generatedBy: 'ebd-api',
      title: 'Relatório de período',
      subtitle: 'Consolidação entre 2026-07-01 e 2026-07-17.',
      id_cadastro: 7,
      data_referencia: '2026-07-17',
      periodo: {
        startDate: '2026-07-01',
        endDate: '2026-07-17'
      },
      consultedAt: period.consultedAt,
      total_itens: 1,
      summary: {
        totalRecords: 9,
        classes: 2,
        presences: 24,
        visitors: 7,
        biblias: 0,
        revistas: 0,
        offerings: 42.5
      },
      activities: [
        {
          date: '2026-07-01',
          title: 'Turma A',
          description: 'Presentes: 13 | Atrasados: 1 | Ausentes: 2 | Visitantes: 3',
          value: 42.5,
          id_chamada: 201,
          id_classe: 1,
          presentes: 13,
          atrasados: 1,
          ausentes: 2,
          total_alunos: 16,
          visitantes: 3,
          biblias: 0,
          revistas: 0
        }
      ],
      itens: [
        {
          date: '2026-07-01',
          title: 'Turma A',
          description: 'Presentes: 13 | Atrasados: 1 | Ausentes: 2 | Visitantes: 3',
          value: 42.5,
          id_chamada: 201,
          id_classe: 1,
          presentes: 13,
          atrasados: 1,
          ausentes: 2,
          total_alunos: 16,
          visitantes: 3,
          biblias: 0,
          revistas: 0
        }
      ]
    });
  });
});
