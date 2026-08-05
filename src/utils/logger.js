const crypto = require('crypto');

const LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

const envLevel = String(process.env.LOG_LEVEL || 'info').toLowerCase();
const currentLevel = Object.prototype.hasOwnProperty.call(LEVELS, envLevel) ? envLevel : 'info';

const REDACT_KEYS = new Set([
  'authorization',
  'password',
  'pass',
  'senha',
  'senha_hash',
  'token',
  'access_token',
  'refresh_token',
  'jwt',
  'secret',
  'jwtsecret'
]);

function shouldLog(level) {
  return LEVELS[level] <= LEVELS[currentLevel];
}

function isPlainObject(value) {
  return Boolean(value) && Object.prototype.toString.call(value) === '[object Object]';
}

function sanitize(value, depth = 0, seen = new WeakSet()) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'function') return '[Function]';
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    const payload = {
      name: value.name,
      message: value.message
    };
    if (value.code !== undefined) payload.code = value.code;
    if (value.statusCode !== undefined) payload.statusCode = value.statusCode;
    if (value.stage !== undefined) payload.stage = value.stage;
    if (process.env.NODE_ENV !== 'production') {
      payload.stack = value.stack;
    }
    return payload;
  }

  if (Array.isArray(value)) {
    if (depth >= 3) return '[Array]';
    return value.slice(0, 20).map((item) => sanitize(item, depth + 1, seen));
  }

  if (!isPlainObject(value)) return String(value);

  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (depth >= 4) return '[Object]';

  const output = {};
  for (const [key, nested] of Object.entries(value)) {
    const normalizedKey = String(key).toLowerCase();
    if (REDACT_KEYS.has(normalizedKey)) {
      output[key] = '[REDACTED]';
      continue;
    }
    output[key] = sanitize(nested, depth + 1, seen);
  }
  return output;
}

function buildBaseEntry(level, message, meta = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message
  };

  const safeMeta = sanitize(meta);
  if (isPlainObject(safeMeta)) {
    Object.assign(entry, safeMeta);
  } else if (safeMeta !== undefined) {
    entry.meta = safeMeta;
  }

  return entry;
}

function write(level, message, meta = {}) {
  if (!shouldLog(level)) return;
  const entry = buildBaseEntry(level, message, meta);
  const line = JSON.stringify(entry);

  if (level === 'error') {
    console.error(line);
    return;
  }

  if (level === 'warn') {
    console.warn(line);
    return;
  }

  console.log(line);
}

function createRequestId() {
  return crypto.randomUUID();
}

function getRequestContext(req = {}) {
  const requestId = req.requestId || req.id || req.headers?.['x-request-id'] || createRequestId();
  const routePath = req.route?.path ? String(req.route.path) : null;
  const baseUrl = req.baseUrl ? String(req.baseUrl) : '';
  const originalUrl = req.originalUrl ? String(req.originalUrl).split('?')[0] : null;
  const method = req.method ? String(req.method).toUpperCase() : undefined;
  const user = req.user || {};

  return {
    request_id: requestId,
    method,
    route: routePath ? `${baseUrl}${routePath}`.replace(/\/{2,}/g, '/') : originalUrl,
    path: originalUrl,
    tenant_id: req.tenantId ?? user.id_cadastro ?? user.cadastro?.id_cadastro ?? null,
    user_id: user.sub ?? user.id_usuario ?? null,
    login: typeof user.login === 'string' && user.login.trim() ? user.login.trim() : undefined,
    profiles: Array.isArray(user.profiles) ? user.profiles : undefined,
    ip: req.ip || req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || null
  };
}

function getSourceContext(source = {}) {
  return {
    request_id: source.requestId || source.id || source.headers?.['x-request-id'] || null,
    tenant_id: source.tenantId ?? source.tenant_id ?? source.user?.id_cadastro ?? source.user?.cadastro?.id_cadastro ?? null,
    user_id: source.user?.sub ?? source.user?.id_usuario ?? null,
    login: typeof source.user?.login === 'string' && source.user.login.trim() ? source.user.login.trim() : undefined
  };
}

function logWithRequest(level, message, req, meta = {}) {
  write(level, message, { ...getRequestContext(req), ...meta });
}

function logEvent(level, message, source = {}, meta = {}) {
  write(level, message, { ...getSourceContext(source), ...meta });
}

module.exports = {
  logger: {
    error: (message, meta) => write('error', message, meta),
    warn: (message, meta) => write('warn', message, meta),
    info: (message, meta) => write('info', message, meta),
    debug: (message, meta) => write('debug', message, meta)
  },
  createRequestId,
  getRequestContext,
  getSourceContext,
  logWithRequest,
  logEvent
};
