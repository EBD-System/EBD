// Validator canônico do módulo; reutiliza as validações compartilhadas.
const {
  validateAttendanceOpenBody,
  validateAttendanceClassParams,
  validateAttendanceCallParams,
  validateAttendanceChangeBody,
  validateAttendanceBatchChangeBody,
  validateAttendanceVisitorBody,
  validateAttendanceOfferBody,
  validateReportsDateQuery
} = require('../../middlewares/requestValidation');

module.exports = {
  validateAttendanceOpenBody,
  validateAttendanceClassParams,
  validateAttendanceCallParams,
  validateAttendanceChangeBody,
  validateAttendanceBatchChangeBody,
  validateAttendanceVisitorBody,
  validateAttendanceOfferBody,
  validateReportsDateQuery
};