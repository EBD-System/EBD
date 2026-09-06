'use strict';

function stripNonDigits(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/\D/g, '');
}

module.exports = {
  stripNonDigits
};
