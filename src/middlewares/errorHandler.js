const { buildErrorResponse } = require('../utils/response');
const { logger, getRequestContext } = require('../utils/logger');

function isMalformedJsonError(error) {
  return Boolean(
    error
    && (
      error.type === 'entity.parse.failed'
      || (error instanceof SyntaxError && error.status === 400 && 'body' in error)
    )
  );
}

function errorHandler(error, req, res, _next) {
  const statusCode = Number(error.statusCode || error.status || 500);
  const isMalformedBody = statusCode === 400 && isMalformedJsonError(error);
  const stage = error.stage || (isMalformedBody ? 'request' : 'server');
  const context = getRequestContext(req);

  if (statusCode >= 500) {
    logger.error('request.failed', {
      ...context,
      stage,
      status_code: statusCode,
      error
    });
  } else {
    logger.warn('request.rejected', {
      ...context,
      stage,
      status_code: statusCode,
      message: error.message
    });
  }

  return res.status(statusCode).json(
    buildErrorResponse(
      {
        message: statusCode >= 500 || isMalformedBody
          ? (statusCode >= 500 ? 'Erro interno do servidor.' : 'Requisição inválida.')
          : error.message,
        stage
      },
      statusCode
    )
  );
}

module.exports = { errorHandler };
