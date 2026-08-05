const router = require('express').Router();
const { authenticate, requireProfiles } = require('../../middlewares/auth');
const { validatePositiveIdParam, validatePeopleListQuery, validatePersonCreateBody, validatePersonUpdateBody } = require('../../middlewares/requestValidation');
const { PERMISSIONS } = require('../../config/permissions');
const {
  listController,
  getController,
  createController,
  updateController
} = require('./controller');
const { asyncHandler } = require('../../utils/asyncHandler');

router.use(authenticate);
router.get('/', validatePeopleListQuery, asyncHandler(listController));
router.get('/:id', validatePositiveIdParam('id', 'people'), asyncHandler(getController));
router.post('/', requireProfiles(...PERMISSIONS.PEOPLE_WRITE), validatePersonCreateBody, asyncHandler(createController));
router.put('/:id', requireProfiles(...PERMISSIONS.PEOPLE_WRITE), validatePositiveIdParam('id', 'people'), validatePersonUpdateBody, asyncHandler(updateController));

module.exports = { peopleRouter: router };
