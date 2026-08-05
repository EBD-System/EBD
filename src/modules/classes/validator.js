// Validator canônico do módulo; reutiliza as validações compartilhadas.
const { validatePositiveIdParam, validateClassListQuery } = require('../../middlewares/requestValidation');

module.exports = { validatePositiveIdParam, validateClassListQuery };