const { getHealth } = require('../services/health.service');
const { sendSuccess } = require('../utils/response');

async function health(_req, res) {
  const data = await getHealth();
  // Health também segue o envelope único da API.
  return sendSuccess(res, data, 'Serviço funcionando corretamente.');
}

module.exports = { health };
