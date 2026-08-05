const { env } = require('./env');

function isOriginAllowed(origin) {
  if (!origin) return true;
  if (env.corsOrigins.length === 0) return true;
  return env.corsOrigins.includes(origin);
}

function corsOptionsDelegate(req, callback) {
  const origin = req.header('Origin');
  const isAllowed = isOriginAllowed(origin);

  callback(null, {
    origin: isAllowed,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  });
}

module.exports = { corsOptionsDelegate };
