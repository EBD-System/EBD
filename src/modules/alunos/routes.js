const router = require('express').Router();
const { authenticate, requireProfiles } = require('../../middlewares/auth');
const { validatePositiveIdParam, validateStudentsListQuery, validateStudentInactiveReasonsQuery, validateStudentEnrollBody, validateStudentObservationBody, validateStudentInactivateBody, validateStudentTransferBody } = require('../../middlewares/requestValidation');
const { PERMISSIONS } = require('../../config/permissions');
const {
  listController,
  getController,
  enrollController,
  activateController,
  inactivateController,
  updateObservationController,
  transferController,
  historyController,
  statusHistoryController,
  classesController,
  inactiveReasonsController
} = require('./controller');
const { asyncHandler } = require('../../utils/asyncHandler');

router.use(authenticate);
router.get('/', validateStudentsListQuery, asyncHandler(listController));
router.get('/inactive', (req, _res, next) => {
  req.query = { ...(req.query || {}), inactive: true };
  return next();
}, validateStudentsListQuery, asyncHandler(listController));
router.get('/inactive-reasons', validateStudentInactiveReasonsQuery, asyncHandler(inactiveReasonsController));
router.get('/:id', validatePositiveIdParam('id', 'students'), asyncHandler(getController));
router.get('/:id/history', validatePositiveIdParam('id', 'students'), asyncHandler(historyController));
router.get('/:id/status-history', validatePositiveIdParam('id', 'students'), asyncHandler(statusHistoryController));
router.get('/:id/classes', validatePositiveIdParam('id', 'students'), asyncHandler(classesController));
router.post('/enroll', requireProfiles(...PERMISSIONS.STUDENTS_WRITE), validateStudentEnrollBody, asyncHandler(enrollController));
router.put('/:id/activate', requireProfiles(...PERMISSIONS.STUDENTS_WRITE), validatePositiveIdParam('id', 'students'), validateStudentObservationBody, asyncHandler(activateController));
router.put('/:id/inactivate', requireProfiles(...PERMISSIONS.STUDENTS_WRITE), validatePositiveIdParam('id', 'students'), validateStudentInactivateBody, asyncHandler(inactivateController));
router.put('/:id/observation', requireProfiles(...PERMISSIONS.STUDENTS_WRITE), validatePositiveIdParam('id', 'students'), validateStudentObservationBody, asyncHandler(updateObservationController));
router.put('/:id/transfer', requireProfiles(...PERMISSIONS.STUDENTS_WRITE), validatePositiveIdParam('id', 'students'), validateStudentTransferBody, asyncHandler(transferController));

module.exports = { studentsRouter: router };
