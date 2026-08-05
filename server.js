const { app } = require('./src/app');
const { env } = require('./src/config/env');
const { logger } = require('./src/utils/logger');
const { ensureAttendanceSummaryVisitorsColumn } = require('./src/db/migrations');

async function start() {
  try {
    await ensureAttendanceSummaryVisitorsColumn();
    app.listen(env.port, () => {
      logger.info('server.started', { port: env.port, node_env: env.nodeEnv });
    });
  } catch (error) {
    logger.error('server.start_failed', {
      message: error?.message || 'Falha ao iniciar o servidor.',
      stack: error?.stack || null
    });
    process.exit(1);
  }
}

void start();
