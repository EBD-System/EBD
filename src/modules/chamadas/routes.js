const router = require('express').Router();
const { authenticate, requireProfiles } = require('../../middlewares/auth');
const { validateAttendanceOpenBody, validateAttendanceClassParams, validateAttendanceCallParams, validateAttendanceChangeBody, validateAttendanceBatchChangeBody, validateAttendanceVisitorBody, validateAttendanceOfferBody, validateAttendanceSummaryBody, validateReportsDateQuery } = require('../../middlewares/requestValidation');
const { PERMISSIONS } = require('../../config/permissions');
const {
  openController,
  classAttendanceController,
  changeStatusController,
  batchChangeStatusController,
  presentAllController,
  absentAllController,
  closeController,
  reopenController,
  visitorController,
  offerController,
  saveSummaryController,
  summaryController,
  classSummaryController
} = require('./controller');
const { asyncHandler } = require('../../utils/asyncHandler');

router.use(authenticate);
router.get('/summary', validateReportsDateQuery, asyncHandler(summaryController));
router.get('/classes/:classId', validateAttendanceClassParams, validateReportsDateQuery, asyncHandler(classAttendanceController));
router.get('/classes/:classId/summary', validateAttendanceClassParams, validateReportsDateQuery, asyncHandler(classSummaryController));
router.post('/open', requireProfiles(...PERMISSIONS.ATTENDANCE_ADMIN), validateAttendanceOpenBody, asyncHandler(openController));
router.patch('/:callId', requireProfiles(...PERMISSIONS.ATTENDANCE_WRITE), validateAttendanceCallParams, validateAttendanceBatchChangeBody, asyncHandler(batchChangeStatusController));
router.patch('/:callId/students/:studentClassId', requireProfiles(...PERMISSIONS.ATTENDANCE_WRITE), validateAttendanceCallParams, validateAttendanceChangeBody, asyncHandler(changeStatusController));
router.post('/:callId/present-all', requireProfiles(...PERMISSIONS.ATTENDANCE_WRITE), validateAttendanceCallParams, asyncHandler(presentAllController));
router.post('/:callId/absent-all', requireProfiles(...PERMISSIONS.ATTENDANCE_WRITE), validateAttendanceCallParams, asyncHandler(absentAllController));
router.post('/:callId/close', requireProfiles(...PERMISSIONS.ATTENDANCE_WRITE), validateAttendanceCallParams, asyncHandler(closeController));
router.post('/:callId/reopen', requireProfiles(...PERMISSIONS.ATTENDANCE_ADMIN), validateAttendanceCallParams, asyncHandler(reopenController));
router.put('/:callId/summary', requireProfiles(...PERMISSIONS.ATTENDANCE_WRITE, ...PERMISSIONS.OFFERS_WRITE), validateAttendanceCallParams, validateAttendanceSummaryBody, asyncHandler(saveSummaryController));
router.patch('/:callId/summary', requireProfiles(...PERMISSIONS.ATTENDANCE_WRITE, ...PERMISSIONS.OFFERS_WRITE), validateAttendanceCallParams, validateAttendanceSummaryBody, asyncHandler(saveSummaryController));
router.post('/:callId/visitors', requireProfiles(...PERMISSIONS.ATTENDANCE_WRITE), validateAttendanceCallParams, validateAttendanceVisitorBody, asyncHandler(visitorController));
router.post('/:callId/offers', requireProfiles(...PERMISSIONS.OFFERS_WRITE), validateAttendanceCallParams, validateAttendanceOfferBody, asyncHandler(offerController));

module.exports = { attendanceRouter: router };
