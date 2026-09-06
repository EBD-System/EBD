window.APP_STORAGE_KEYS = Object.freeze({
  token: 'auth:token',
  username: 'auth:remembered-username'
});

window.APP_AUTH_STORAGE = Object.freeze({
  readToken(key = window.APP_STORAGE_KEYS.token) {
    try {
      const raw = window.sessionStorage.getItem(key);
      if (!raw) return '';

      const parsed = JSON.parse(raw);

      if (typeof parsed === 'string') {
        return parsed.trim();
      }

      if (parsed && typeof parsed === 'object') {
        return String(
          parsed.token ||
          parsed.accessToken ||
          parsed.data?.token ||
          parsed.data?.accessToken ||
          parsed.result?.token ||
          parsed.result?.accessToken ||
          parsed.auth?.token ||
          ''
        ).trim();
      }

      return String(raw).trim();
    } catch {
      try {
        return String(window.sessionStorage.getItem(key) || '').trim();
      } catch {
        return '';
      }
    }
  },

  writeToken(token, key = window.APP_STORAGE_KEYS.token) {
    window.sessionStorage.setItem(key, String(token || '').trim());
  },

  clearToken(key = window.APP_STORAGE_KEYS.token) {
    window.sessionStorage.removeItem(key);
  }
});
