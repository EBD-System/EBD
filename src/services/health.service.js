const { pingDatabase } = require('../repositories/health.repository');

async function getHealth() {
  const database = await pingDatabase();
  return {
    ok: true,
    service: 'ebd-api',
    database,
    timestamp: new Date().toISOString()
  };
}

module.exports = { getHealth };
