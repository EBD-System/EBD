function buildSuccessResponse(data, message = 'Operação concluída com sucesso.') {
  return {
    ok: true,
    message,
    data
  };
}

function buildErrorResponse(error, statusCode = 500) {
  const safeMessage =
    statusCode >= 500
      ? 'Erro interno do servidor.'
      : (typeof error?.message === 'string' && error.message.trim() ? error.message.trim() : 'Requisição inválida.');

  return {
    ok: false,
    source: 'backend',
    stage: error?.stage || 'server',
    message: safeMessage,
    error: {
      statusCode,
      stage: error?.stage || 'server'
    }
  };
}

function sendSuccess(res, data, message, statusCode = 200) {
  return res.status(statusCode).json(buildSuccessResponse(data, message));
}

function sendError(res, error, statusCode = 500) {
  return res.status(statusCode).json(buildErrorResponse(error, statusCode));
}

module.exports = {
  buildSuccessResponse,
  buildErrorResponse,
  sendSuccess,
  sendError
};
