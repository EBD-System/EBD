const { HttpError } = require('../../utils/httpError');
const { resolveTenantId } = require('../../utils/tenant');
const {
  listClasses,
  getClassById,
  getClassStudents,
  getClassAttendance
} = require('./repository');

function requireTenantId(source) {
  const idCadastro = resolveTenantId(source);
  if (idCadastro === null) {
    throw new HttpError(400, 'id_cadastro é obrigatório para consultar classes autenticadas.', 'classes');
  }
  return idCadastro;
}

async function list(source = {}) {
  const idCadastro = requireTenantId(source);
  return listClasses(idCadastro, source?.query?.date);
}

async function get(idClasse, source = {}) {
  const idCadastro = requireTenantId(source);
  const classRow = await getClassById(idClasse, idCadastro);
  if (!classRow) throw new HttpError(404, 'Classe não encontrada.', 'classes');
  return classRow;
}

async function students(idClasse, source = {}) {
  const idCadastro = requireTenantId(source);
  return getClassStudents(idClasse, idCadastro);
}

async function attendance(idClasse, date, source = {}) {
  const idCadastro = requireTenantId(source);
  return getClassAttendance(idClasse, date, idCadastro);
}

module.exports = {
  list,
  get,
  students,
  attendance
};
