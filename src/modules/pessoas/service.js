const { HttpError } = require('../../utils/httpError');
const { logger } = require('../../utils/logger');
const { resolveTenantId } = require('../../utils/tenant');
const {
  listPeople,
  getPersonById,
  createPerson,
  updatePerson
} = require('./repository');

function getLog(source = {}) {
  return source?.log || logger;
}

function requireTenantId(source) {
  const idCadastro = resolveTenantId(source);
  if (idCadastro === null) {
    throw new HttpError(400, 'id_cadastro é obrigatório para consultar pessoas autenticadas.', 'people');
  }
  return idCadastro;
}

async function list(source = {}) {
  const idCadastro = requireTenantId(source);
  const page = Number(source.query?.page || 1);
  const limit = Math.min(Number(source.query?.limit || 50), 200);
  const offset = (page - 1) * limit;
  return listPeople({ idCadastro, search: source.query?.search || '', limit, offset });
}

async function get(idPessoa, source = {}) {
  const idCadastro = requireTenantId(source);
  const person = await getPersonById(idPessoa, idCadastro);
  if (!person) throw new HttpError(404, 'Pessoa não encontrada.', 'people');
  return person;
}

async function create(payload, source = {}) {
  if (!payload.nome) throw new HttpError(400, 'Nome é obrigatório.', 'people');
  const idCadastro = requireTenantId(source);
  const person = await createPerson({ ...payload, idCadastro });

  getLog(source).info('people.created', {
    request_id: source.requestId || null,
    person_id: person?.id_pessoa ?? null,
    tenant_id: idCadastro
  });

  return person;
}

async function update(idPessoa, payload, source = {}) {
  const idCadastro = requireTenantId(source);
  const person = await updatePerson(idPessoa, { ...payload, idCadastro });
  if (!person) throw new HttpError(404, 'Pessoa não encontrada.', 'people');

  getLog(source).info('people.updated', {
    request_id: source.requestId || null,
    person_id: Number(idPessoa),
    tenant_id: idCadastro
  });

  return person;
}

module.exports = {
  list,
  get,
  create,
  update
};
