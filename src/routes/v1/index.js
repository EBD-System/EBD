// Official API v1 router.
// New endpoints must be added here, not in the legacy compatibility router.

const router = require('express').Router();

const { healthRouter } = require('../health.routes');
const { authRouter } = require('../../modules/auth/routes');
const { peopleRouter } = require('../../modules/pessoas/routes');
const { classesRouter } = require('../../modules/classes/routes');
const { studentsRouter } = require('../../modules/alunos/routes');
const { attendanceRouter } = require('../../modules/chamadas/routes');
const { reportsRouter } = require('../../modules/relatorios/routes');

router.use(healthRouter);
router.use('/auth', authRouter);
router.use('/people', peopleRouter);
router.use('/classes', classesRouter);
router.use('/students', studentsRouter);
router.use('/attendance', attendanceRouter);
router.use('/reports', reportsRouter);

module.exports = { router };
