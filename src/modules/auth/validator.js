// Validator canônico do módulo; reutiliza as validações compartilhadas.
const { validateLoginBody } = require('../../middlewares/requestValidation');

module.exports = { validateLoginBody };