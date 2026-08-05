// Validator canônico do módulo; reutiliza as validações compartilhadas.
const {
  validatePositiveIdParam,
  validateStudentsListQuery,
  validateStudentInactiveReasonsQuery,
  validateStudentEnrollBody,
  validateStudentObservationBody,
  validateStudentInactivateBody,
  validateStudentTransferBody
} = require('../../middlewares/requestValidation');

module.exports = {
  validatePositiveIdParam,
  validateStudentsListQuery,
  validateStudentInactiveReasonsQuery,
  validateStudentEnrollBody,
  validateStudentObservationBody,
  validateStudentInactivateBody,
  validateStudentTransferBody
};