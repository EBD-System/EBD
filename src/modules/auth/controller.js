const { login, me } = require('./service');
const { sendSuccess } = require('../../utils/response');

async function loginController(req, res) {
  const data = await login(req.body || {}, req);
  // Contrato uniforme de sucesso para a API.
  return sendSuccess(res, data, 'Login realizado com sucesso.');
}

async function meController(req, res) {
  const data = await me(req.user.sub, req);
  // Contrato uniforme de sucesso para a API.
  return sendSuccess(res, data, 'Dados do usuário retornados com sucesso.');
}

module.exports = {
  loginController,
  meController
};
