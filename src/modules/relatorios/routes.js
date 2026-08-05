const router = require('express').Router();
const { authenticate } = require('../../middlewares/auth');
const { validateReportsDateQuery } = require('../../middlewares/requestValidation');
const { validateReportsPeriodQuery } = require('./validator');
const {
  presenceRankingController,
  visitorRankingController,
  offerRankingController,
  birthdaysController,
  periodReportController
} = require('./controller');
const { asyncHandler } = require('../../utils/asyncHandler');

router.use(authenticate);
router.get('/period', validateReportsPeriodQuery, asyncHandler(periodReportController));
router.get('/presence-ranking', validateReportsDateQuery, asyncHandler(presenceRankingController));
router.get('/visitors-ranking', validateReportsDateQuery, asyncHandler(visitorRankingController));
router.get('/offers-ranking', validateReportsDateQuery, asyncHandler(offerRankingController));
router.get('/birthdays', validateReportsDateQuery, asyncHandler(birthdaysController));

module.exports = { reportsRouter: router };
