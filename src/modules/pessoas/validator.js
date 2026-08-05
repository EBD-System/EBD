// Validator canônico do módulo; reutiliza as validações compartilhadas.
const {
  validatePeopleListQuery,
  validatePersonCreateBody,
  validatePersonUpdateBody
} = require('../../middlewares/requestValidation');

module.exports = {
  validatePeopleListQuery,
  validatePersonCreateBody,
  validatePersonUpdateBody
};