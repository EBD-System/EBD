const { HttpError } = require('../utils/httpError');
const { stripNonDigits } = require('../utils/telefone');

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function fail(stage, message) {
  throw new HttpError(400, message, stage);
}

function asPlainObject(value, stage, label) {
  if (value === undefined || value === null) return {};
  if (!isPlainObject(value)) {
    fail(stage, `${label} deve ser um objeto.`);
  }
  return value;
}

function normalizeTrimmedString(value, stage, field, { required = false, maxLength = 255 } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) fail(stage, `${field} é obrigatório.`);
    return undefined;
  }

  if (typeof value !== 'string') {
    fail(stage, `${field} deve ser um texto.`);
  }

  const trimmed = value.trim();
  if (!trimmed && required) fail(stage, `${field} é obrigatório.`);
  if (trimmed && maxLength && trimmed.length > maxLength) {
    fail(stage, `${field} deve ter no máximo ${maxLength} caracteres.`);
  }
  return trimmed;
}

function normalizeRequiredString(value, stage, field, maxLength = 255) {
  const normalized = normalizeTrimmedString(value, stage, field, { required: true, maxLength });
  if (normalized === undefined) fail(stage, `${field} é obrigatório.`);
  return normalized;
}

function normalizeOptionalBoolean(value, stage, field) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'sim'].includes(normalized)) return true;
    if (['false', '0', 'no', 'nao', 'não'].includes(normalized)) return false;
  }
  fail(stage, `${field} deve ser verdadeiro ou falso.`);
}

function normalizeOptionalInteger(value, stage, field, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    fail(stage, `${field} deve ser um número inteiro válido.`);
  }
  return parsed;
}

function normalizeRequiredInteger(value, stage, field, options = {}) {
  const parsed = normalizeOptionalInteger(value, stage, field, options);
  if (parsed === undefined) fail(stage, `${field} é obrigatório.`);
  return parsed;
}

function isValidISODate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function normalizeOptionalISODate(value, stage, field) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') fail(stage, `${field} deve estar no formato YYYY-MM-DD.`);
  const trimmed = value.trim();
  if (!isValidISODate(trimmed)) fail(stage, `${field} deve estar no formato YYYY-MM-DD.`);
  return trimmed;
}

function normalizeOptionalEmail(value, stage, field) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') fail(stage, `${field} deve ser um e-mail válido.`);
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const basicEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!basicEmail.test(trimmed)) fail(stage, `${field} deve ser um e-mail válido.`);
  return trimmed;
}

function normalizeOptionalCpf(value, stage, field) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') fail(stage, `${field} deve ser um texto.`);
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 11) fail(stage, `${field} deve conter 11 dígitos.`);
  return digits;
}

function normalizeOptionalCep(value, stage, field) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') fail(stage, `${field} deve ser um texto.`);
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 8) fail(stage, `${field} deve conter 8 dígitos.`);
  return digits;
}


function normalizeOptionalPhone(value, stage, field) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') fail(stage, `${field} deve ser um texto.`);
  const digits = stripNonDigits(value);
  if (digits.length > 11) fail(stage, `${field} deve conter no máximo 11 dígitos.`);
  return digits || undefined;
}

function normalizeOptionalUf(value, stage, field) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') fail(stage, `${field} deve ser um texto.`);
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) fail(stage, `${field} deve conter 2 letras.`);
  return normalized;
}

function normalizeOptionalEnum(value, stage, field, allowed) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') fail(stage, `${field} deve ser um texto.`);
  const normalized = value.trim();
  if (!allowed.includes(normalized)) {
    fail(stage, `${field} deve ser um dos valores aceitos: ${allowed.join(', ')}.`);
  }
  return normalized;
}

function normalizeOptionalNumeric(value, stage, field, { min = 0 } = {}) {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min) {
    fail(stage, `${field} deve ser um número válido.`);
  }
  return parsed;
}

function validateLoginBody(req, _res, next) {
  try {
    const body = asPlainObject(req.body, 'auth', 'O payload');

    const login = normalizeRequiredString(body.login, 'auth', 'login', 120);
    if (typeof body.senha !== 'string') {
      fail('auth', 'senha deve ser um texto.');
    }

    const senha = body.senha;
    if (!senha.length) fail('auth', 'senha é obrigatória.');
    if (senha.length > 255) fail('auth', 'senha deve ter no máximo 255 caracteres.');

    req.body = {
      login,
      senha
    };
    return next();
  } catch (error) {
    return next(error);
  }
}

function validatePositiveIdParam(paramName, stage, label = paramName) {
  return (req, _res, next) => {
    try {
      const value = normalizeRequiredInteger(req.params?.[paramName], stage, label);
      req.params[paramName] = value;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

function validatePaginationQuery(req, _res, next) {
  try {
    const query = asPlainObject(req.query, 'people', 'A query');
    const page = normalizeOptionalInteger(query.page, 'people', 'page', { min: 1, max: 1000000 }) ?? 1;
    const limit = normalizeOptionalInteger(query.limit, 'people', 'limit', { min: 1, max: 200 }) ?? 50;
    req.query = { ...query, page, limit };
    return next();
  } catch (error) {
    return next(error);
  }
}

function validatePeopleListQuery(req, _res, next) {
  try {
    const query = asPlainObject(req.query, 'people', 'A query');
    const page = normalizeOptionalInteger(query.page, 'people', 'page', { min: 1, max: 1000000 }) ?? 1;
    const limit = normalizeOptionalInteger(query.limit, 'people', 'limit', { min: 1, max: 200 }) ?? 50;
    const search = normalizeTrimmedString(query.search, 'people', 'search', { maxLength: 255 }) || '';
    req.query = { ...query, page, limit, search };
    return next();
  } catch (error) {
    return next(error);
  }
}

function normalizePersonPayload(body, stage, { requireName = false } = {}) {
  const payload = asPlainObject(body, stage, 'O payload');
  return {
    nome: requireName
      ? normalizeRequiredString(payload.nome, stage, 'nome', 180)
      : normalizeTrimmedString(payload.nome, stage, 'nome', { maxLength: 180 }),
    sexo: normalizeOptionalEnum(payload.sexo, stage, 'sexo', ['nao_informado', 'masculino', 'feminino', 'outro']),
    cpf: normalizeOptionalCpf(payload.cpf, stage, 'cpf'),
    data_nascimento: normalizeOptionalISODate(payload.data_nascimento, stage, 'data_nascimento'),
    telefone: normalizeOptionalPhone(payload.telefone, stage, 'telefone'),
    email: normalizeOptionalEmail(payload.email, stage, 'email'),
    logradouro: normalizeTrimmedString(payload.logradouro, stage, 'logradouro', { maxLength: 200 }),
    numero: normalizeTrimmedString(payload.numero, stage, 'numero', { maxLength: 20 }),
    bairro: normalizeTrimmedString(payload.bairro, stage, 'bairro', { maxLength: 120 }),
    cidade: normalizeTrimmedString(payload.cidade, stage, 'cidade', { maxLength: 120 }),
    uf: normalizeOptionalUf(payload.uf, stage, 'uf'),
    cep: normalizeOptionalCep(payload.cep, stage, 'cep'),
    observacao: normalizeTrimmedString(payload.observacao, stage, 'observacao', { maxLength: 1000 }),
  };
}

function validatePersonCreateBody(req, _res, next) {
  try {
    req.body = normalizePersonPayload(req.body, 'people', { requireName: true });
    return next();
  } catch (error) {
    return next(error);
  }
}

function validatePersonUpdateBody(req, _res, next) {
  try {
    req.body = normalizePersonPayload(req.body, 'people', { requireName: false });
    return next();
  } catch (error) {
    return next(error);
  }
}

function validateClassIdQueryOrBody(value, stage, field) {
  return normalizeRequiredInteger(value, stage, field);
}

function validateAttendanceOpenBody(req, _res, next) {
  try {
    const body = asPlainObject(req.body, 'attendance', 'O payload');
    req.body = {
      classId: normalizeRequiredInteger(body.classId, 'attendance', 'classId'),
      date: normalizeOptionalISODate(body.date, 'attendance', 'date')
    };
    return next();
  } catch (error) {
    return next(error);
  }
}

function validateAttendanceClassParams(req, _res, next) {
  try {
    req.params.classId = normalizeRequiredInteger(req.params?.classId, 'attendance', 'classId');
    return next();
  } catch (error) {
    return next(error);
  }
}

function validateAttendanceCallParams(req, _res, next) {
  try {
    req.params.callId = normalizeRequiredInteger(req.params?.callId, 'attendance', 'callId');
    if ('studentClassId' in req.params) {
      req.params.studentClassId = normalizeRequiredInteger(req.params?.studentClassId, 'attendance', 'studentClassId');
    }
    return next();
  } catch (error) {
    return next(error);
  }
}

function validateAttendanceChangeBody(req, _res, next) {
  try {
    const body = asPlainObject(req.body, 'attendance', 'O payload');
    req.body = {
      status: normalizeRequiredEnum(body.status, 'attendance', 'status', ['presente', 'atrasado', 'ausente']),
      observacao: normalizeTrimmedString(body.observacao, 'attendance', 'observacao', { maxLength: 1000 }) || ''
    };
    return next();
  } catch (error) {
    return next(error);
  }
}

function validateAttendanceBatchChangeBody(req, _res, next) {
  try {
    const body = asPlainObject(req.body, 'attendance', 'O payload');
    const studentsPayload = body.students;

    if (!Array.isArray(studentsPayload) || studentsPayload.length === 0) {
      fail('attendance', 'students deve ser uma lista com pelo menos um item.');
    }

    const seenIds = new Set();
    const students = studentsPayload.map((item, index) => {
      if (!isPlainObject(item)) {
        fail('attendance', `students[${index}] deve ser um objeto.`);
      }

      const studentClassId = normalizeRequiredInteger(
        item.studentClassId ?? item.id_aluno_classe ?? item.idAlunoClasse ?? item.id_aluno_turma ?? item.classStudentId,
        'attendance',
        `students[${index}].studentClassId`
      );
      if (seenIds.has(studentClassId)) {
        fail('attendance', 'students não pode conter studentClassId duplicado.');
      }
      seenIds.add(studentClassId);

      return {
        studentClassId,
        status: normalizeRequiredEnum(item.status, 'attendance', `students[${index}].status`, ['presente', 'atrasado', 'ausente']),
        observacao: normalizeTrimmedString(item.observacao, 'attendance', `students[${index}].observacao`, { maxLength: 1000 }) || ''
      };
    });

    req.body = { students };
    return next();
  } catch (error) {
    return next(error);
  }
}

function validateAttendanceVisitorBody(req, _res, next) {
  try {
    const body = asPlainObject(req.body, 'attendance', 'O payload');
    req.body = {
      name: normalizeRequiredString(body.name, 'attendance', 'name', 180),
      observation: normalizeTrimmedString(body.observation, 'attendance', 'observation', { maxLength: 1000 }) || ''
    };
    return next();
  } catch (error) {
    return next(error);
  }
}

function validateAttendanceOfferBody(req, _res, next) {
  try {
    const body = asPlainObject(req.body, 'attendance', 'O payload');
    req.body = {
      value: normalizeRequiredNumeric(body.value, 'attendance', 'value', { min: 0 })
    };
    return next();
  } catch (error) {
    return next(error);
  }
}

function validateAttendanceSummaryBody(req, _res, next) {
  try {
    const body = asPlainObject(req.body, 'attendance', 'O payload');
    const hasPayload =
      body.oferta !== undefined ||
      body.value !== undefined ||
      body.visitantes !== undefined ||
      body.biblias !== undefined ||
      body.revistas !== undefined;

    if (!hasPayload) {
      fail('attendance', 'Informe ao menos um campo do resumo da chamada.');
    }

    req.body = {
      oferta: normalizeOptionalNumeric(body.oferta ?? body.value, 'attendance', 'oferta', { min: 0 }),
      visitantes: normalizeOptionalInteger(body.visitantes, 'attendance', 'visitantes', { min: 0 }),
      biblias: normalizeOptionalInteger(body.biblias, 'attendance', 'biblias', { min: 0 }),
      revistas: normalizeOptionalInteger(body.revistas, 'attendance', 'revistas', { min: 0 })
    };
    return next();
  } catch (error) {
    return next(error);
  }
}

function normalizeRequiredEnum(value, stage, field, allowed) {
  const normalized = normalizeOptionalEnum(value, stage, field, allowed);
  if (normalized === undefined) fail(stage, `${field} é obrigatório.`);
  return normalized;
}

function normalizeRequiredNumeric(value, stage, field, options = {}) {
  const normalized = normalizeOptionalNumeric(value, stage, field, options);
  if (normalized === undefined) fail(stage, `${field} é obrigatório.`);
  return normalized;
}

function validateClassListQuery(req, _res, next) {
  try {
    const query = asPlainObject(req.query, 'classes', 'A query');
    const date = normalizeOptionalISODate(query.date, 'classes', 'date');
    req.query = date ? { ...query, date } : query;
    return next();
  } catch (error) {
    return next(error);
  }
}

function normalizeOptionalIntegerList(value, stage, field) {
  if (value === undefined || value === null || value === '') return undefined;

  const values = Array.isArray(value)
    ? value
    : String(value)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

  const parsed = values.map((item) => {
    const normalized = normalizeRequiredInteger(item, stage, field);
    return normalized;
  });

  const unique = [...new Set(parsed)];
  if (unique.length === 0) {
    fail(stage, `${field} é obrigatório.`);
  }

  return unique;
}

function validateStudentInactiveReasonsQuery(req, _res, next) {
  try {
    const query = asPlainObject(req.query, 'students', 'A query');
    const ids = normalizeOptionalIntegerList(query.ids, 'students', 'ids');
    if (!ids || ids.length === 0) {
      fail('students', 'ids é obrigatório.');
    }
    req.query = {
      ...query,
      ids
    };
    return next();
  } catch (error) {
    return next(error);
  }
}

function validateStudentsListQuery(req, _res, next) {
  try {
    const query = asPlainObject(req.query, 'students', 'A query');
    const classId = normalizeOptionalInteger(query.classId, 'students', 'classId', { min: 1 });
    const status = normalizeOptionalEnum(query.status, 'students', 'status', ['ativo', 'transferido', 'inativo', 'falecido']);
    const inactive = normalizeOptionalBoolean(query.inactive, 'students', 'inactive');
    req.query = {
      ...query,
      ...(classId !== undefined ? { classId } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(inactive !== undefined ? { inactive } : {})
    };
    return next();
  } catch (error) {
    return next(error);
  }
}

function validateStudentEnrollBody(req, _res, next) {
  try {
    const body = asPlainObject(req.body, 'students', 'O payload');
    req.body = {
      idPessoa: normalizeRequiredInteger(body.idPessoa, 'students', 'idPessoa'),
      idClasse: normalizeRequiredInteger(body.idClasse, 'students', 'idClasse'),
      matricula: normalizeTrimmedString(body.matricula, 'students', 'matricula', { maxLength: 80 }) || '',
      dataInicio: normalizeOptionalISODate(body.dataInicio, 'students', 'dataInicio'),
      observacao: normalizeTrimmedString(body.observacao, 'students', 'observacao', { maxLength: 1000 }) || ''
    };
    return next();
  } catch (error) {
    return next(error);
  }
}

function validateStudentObservationBody(req, _res, next) {
  try {
    const body = asPlainObject(req.body, 'students', 'O payload');
    req.body = {
      observacao: normalizeTrimmedString(body.observacao, 'students', 'observacao', { maxLength: 1000 }) || ''
    };
    return next();
  } catch (error) {
    return next(error);
  }
}

function validateStudentInactivateBody(req, _res, next) {
  try {
    const body = asPlainObject(req.body, 'students', 'O payload');
    req.body = {
      motivo: normalizeRequiredString(body.motivo, 'students', 'motivo', 255),
      observacao: normalizeTrimmedString(body.observacao, 'students', 'observacao', { maxLength: 1000 }) || ''
    };
    return next();
  } catch (error) {
    return next(error);
  }
}

function validateStudentTransferBody(req, _res, next) {
  try {
    const body = asPlainObject(req.body, 'students', 'O payload');
    req.body = {
      idClasseDestino: normalizeRequiredInteger(body.idClasseDestino, 'students', 'idClasseDestino'),
      dataInicio: normalizeOptionalISODate(body.dataInicio, 'students', 'dataInicio'),
      motivo: normalizeTrimmedString(body.motivo, 'students', 'motivo', { maxLength: 255 }) || '',
      observacao: normalizeTrimmedString(body.observacao, 'students', 'observacao', { maxLength: 1000 }) || ''
    };
    return next();
  } catch (error) {
    return next(error);
  }
}

function validateReportsDateQuery(req, _res, next) {
  try {
    const query = asPlainObject(req.query, 'reports', 'A query');
    const date = normalizeOptionalISODate(query.date, 'reports', 'date');
    req.query = date ? { ...query, date } : query;
    return next();
  } catch (error) {
    return next(error);
  }
}

function validateReportsPeriodQuery(req, _res, next) {
  try {
    const query = asPlainObject(req.query, 'reports', 'A query');
    const startDate = normalizeRequiredString(
      normalizeOptionalISODate(query.startDate, 'reports', 'startDate'),
      'reports',
      'startDate',
      10
    );
    const endDate = normalizeRequiredString(
      normalizeOptionalISODate(query.endDate, 'reports', 'endDate'),
      'reports',
      'endDate',
      10
    );

    if (startDate > endDate) {
      fail('reports', 'startDate não pode ser maior que endDate.');
    }

    req.query = { ...query, startDate, endDate };
    return next();
  } catch (error) {
    return next(error);
  }
}

function validateIdQueryParam(req, _res, next) {
  try {
    const query = asPlainObject(req.query, 'request', 'A query');
    if (query.id !== undefined) {
      query.id = normalizeRequiredInteger(query.id, 'request', 'id');
    }
    req.query = query;
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  validateLoginBody,
  validatePositiveIdParam,
  validatePaginationQuery,
  validatePeopleListQuery,
  validatePersonCreateBody,
  validatePersonUpdateBody,
  validateAttendanceOpenBody,
  validateAttendanceClassParams,
  validateAttendanceCallParams,
  validateAttendanceChangeBody,
  validateAttendanceBatchChangeBody,
  validateAttendanceVisitorBody,
  validateAttendanceOfferBody,
  validateAttendanceSummaryBody,
  validateClassListQuery,
  validateStudentsListQuery,
  validateStudentInactiveReasonsQuery,
  validateStudentEnrollBody,
  validateStudentObservationBody,
  validateStudentInactivateBody,
  validateStudentTransferBody,
  validateReportsDateQuery,
  validateReportsPeriodQuery,
};
