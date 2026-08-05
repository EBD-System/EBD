const { createRequestId, logger, getRequestContext } = require('../utils/logger');

function requestTelemetry(req, res, next) {
  const requestId = req.headers['x-request-id'] || createRequestId();
  req.requestId = requestId;
  req.log = {
    error: (message, meta) => logger.error(message, { ...getRequestContext(req), ...meta }),
    warn: (message, meta) => logger.warn(message, { ...getRequestContext(req), ...meta }),
    info: (message, meta) => logger.info(message, { ...getRequestContext(req), ...meta }),
    debug: (message, meta) => logger.debug(message, { ...getRequestContext(req), ...meta })
  };

  res.setHeader('X-Request-Id', requestId);
  next();
}

module.exports = { requestTelemetry };
