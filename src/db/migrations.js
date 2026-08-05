const { query } = require('./index');
const { logger } = require('../utils/logger');

async function ensureAttendanceSummaryVisitorsColumn() {
  const check = await query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'ebd_chamada'
        AND column_name = 'visitantes'
    ) AS exists
  `);

  const exists = Boolean(check.rows[0]?.exists);
  if (exists) {
    return false;
  }

  await query(`
    ALTER TABLE public.ebd_chamada
      ADD COLUMN visitantes integer NOT NULL DEFAULT 0
  `);

  await query(`
    UPDATE public.ebd_chamada ch
       SET visitantes = COALESCE(v.total_visitantes, 0)
      FROM (
        SELECT
          id_chamada,
          COUNT(*)::integer AS total_visitantes
        FROM public.ebd_chamada_visitante
        GROUP BY id_chamada
      ) v
     WHERE v.id_chamada = ch.id_chamada
  `);

  logger.info('db.migration.completed', {
    migration: 'attendance_summary_visitors_column'
  });

  return true;
}

module.exports = {
  ensureAttendanceSummaryVisitorsColumn
};
