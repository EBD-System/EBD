const router = require('express').Router();
const { health } = require('../controllers/health.controller');
const { asyncHandler } = require('../utils/asyncHandler');

router.get('/', asyncHandler(health));
router.get('/health', asyncHandler(health));

module.exports = { healthRouter: router };
