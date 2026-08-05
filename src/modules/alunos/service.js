const { HttpError } = require('../../utils/httpError');
const { logger } = require('../../utils/logger');
const { resolveTenantId } = require('../../utils/tenant');
const { getPersonById } = require('../pessoas/repository');
const { getClassById } = require('../classes/repository');
const {
  listStudents,
  getStudentById,
  matriculateStudent,
  activateStudent,
  inactivateStudent,
  updateStudentObservation,
  transferStudent,
  getStudentHistory,
  getStudentStatusHistory,
  getStudentClasses,
  getInactiveReasonsByStudentIds
} = require('./repository');

function getLog(source = {}) {
  return source?.log || logger;
}

function requireTenantId(source) {
  const idCadastro = resolveTenantId(source);
  if (idCadastro === null) {
    throw new HttpError(400, 'id_cadastro é obrigatório para consultar alunos autenticados.', 'students');
  }
  return idCadastro;
}

async function loadStudentOrFail(idAluno, source = {}) {
  const idCadastro = requireTenantId(source);
  const student = await getStudentById(Number(idAluno), idCadastro);
  if (!student) throw new HttpError(404, 'Aluno não encontrado.', 'students');
  return { student, idCadastro };
}

async function list(source = {}) {
  const idCadastro = requireTenantId(source);
  return listStudents({
    idCadastro,
    classId: source.query?.classId ? Number(source.query.classId) : null,
    status: source.query?.status || null,
    inactive: String(source.query?.inactive || '').toLowerCase() === 'true'
  });
}

async function get(idAluno, source = {}) {
  const { student } = await loadStudentOrFail(idAluno, source);
  return student;
}

async function enroll(payload, source = {}) {
  if (!payload.idPessoa) throw new HttpError(400, 'idPessoa é obrigatório.', 'students');
  if (!payload.idClasse) throw new HttpError(400, 'idClasse é obrigatório.', 'students');

  const idCadastro = requireTenantId(source);
  const idPessoa = Number(payload.idPessoa);
  const idClasse = Number(payload.idClasse);

  const person = await getPersonById(idPessoa, idCadastro);
  if (!person) throw new HttpError(404, 'Pessoa não encontrada.', 'students');

  const classRow = await getClassById(idClasse, idCadastro);
  if (!classRow) throw new HttpError(404, 'Classe não encontrada.', 'students');
  if (!classRow.ativo) throw new HttpError(400, 'Não é possível matricular em turma inativa.', 'students');

  const idAluno = await matriculateStudent({
    idPessoa,
    matricula: payload.matricula || '',
    idClasse,
    dataInicio: payload.dataInicio || null,
    observacao: payload.observacao || '',
    idCadastro
  });
  if (!idAluno) throw new HttpError(404, 'Pessoa ou classe não encontrada no tenant atual.', 'students');

  const enrolledStudent = await getStudentById(Number(idAluno), idCadastro);

  getLog(source).info('students.enrolled', {
    request_id: source.requestId || null,
    student_id: Number(idAluno),
    person_id: idPessoa,
    class_id: idClasse,
    tenant_id: idCadastro
  });

  if (enrolledStudent) {
    return {
      id_aluno: Number(idAluno),
      id_cadastro: idCadastro,
      ...enrolledStudent
    };
  }

  return {
    id_aluno: Number(idAluno),
    id_cadastro: idCadastro,
    id_pessoa: idPessoa,
    id_classe: idClasse,
    matricula: payload.matricula || '',
    status: 'ativo',
    data_inicio: payload.dataInicio || null,
    observacao: payload.observacao || ''
  };
}

async function activate(idAluno, observacao = '', source = {}) {
  await loadStudentOrFail(idAluno, source);
  const idCadastro = requireTenantId(source);
  const ok = await activateStudent(Number(idAluno), observacao, idCadastro);
  if (ok === false) throw new HttpError(404, 'Aluno não encontrado no tenant atual.', 'students');

  getLog(source).info('students.status_changed', {
    request_id: source.requestId || null,
    student_id: Number(idAluno),
    status: 'ativo',
    tenant_id: idCadastro
  });

  return {
    id_aluno: Number(idAluno),
    status: 'ativo'
  };
}

async function inactivate(idAluno, motivo, observacao = '', source = {}) {
  await loadStudentOrFail(idAluno, source);
  if (!motivo) throw new HttpError(400, 'Motivo é obrigatório.', 'students');
  const idCadastro = requireTenantId(source);
  const ok = await inactivateStudent(Number(idAluno), motivo, observacao, idCadastro);
  if (ok === false) throw new HttpError(404, 'Aluno não encontrado no tenant atual.', 'students');

  getLog(source).info('students.status_changed', {
    request_id: source.requestId || null,
    student_id: Number(idAluno),
    status: 'inativo',
    tenant_id: idCadastro
  });

  return {
    id_aluno: Number(idAluno),
    status: 'inativo'
  };
}

async function updateObservation(idAluno, observacao = '', source = {}) {
  await loadStudentOrFail(idAluno, source);
  const idCadastro = requireTenantId(source);
  const updatedStudent = await updateStudentObservation(Number(idAluno), observacao, idCadastro);
  if (!updatedStudent) throw new HttpError(404, 'Aluno não encontrado no tenant atual.', 'students');

  getLog(source).info('students.observation_updated', {
    request_id: source.requestId || null,
    student_id: Number(idAluno),
    tenant_id: idCadastro
  });

  return updatedStudent;
}


async function transfer(idAluno, payload, source = {}) {
  if (!payload.idClasseDestino) throw new HttpError(400, 'idClasseDestino é obrigatório.', 'students');

  const { student, idCadastro } = await loadStudentOrFail(idAluno, source);
  if (student.status !== 'ativo') throw new HttpError(400, 'Aluno inativo não pode ser transferido.', 'students');
  if (!student.id_aluno_classe || !student.id_classe) {
    throw new HttpError(400, 'Aluno não possui vínculo ativo para transferir.', 'students');
  }

  const idClasseDestino = Number(payload.idClasseDestino);
  const classRow = await getClassById(idClasseDestino, idCadastro);
  if (!classRow) throw new HttpError(404, 'Classe destino não encontrada.', 'students');
  if (!classRow.ativo) throw new HttpError(400, 'Não é possível transferir para turma inativa.', 'students');

  const idClasseAtual = Number(student.id_classe);
  if (idClasseDestino === idClasseAtual) {
    throw new HttpError(400, 'O aluno já está vinculado à classe informada.', 'students');
  }

  const idAlunoClasse = await transferStudent({
    idAluno: Number(idAluno),
    idClasseDestino,
    dataInicio: payload.dataInicio || null,
    motivo: payload.motivo || '',
    observacao: payload.observacao || '',
    idCadastro
  });
  if (!idAlunoClasse) throw new HttpError(404, 'Aluno não encontrado no tenant atual.', 'students');

  getLog(source).info('students.transferred', {
    request_id: source.requestId || null,
    student_id: Number(idAluno),
    class_origin_id: idClasseAtual,
    class_destination_id: idClasseDestino,
    student_class_id: idAlunoClasse,
    tenant_id: idCadastro
  });

  return {
    id_aluno: Number(idAluno),
    id_aluno_classe: idAlunoClasse,
    id_classe_origem: idClasseAtual,
    id_classe_destino: idClasseDestino,
    data_inicio: payload.dataInicio || null
  };
}

async function history(idAluno, source = {}) {
  await loadStudentOrFail(idAluno, source);
  return getStudentHistory(Number(idAluno));
}

async function statusHistory(idAluno, source = {}) {
  await loadStudentOrFail(idAluno, source);
  return getStudentStatusHistory(Number(idAluno));
}

async function classes(idAluno, source = {}) {
  await loadStudentOrFail(idAluno, source);
  return getStudentClasses(Number(idAluno), requireTenantId(source));
}

async function inactiveReasons(ids, source = {}) {
  const idCadastro = requireTenantId(source);
  const normalizedIds = Array.isArray(ids)
    ? ids.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0)
    : [];

  if (normalizedIds.length === 0) {
    throw new HttpError(400, 'ids é obrigatório.', 'students');
  }

  return getInactiveReasonsByStudentIds({ idCadastro, ids: normalizedIds });
}

module.exports = {
  list,
  get,
  enroll,
  activate,
  inactivate,
  updateObservation,
  transfer,
  history,
  statusHistory,
  classes,
  inactiveReasons
};
