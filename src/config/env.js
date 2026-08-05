require('dotenv').config();

function parseOrigins(value) {
  if (!value) return [];
  return value.split(',').map((origin) => origin.trim()).filter(Boolean);
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  corsOrigins: parseOrigins(process.env.CORS_ORIGINS),
  timezone: process.env.TZ || 'America/Bahia'
};

if (!env.databaseUrl) {
  // A API pode subir, mas qualquer rota que dependa do banco vai falhar com erro claro.
  // Em produção, DATABASE_URL deve estar sempre definido.
}

module.exports = { env };
