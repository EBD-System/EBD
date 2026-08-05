(function initRelatoriosService(root) {
  const globalObject = root || (typeof globalThis !== 'undefined' ? globalThis : {});
  const APP_CONFIG = globalObject.APP_CONFIG || {};
  const APP_API_CLIENT = globalObject.APP_API_CLIENT;

  const API_BASE_URL =
    typeof APP_CONFIG.resolveApiBaseUrl === 'function'
      ? APP_CONFIG.resolveApiBaseUrl()
      : `${globalObject.location?.protocol || 'http:'}//${globalObject.location?.hostname || 'localhost'}${globalObject.location?.port ? `:${globalObject.location.port}` : ''}/api/v1`;

  const REPORTS_ENDPOINT = `${API_BASE_URL}/reports/period`;

  // BACKEND_ENDPOINT_PLACEHOLDER:
  // O frontend atual baixa o PDF diretamente a partir do snapshot preservado.
  // Este endpoint fica como referência/fallback futuro para quando o backend passar a assumir a geração.
  const REPORT_PDF_ENDPOINT = `${API_BASE_URL}/reports/period/pdf`;

  const service = {
    endpoints: Object.freeze({
      report: REPORTS_ENDPOINT,
      pdf: REPORT_PDF_ENDPOINT
    }),

    async searchByPeriod({ startDate, endDate, token } = {}) {
      if (!isIsoDate(startDate) || !isIsoDate(endDate)) {
        return {
          found: false,
          reason: 'Informe uma data inicial e uma data final válidas.'
        };
      }

      if (startDate > endDate) {
        return {
          found: false,
          reason: 'A data inicial não pode ser maior que a data final.'
        };
      }

      if (!token) {
        const sessionError = new Error('Sua sessão expirou. Faça login novamente.');
        sessionError.status = 401;
        sessionError.requiresRelogin = true;
        throw sessionError;
      }

      const url = `${REPORTS_ENDPOINT}?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const payload = await APP_API_CLIENT.safeJson(response);
      if (!response.ok || APP_API_CLIENT.isFailurePayload?.(payload) || payload?.ok === false) {
        throw APP_API_CLIENT.createApiError(response, payload, {
          fallbackMessage: 'Não foi possível consultar o relatório.'
        });
      }

      const report = payload?.data || null;
      const activities = Array.isArray(report?.activities) ? report.activities : [];

      if (!report || activities.length === 0) {
        return {
          found: false,
          reason: 'Nenhum relatório encontrado para o período informado.'
        };
      }

      return {
        found: true,
        report: deepFreeze(cloneValue(report))
      };
    },

    createPdfSnapshot(report) {
      // Snapshot canônico da consulta: reutilizado pela renderização da tela e pela geração do PDF.
      return cloneValue(report);
    }
  };

  globalObject.APP_REPORTS_SERVICE = Object.freeze(service);

  function isIsoDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
  }

  function cloneValue(value) {
    if (typeof structuredClone === 'function') {
      return structuredClone(value);
    }

    return JSON.parse(JSON.stringify(value));
  }

  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
      return value;
    }

    Object.freeze(value);
    Object.values(value).forEach((entry) => deepFreeze(entry));
    return value;
  }
})(typeof window !== 'undefined' ? window : globalThis);
