window.APP_CONFIG = Object.freeze({
  ...(window.APP_CONFIG || {}),
  apiBaseUrls: Object.freeze({
    local: 'http://localhost:3000/api/v1',
    production: 'https://ebd-fj9u.onrender.com/api/v1'
  }),
  resolveApiBaseUrl() {
    const { hostname, protocol } = window.location;
    const isLocalhost =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '[::1]' ||
      protocol === 'file:';

    return isLocalhost ? this.apiBaseUrls.local : this.apiBaseUrls.production;
  }
});
