const { HttpError } = require('../utils/httpError');

function notFound(_req, _res, next) {
  next(new HttpError(404, 'Rota não encontrada.', 'routing'));
}

module.exports = { notFound };
