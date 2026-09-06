const BUSINESS_TIME_ZONE = 'America/Bahia';

function todayISO() {
  return new Date().toLocaleDateString('en-CA', { timeZone: BUSINESS_TIME_ZONE });
}

function isValidISODate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function pickDate(value, fallback = todayISO()) {
  return isValidISODate(value) ? value : fallback;
}

module.exports = {
  BUSINESS_TIME_ZONE,
  todayISO,
  isValidISODate,
  pickDate
};
