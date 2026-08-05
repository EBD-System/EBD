const service = require('./service');
const { sendSuccess } = require('../../utils/response');

async function listController(req, res) {
  const data = await service.list(req);
  return sendSuccess(res, data, 'Consulta de alunos realizada com sucesso.');
}

async function getController(req, res) {
  const data = await service.get(req.params.id, req);
  return sendSuccess(res, data, 'Aluno localizado com sucesso.');
}

async function enrollController(req, res) {
  const data = await service.enroll(req.body || {}, req);
  return sendSuccess(res, data, 'Aluno matriculado com sucesso.', 201);
}

async function activateController(req, res) {
  const data = await service.activate(req.params.id, req.body?.observacao || '', req);
  return sendSuccess(res, data, 'Aluno ativado com sucesso.');
}

async function inactivateController(req, res) {
  const data = await service.inactivate(req.params.id, req.body?.motivo, req.body?.observacao || '', req);
  return sendSuccess(res, data, 'Aluno inativado com sucesso.');
}

async function updateObservationController(req, res) {
  const data = await service.updateObservation(req.params.id, req.body?.observacao || '', req);
  return sendSuccess(res, data, 'Observação do aluno atualizada com sucesso.');
}

async function transferController(req, res) {
  const data = await service.transfer(req.params.id, req.body || {}, req);
  return sendSuccess(res, data, 'Aluno transferido com sucesso.');
}

async function historyController(req, res) {
  const data = await service.history(req.params.id, req);
  return sendSuccess(res, data, 'Histórico do aluno retornado com sucesso.');
}

async function statusHistoryController(req, res) {
  const data = await service.statusHistory(req.params.id, req);
  return sendSuccess(res, data, 'Histórico de status retornado com sucesso.');
}

async function classesController(req, res) {
  const data = await service.classes(req.params.id, req);
  return sendSuccess(res, data, 'Turmas do aluno retornadas com sucesso.');
}

async function inactiveReasonsController(req, res) {
  const data = await service.inactiveReasons(req.query?.ids, req);
  return sendSuccess(res, data, 'Motivos de inatividade retornados com sucesso.');
}

module.exports = {
  listController,
  getController,
  enrollController,
  activateController,
  inactivateController,
  updateObservationController,
  transferController,
  historyController,
  statusHistoryController,
  classesController,
  inactiveReasonsController
};
