const { Pool } = require('pg');
const { env } = require('../config/env');

const ssl = env.nodeEnv === 'production'
  ? { rejectUnauthorized: false }
  : false;

const pool = new Pool({
  connectionString: env.databaseUrl || undefined,
  ssl
});

module.exports = { pool };
