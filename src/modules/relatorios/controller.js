const service = require('./service');
const { sendSuccess } = require('../../utils/response');

async function presenceRankingController(req, res) {
  const data = await service.presenceRanking(req.query.date, req);
  return sendSuccess(res, data, 'Ranking de presença retornado com sucesso.');
}

async function visitorRankingController(req, res) {
  const data = await service.visitorRanking(req.query.date, req);
  return sendSuccess(res, data, 'Ranking de visitantes retornado com sucesso.');
}

async function offerRankingController(req, res) {
  const data = await service.offerRanking(req.query.date, req);
  return sendSuccess(res, data, 'Ranking de ofertas retornado com sucesso.');
}

async function birthdaysController(req, res) {
  const data = await service.birthdays(req.query.date, req);
  return sendSuccess(res, data, 'Aniversariantes retornados com sucesso.');
}

async function periodReportController(req, res) {
  const data = await service.periodReport(req.query.startDate, req.query.endDate, req);
  return sendSuccess(res, data, 'Relatório de período retornado com sucesso.');
}

module.exports = {
  presenceRankingController,
  visitorRankingController,
  offerRankingController,
  birthdaysController,
  periodReportController
};
