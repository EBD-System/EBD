const service = require('./service');
const { hasAnyProfile, PROFILE } = require('../../utils/profiles');
const { sendSuccess } = require('../../utils/response');

async function openController(req, res) {
  const data = await service.open({
    classId: req.body?.classId,
    date: req.body?.date,
    isAdmin: hasAnyProfile(req.user?.profiles, [PROFILE.ADMINISTRADOR]),
    source: req
  });
  return sendSuccess(res, data, 'Chamada aberta com sucesso.', 201);
}

async function classAttendanceController(req, res) {
  const data = await service.getClassAttendance({
    classId: req.params.classId,
    date: req.query.date,
    source: req
  });
  return sendSuccess(res, data, 'Dados da chamada retornados com sucesso.');
}

async function changeStatusController(req, res) {
  const data = await service.changeStatus({
    callId: req.params.callId,
    studentClassId: req.params.studentClassId,
    status: req.body?.status,
    observation: req.body?.observacao || '',
    source: req
  });
  return sendSuccess(res, data, 'Status da presença atualizado com sucesso.');
}

async function batchChangeStatusController(req, res) {
  const data = await service.changeStatusBatch({
    callId: req.params.callId,
    students: req.body?.students || [],
    source: req
  });
  return sendSuccess(res, data, 'Chamada atualizada com sucesso.');
}

async function presentAllController(req, res) {
  const data = await service.presentAll(req.params.callId, req);
  return sendSuccess(res, data, 'Todos os alunos foram marcados como presentes.');
}

async function absentAllController(req, res) {
  const data = await service.absentAll(req.params.callId, req);
  return sendSuccess(res, data, 'Todos os alunos foram marcados como ausentes.');
}

async function closeController(req, res) {
  const data = await service.close(req.params.callId, req);
  return sendSuccess(res, data, 'Chamada encerrada com sucesso.');
}

async function reopenController(req, res) {
  const data = await service.reopen(
    req.params.callId,
    hasAnyProfile(req.user?.profiles, [PROFILE.ADMINISTRADOR]),
    req
  );
  return sendSuccess(res, data, 'Chamada reaberta com sucesso.');
}

async function visitorController(req, res) {
  const data = await service.addVisitor(req.params.callId, req.body || {}, req);
  return sendSuccess(res, data, 'Visitante registrado com sucesso.', 201);
}

async function offerController(req, res) {
  const data = await service.addOffer(req.params.callId, req.body || {}, req);
  return sendSuccess(res, data, 'Oferta registrada com sucesso.');
}

async function saveSummaryController(req, res) {
  const data = await service.saveSummary(req.params.callId, req.body || {}, req);
  return sendSuccess(res, data, 'Resumo da chamada atualizado com sucesso.');
}

async function summaryController(req, res) {
  const data = await service.summary(req.query.date, req);
  return sendSuccess(res, data, 'Resumo de chamada retornado com sucesso.');
}

async function classSummaryController(req, res) {
  const data = await service.classSummary(req.params.classId, req.query.date, req);
  return sendSuccess(res, data, 'Resumo da classe retornado com sucesso.');
}

module.exports = {
  openController,
  classAttendanceController,
  changeStatusController,
  batchChangeStatusController,
  presentAllController,
  absentAllController,
  closeController,
  reopenController,
  visitorController,
  offerController,
  saveSummaryController,
  summaryController,
  classSummaryController
};
