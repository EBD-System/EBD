const service = require('./service');
const { sendSuccess } = require('../../utils/response');

async function listController(req, res) {
  const data = await service.list(req);
  return sendSuccess(res, data, 'Consulta de pessoas realizada com sucesso.');
}

async function getController(req, res) {
  const data = await service.get(req.params.id, req);
  return sendSuccess(res, data, 'Pessoa localizada com sucesso.');
}

async function createController(req, res) {
  const data = await service.create(req.body || {}, req);
  return sendSuccess(res, data, 'Pessoa cadastrada com sucesso.', 201);
}

async function updateController(req, res) {
  const data = await service.update(req.params.id, req.body || {}, req);
  return sendSuccess(res, data, 'Pessoa atualizada com sucesso.');
}

module.exports = {
  listController,
  getController,
  createController,
  updateController
};
