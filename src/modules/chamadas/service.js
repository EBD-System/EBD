const { HttpError } = require('../../utils/httpError');
const { logger } = require('../../utils/logger');
const { todayISO, pickDate } = require('../../utils/date');
const { resolveTenantId } = require('../../utils/tenant');
const { getClassById } = require('../classes/repository');
const {
  openAttendance,
  getAttendanceByClassAndDate,
  updateAttendanceStatus,
  updateAttendanceStatuses,
  markAllPresent,
  markAllAbsent,
  closeAttendance,
  reopenAttendance,
  registerVisitor,
  registerOffer,
  saveCallSummary,
  getCallSummary,
  getClassSummary
} = require('./repository');

function getLog(source = {}) {
  return source?.log || logger;
}

function requireTenantId(source) {
  const idCadastro = resolveTenantId(source);
  if (idCadastro === null) {
    throw new HttpError(400, 'id_cadastro é obrigatório para acessar chamadas autenticadas.', 'attendance');
  }
  return idCadastro;
}

async function open({ classId, date, isAdmin = false, source = {} }) {
  if (!classId) throw new HttpError(400, 'classId é obrigatório.', 'attendance');

  const idCadastro = requireTenantId(source);
  const finalDate = pickDate(date);
  const classRow = await getClassById(Number(classId), idCadastro);
  if (!classRow) throw new HttpError(404, 'Classe não encontrada.', 'attendance');
  if (!classRow.ativo) throw new HttpError(400, 'Não é possível abrir chamada para uma turma inativa.', 'attendance');

  if (finalDate !== todayISO() && !isAdmin) {
    throw new HttpError(403, 'A chamada só pode ser aberta para o dia atual.', 'attendance');
  }

  const idChamada = await openAttendance(Number(classId), finalDate, idCadastro);
  getLog(source).info('attendance.call.opened', {
    request_id: source.requestId || null,
    call_id: idChamada,
    class_id: Number(classId),
    tenant_id: idCadastro,
    date: finalDate
  });
  return { id_chamada: idChamada, data_chamada: finalDate };
}

async function getClassAttendance({ classId, date, source = {} }) {
  if (!classId) throw new HttpError(400, 'classId é obrigatório.', 'attendance');
  const idCadastro = requireTenantId(source);
  const classRow = await getClassById(Number(classId), idCadastro);
  if (!classRow) throw new HttpError(404, 'Classe não encontrada.', 'attendance');
  const finalDate = pickDate(date);
  return getAttendanceByClassAndDate(Number(classId), finalDate, idCadastro);
}

async function changeStatus({ callId, studentClassId, status, observation = '', source = {} }) {
  if (!callId || !studentClassId) throw new HttpError(400, 'callId e studentClassId são obrigatórios.', 'attendance');
  const idCadastro = requireTenantId(source);
  const normalized = String(status || '').toLowerCase();
  if (!['presente', 'atrasado', 'ausente'].includes(normalized)) {
    throw new HttpError(400, 'Status inválido.', 'attendance');
  }

  // A mutação agora persiste status e observação no mesmo caminho transacional,
  // mantendo a regra de negócio e evitando perder o texto informado pelo usuário.
  const updated = await updateAttendanceStatus(
    Number(callId),
    Number(studentClassId),
    normalized,
    observation || '',
    idCadastro
  );

  getLog(source).info('attendance.presence.updated', {
    request_id: source.requestId || null,
    call_id: Number(callId),
    student_class_id: Number(studentClassId),
    status: updated.status,
    tenant_id: idCadastro
  });

  return {
    id_chamada_aluno: updated.id_chamada_aluno,
    status: updated.status,
    observacao: updated.observacao
  };
}

async function changeStatusBatch({ callId, students, source = {} }) {
  if (!callId) throw new HttpError(400, 'callId é obrigatório.', 'attendance');
  if (!Array.isArray(students) || students.length === 0) {
    throw new HttpError(400, 'students deve ser uma lista com pelo menos um item.', 'attendance');
  }

  const idCadastro = requireTenantId(source);
  const normalizedStudents = students.map((student, index) => {
    if (!student || typeof student !== 'object' || Array.isArray(student)) {
      throw new HttpError(400, `students[${index}] deve ser um objeto.`, 'attendance');
    }

    const studentClassId = Number(
      student.studentClassId ??
        student.id_aluno_classe ??
        student.idAlunoClasse ??
        student.id_aluno_turma ??
        student.classStudentId
    );
    if (!Number.isInteger(studentClassId) || studentClassId <= 0) {
      throw new HttpError(400, `students[${index}].studentClassId deve ser um número inteiro válido.`, 'attendance');
    }

    const status = String(student.status || '').trim().toLowerCase();
    if (!['presente', 'atrasado', 'ausente'].includes(status)) {
      throw new HttpError(400, `students[${index}].status deve ser um dos valores aceitos: presente, atrasado, ausente.`, 'attendance');
    }

    const observacao = typeof student.observacao === 'string' ? student.observacao.trim() : '';
    if (observacao.length > 1000) {
      throw new HttpError(400, `students[${index}].observacao deve ter no máximo 1000 caracteres.`, 'attendance');
    }

    return {
      studentClassId,
      status,
      observacao
    };
  });

  const updated = await updateAttendanceStatuses(Number(callId), normalizedStudents, idCadastro);

  getLog(source).info('attendance.presence.bulk_updated', {
    request_id: source.requestId || null,
    call_id: Number(callId),
    total: updated.length,
    tenant_id: idCadastro
  });

  return {
    id_chamada: Number(callId),
    total_alteracoes: updated.length,
    itens: updated.map((item) => ({
      id_chamada_aluno: item.id_chamada_aluno,
      status: item.status,
      observacao: item.observacao
    }))
  };
}

async function presentAll(callId, source = {}) {
  if (!callId) throw new HttpError(400, 'callId é obrigatório.', 'attendance');
  const idCadastro = requireTenantId(source);
  await markAllPresent(Number(callId), idCadastro);
  getLog(source).info('attendance.bulk_marked_present', {
    request_id: source.requestId || null,
    call_id: Number(callId),
    tenant_id: idCadastro
  });
  return {
    id_chamada: Number(callId),
    status: 'presente'
  };
}

async function absentAll(callId, source = {}) {
  if (!callId) throw new HttpError(400, 'callId é obrigatório.', 'attendance');
  const idCadastro = requireTenantId(source);
  await markAllAbsent(Number(callId), idCadastro);
  getLog(source).info('attendance.bulk_marked_absent', {
    request_id: source.requestId || null,
    call_id: Number(callId),
    tenant_id: idCadastro
  });
  return {
    id_chamada: Number(callId),
    status: 'ausente'
  };
}

async function close(callId, source = {}) {
  if (!callId) throw new HttpError(400, 'callId é obrigatório.', 'attendance');
  const idCadastro = requireTenantId(source);
  await closeAttendance(Number(callId), idCadastro);
  getLog(source).info('attendance.call.closed', {
    request_id: source.requestId || null,
    call_id: Number(callId),
    tenant_id: idCadastro
  });
  return {
    id_chamada: Number(callId),
    status: 'fechada'
  };
}

async function reopen(callId, isAdmin = false, source = {}) {
  if (!callId) throw new HttpError(400, 'callId é obrigatório.', 'attendance');
  const idCadastro = requireTenantId(source);
  await reopenAttendance(Number(callId), isAdmin, idCadastro);
  getLog(source).info('attendance.call.reopened', {
    request_id: source.requestId || null,
    call_id: Number(callId),
    tenant_id: idCadastro,
    admin_override: Boolean(isAdmin)
  });
  return {
    id_chamada: Number(callId),
    status: 'reaberta'
  };
}

async function addVisitor(callId, payload, source = {}) {
  if (!callId) throw new HttpError(400, 'callId é obrigatório.', 'attendance');
  if (!payload.name) throw new HttpError(400, 'Nome do visitante é obrigatório.', 'attendance');
  const idCadastro = requireTenantId(source);
  const id = await registerVisitor(Number(callId), payload.name, payload.observation || '', idCadastro);
  getLog(source).info('attendance.visitor.registered', {
    request_id: source.requestId || null,
    call_id: Number(callId),
    visitor_id: id,
    tenant_id: idCadastro
  });
  return { id_chamada_visitante: id };
}

async function addOffer(callId, payload, source = {}) {
  if (!callId) throw new HttpError(400, 'callId é obrigatório.', 'attendance');
  const idCadastro = requireTenantId(source);
  const value = Number(payload.value || 0);
  const saved = await registerOffer(Number(callId), value, idCadastro);
  getLog(source).info('attendance.offer.registered', {
    request_id: source.requestId || null,
    call_id: Number(callId),
    value,
    tenant_id: idCadastro
  });
  return { oferta: saved };
}

async function saveSummary(callId, payload, source = {}) {
  if (!callId) throw new HttpError(400, 'callId é obrigatório.', 'attendance');
  const idCadastro = requireTenantId(source);

  const summary = {
    oferta: payload.oferta ?? payload.value ?? null,
    visitantes: payload.visitantes ?? null,
    biblias: payload.biblias ?? null,
    revistas: payload.revistas ?? null
  };

  const saved = await saveCallSummary(Number(callId), summary, idCadastro);
  getLog(source).info('attendance.call.summary.saved', {
    request_id: source.requestId || null,
    call_id: Number(callId),
    oferta: saved?.oferta ?? summary.oferta ?? null,
    visitantes: saved?.visitantes ?? summary.visitantes ?? null,
    biblias: saved?.biblias ?? summary.biblias ?? null,
    revistas: saved?.revistas ?? summary.revistas ?? null,
    tenant_id: idCadastro
  });

  return saved || {
    id_chamada: Number(callId),
    oferta: Number(summary.oferta || 0),
    visitantes: Number(summary.visitantes || 0),
    biblias: Number(summary.biblias || 0),
    revistas: Number(summary.revistas || 0)
  };
}

async function summary(date, source = {}) {
  const idCadastro = requireTenantId(source);
  return getCallSummary(pickDate(date), idCadastro);
}

async function classSummary(classId, date, source = {}) {
  if (!classId) throw new HttpError(400, 'classId é obrigatório.', 'attendance');
  const idCadastro = requireTenantId(source);
  const classRow = await getClassById(Number(classId), idCadastro);
  if (!classRow) throw new HttpError(404, 'Classe não encontrada.', 'attendance');
  return getClassSummary(Number(classId), pickDate(date), idCadastro);
}

module.exports = {
  open,
  getClassAttendance,
  changeStatus,
  changeStatusBatch,
  presentAll,
  absentAll,
  close,
  reopen,
  addVisitor,
  addOffer,
  saveSummary,
  summary,
  classSummary
};
