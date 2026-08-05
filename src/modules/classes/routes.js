const router = require('express').Router();
const { authenticate } = require('../../middlewares/auth');
const { validatePositiveIdParam, validateClassListQuery } = require('../../middlewares/requestValidation');
const {
  listController,
  getController,
  studentsController,
  attendanceController
} = require('./controller');
const { asyncHandler } = require('../../utils/asyncHandler');

router.use(authenticate);
router.get('/', validateClassListQuery, asyncHandler(listController));
router.get('/:id', validatePositiveIdParam('id', 'classes'), asyncHandler(getController));
router.get('/:id/students', validatePositiveIdParam('id', 'classes'), asyncHandler(studentsController));
router.get('/:id/attendance', validatePositiveIdParam('id', 'classes'), asyncHandler(attendanceController));

module.exports = { classesRouter: router };
