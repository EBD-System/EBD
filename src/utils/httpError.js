class HttpError extends Error {
  constructor(statusCode, message, stage = 'request') {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.stage = stage;
  }
}

module.exports = { HttpError };
