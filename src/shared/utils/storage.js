function readJSON(key, fallback = null) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function removeStorageKey(key) {
  window.localStorage.removeItem(key);
}

module.exports = {
  readJSON,
  writeJSON,
  removeStorageKey
};
