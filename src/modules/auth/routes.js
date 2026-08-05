const router = require('express').Router();
const { authenticate } = require('../../middlewares/auth');
const { validateLoginBody } = require('../../middlewares/requestValidation');
const { loginController, meController } = require('./controller');
const { asyncHandler } = require('../../utils/asyncHandler');

router.post('/login', validateLoginBody, asyncHandler(loginController));
// Registro público removido: mutação sem autenticação descontinuada.
router.get('/me', authenticate, asyncHandler(meController));

module.exports = { authRouter: router };
