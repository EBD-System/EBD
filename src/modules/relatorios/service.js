const { HttpError } = require('../../utils/httpError');
const { pickDate } = require('../../utils/date');
const { resolveTenantId } = require('../../utils/tenant');
const {
  getPresenceRanking,
  getVisitorRanking,
  getOfferRanking,
  getBirthdays,
  getPeriodReport
} = require('./repository');

function requireTenantId(source) {
  const idCadastro = resolveTenantId(source);
  if (idCadastro === null) {
    throw new HttpError(400, 'id_cadastro é obrigatório para acessar relatórios autenticados.', 'reports');
  }
  return idCadastro;
}

function buildReportResponse(relatorio, dataReferencia, idCadastro, itens) {
  return {
    relatorio,
    id_cadastro: idCadastro,
    data_referencia: dataReferencia,
    total_itens: Array.isArray(itens) ? itens.length : 0,
    itens
  };
}

function buildPeriodReportResponse(startDate, endDate, idCadastro, payload) {
  const summary = payload?.summary || {};
  const activities = Array.isArray(payload?.activities)
    ? payload.activities.map((item) => ({
        ...item,
        biblias: Number(item?.biblias ?? 0),
        revistas: Number(item?.revistas ?? 0)
      }))
    : [];
  const consultedAt = new Date().toISOString();

  return {
    relatorio: 'periodo',
    source: 'backend',
    generatedBy: 'ebd-api',
    title: 'Relatório de período',
    subtitle: `Consolidação entre ${startDate} e ${endDate}.`,
    id_cadastro: idCadastro,
    data_referencia: endDate,
    periodo: {
      startDate,
      endDate
    },
    consultedAt,
    total_itens: activities.length,
    summary: {
      totalRecords: Number(summary.totalRecords ?? summary.total_records ?? 0),
      classes: Number(summary.classes || 0),
      presences: Number(summary.presences || 0),
      visitors: Number(summary.visitors || 0),
      biblias: Number(summary.biblias || 0),
      revistas: Number(summary.revistas || 0),
      offerings: Number(summary.offerings || 0)
    },
    activities,
    itens: activities
  };
}

async function presenceRanking(date, source = {}) {
  const dataReferencia = pickDate(date);
  const idCadastro = requireTenantId(source);
  const itens = await getPresenceRanking(dataReferencia, idCadastro);
  // O retorno antigo em array bruto foi substituído por um envelope estável.
  return buildReportResponse('presenca', dataReferencia, idCadastro, itens);
}

async function visitorRanking(date, source = {}) {
  const dataReferencia = pickDate(date);
  const idCadastro = requireTenantId(source);
  const itens = await getVisitorRanking(dataReferencia, idCadastro);
  return buildReportResponse('visitantes', dataReferencia, idCadastro, itens);
}

async function offerRanking(date, source = {}) {
  const dataReferencia = pickDate(date);
  const idCadastro = requireTenantId(source);
  const itens = await getOfferRanking(dataReferencia, idCadastro);
  return buildReportResponse('ofertas', dataReferencia, idCadastro, itens);
}

async function birthdays(date, source = {}) {
  const dataReferencia = pickDate(date);
  const idCadastro = requireTenantId(source);
  const itens = await getBirthdays(dataReferencia, idCadastro);
  return buildReportResponse('aniversariantes', dataReferencia, idCadastro, itens);
}


async function periodReport(startDate, endDate, source = {}) {
  const idCadastro = requireTenantId(source);
  const payload = await getPeriodReport(startDate, endDate, idCadastro);
  return buildPeriodReportResponse(startDate, endDate, idCadastro, payload);
}

module.exports = {
  presenceRanking,
  visitorRanking,
  offerRanking,
  birthdays,
  periodReport
};
