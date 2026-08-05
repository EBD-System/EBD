const service = require('./service');
const { sendSuccess } = require('../../utils/response');

async function listController(req, res) {
  const data = await service.list(req);
  return sendSuccess(res, data, 'Consulta de classes realizada com sucesso.');
}

async function getController(req, res) {
  const data = await service.get(req.params.id, req);
  return sendSuccess(res, data, 'Classe localizada com sucesso.');
}

async function studentsController(req, res) {
  const data = await service.students(req.params.id, req);
  return sendSuccess(res, data, 'Alunos da classe retornados com sucesso.');
}

async function attendanceController(req, res) {
  const data = await service.attendance(req.params.id, req.query.date, req);
  return sendSuccess(res, data, 'Resumo de chamada retornado com sucesso.');
}

module.exports = {
  listController,
  getController,
  studentsController,
  attendanceController
};
