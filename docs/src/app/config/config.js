(function initAppConfig(root) {
  const globalObject = root || (typeof globalThis !== 'undefined' ? globalThis : {});

  const defaultConfig = {
    developmentMode: false,
    developmentVisibleModuleTitles: ['Classes', 'Relatórios'],
    developmentHideClassIntro: true,
    developmentHideClassStatus: true
  };

  // Ajustes editáveis no próprio arquivo. O ambiente pode sobrescrever depois.
  const fileConfig = {
    developmentMode: false,
    developmentVisibleModuleTitles: ['Classes', 'Relatórios'],
    developmentHideClassIntro: true,
    developmentHideClassStatus: true
  };

  const runtimeConfig =
    globalObject.APP_RUNTIME_CONFIG && typeof globalObject.APP_RUNTIME_CONFIG === 'object'
      ? globalObject.APP_RUNTIME_CONFIG
      : {};

  const mergedConfig = {
    ...defaultConfig,
    ...fileConfig,
    ...runtimeConfig
  };

  mergedConfig.developmentVisibleModuleTitles = normalizeStringList(
    mergedConfig.developmentVisibleModuleTitles,
    defaultConfig.developmentVisibleModuleTitles
  );

  const normalizedConfig = Object.freeze({
    ...mergedConfig,
    developmentVisibleModuleTitles: Object.freeze(mergedConfig.developmentVisibleModuleTitles),
    isVisibleModule(title) {
      if (this.developmentMode !== false) {
        return true;
      }

      return this.developmentVisibleModuleTitles.includes(String(title || '').trim());
    },
    shouldHideClassIntro() {
      return Boolean(this.developmentMode === false && this.developmentHideClassIntro);
    },
    shouldHideClassStatus() {
      return Boolean(this.developmentMode === false && this.developmentHideClassStatus);
    }
  });

  globalObject.APP_CONFIG = Object.freeze({
    ...(globalObject.APP_CONFIG || {}),
    ...normalizedConfig
  });

  function normalizeStringList(value, fallback = []) {
    const source = Array.isArray(value) ? value : fallback;
    return source
      .map((item) => String(item || '').trim())
      .filter(Boolean);
  }
})(typeof window !== 'undefined' ? window : globalThis);
