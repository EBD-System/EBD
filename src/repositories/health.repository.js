const { query } = require('../db');

async function pingDatabase() {
  const result = await query('SELECT 1 AS ok');
  return result.rows[0]?.ok === 1;
}

module.exports = { pingDatabase };
