// Validator canônico do módulo; reutiliza as validações compartilhadas.
const { validateReportsDateQuery, validateReportsPeriodQuery } = require('../../middlewares/requestValidation');

module.exports = { validateReportsDateQuery, validateReportsPeriodQuery };
