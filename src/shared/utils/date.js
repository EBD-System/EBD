function todayISO() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bahia' });
}

function isValidISODate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function pickDate(value, fallback = todayISO()) {
  return isValidISODate(value) ? value : fallback;
}

module.exports = {
  todayISO,
  isValidISODate,
  pickDate
};
