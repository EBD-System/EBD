function formatDateInTimeZone(value, timeZone = 'America/Bahia') {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString('en-CA', { timeZone });
}

function todayISO() {
  return formatDateInTimeZone(new Date());
}

function isValidISODate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function pickDate(value, fallback = todayISO()) {
  return isValidISODate(value) ? value : fallback;
}

function isSameCivilDay(left, right, timeZone = 'America/Bahia') {
  return formatDateInTimeZone(left, timeZone) === formatDateInTimeZone(right, timeZone);
}

module.exports = {
  todayISO,
  isValidISODate,
  pickDate,
  formatDateInTimeZone,
  isSameCivilDay
};
