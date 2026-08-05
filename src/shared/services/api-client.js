(function initApiClient(root) {
  const globalObject = root || (typeof globalThis !== 'undefined' ? globalThis : {});

  function isDevelopmentMode() {
    return Boolean(globalObject.APP_ERROR_CONFIG && globalObject.APP_ERROR_CONFIG.errorDevelopmentMode);
  }

  function normalizeText(value) {
    if (value === undefined || value === null) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
    return '';
  }

  function safeJson(response) {
    return response.text().then((text) => {
      if (!text) return null;

      try {
        return JSON.parse(text);
      } catch {
        return { message: text };
      }
    });
  }

  function collectMessages(value, bucket, seen) {
    if (value === undefined || value === null) return;

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      const text = normalizeText(value);
      if (text && !bucket.includes(text)) {
        bucket.push(text);
      }
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        collectMessages(item, bucket, seen);
      }
      return;
    }

    if (typeof value !== 'object') return;

    if (seen.has(value)) return;
    seen.add(value);

    const directKeys = ['message', 'error', 'detail', 'reason', 'title', 'description', 'summary', 'hint'];
    for (const key of directKeys) {
      if (!(key in value)) continue;
      const entry = value[key];
      if (typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean') {
        const text = normalizeText(entry);
        if (text && !bucket.includes(text)) {
          bucket.push(text);
        }
      } else if (Array.isArray(entry) || (entry && typeof entry === 'object')) {
        collectMessages(entry, bucket, seen);
      }
    }

    const arrayLikeKeys = ['errors', 'details', 'violations', 'issues', 'messages', 'causes'];
    for (const key of arrayLikeKeys) {
      if (Array.isArray(value[key])) {
        collectMessages(value[key], bucket, seen);
      }
    }

    const nestedKeys = ['data', 'result', 'payload', 'body', 'response', 'errorData'];
    for (const key of nestedKeys) {
      const nested = value[key];
      if (nested && typeof nested === 'object') {
        collectMessages(nested, bucket, seen);
      }
    }

    if (value.fieldErrors && typeof value.fieldErrors === 'object') {
      for (const [field, entry] of Object.entries(value.fieldErrors)) {
        collectMessages({ message: `${field}: ${entry}` }, bucket, seen);
      }
    }

    if (value.validation && typeof value.validation === 'object') {
      collectMessages(value.validation, bucket, seen);
    }
  }

  function extractMessages(payload) {
    const messages = [];
    collectMessages(payload, messages, new Set());
    return messages.filter(Boolean);
  }

  function extractPrimaryMessage(payload) {
    return extractMessages(payload)[0] || '';
  }

  function isFailurePayload(payload) {
    return Boolean(payload && typeof payload === 'object' && payload.ok === false);
  }

  function extractDetailMessage(payload) {
    const messages = extractMessages(payload);
    return messages.slice(1).join(' | ');
  }

  function friendlyMessageForStatus(status, fallbackMessage = 'Não foi possível concluir a solicitação.') {
    const normalizedStatus = Number(status);

    switch (normalizedStatus) {
      case 400:
      case 422:
        return 'Verifique os dados informados e tente novamente.';
      case 401:
        return 'Sua sessão expirou. Faça login novamente.';
      case 403:
        return 'Você não tem permissão para executar esta ação.';
      case 404:
        return 'O recurso solicitado não foi encontrado.';
      case 409:
        return 'Não foi possível concluir porque o registro já está em um estado diferente.';
      case 500:
      case 502:
      case 503:
        return 'O servidor encontrou um problema. Tente novamente em instantes.';
      default:
        return fallbackMessage || 'Não foi possível concluir a solicitação.';
    }
  }

  function buildApiErrorMessage({ status, payload, fallbackMessage = 'Não foi possível concluir a solicitação.', context = '' } = {}) {
    const primaryMessage = extractPrimaryMessage(payload) || fallbackMessage || friendlyMessageForStatus(status, fallbackMessage);
    const detailMessage = extractDetailMessage(payload);
    const numericStatus = Number(status) || 0;

    if (numericStatus >= 200 && numericStatus < 300 && extractPrimaryMessage(payload)) {
      return context ? `${context}: ${primaryMessage}` : primaryMessage;
    }

    if (isDevelopmentMode()) {
      const prefix = numericStatus > 0 ? `HTTP ${numericStatus}` : 'Erro';
      const head = context ? `${context}: ${prefix} — ${primaryMessage}` : `${prefix} — ${primaryMessage}`;
      return detailMessage ? `${head} | ${detailMessage}` : head;
    }

    return friendlyMessageForStatus(status, fallbackMessage || primaryMessage);
  }

  function createApiError(response, payload, options = {}) {
    const status = Number(response?.status || options.status || 0);
    const message = buildApiErrorMessage({
      status,
      payload,
      fallbackMessage: options.fallbackMessage,
      context: options.context || ''
    });

    const error = new Error(message);
    error.status = status;
    error.payload = payload;
    error.isApiError = true;
    error.requiresRelogin = status === 401;
    error.primaryMessage = extractPrimaryMessage(payload);
    error.backendMessage = error.primaryMessage;
    error.detailMessage = extractDetailMessage(payload);
    return error;
  }

  function normalizeFailureItem(item) {
    if (!item) return { label: 'item', status: 0, message: '', error: null };

    const label =
      normalizeText(item.label) ||
      normalizeText(item.name) ||
      normalizeText(item.student?.name) ||
      normalizeText(item.student?.nome) ||
      'item';

    const error = item.error && typeof item.error === 'object' ? item.error : null;
    const status = Number(item.status || error?.status || 0);
    const message =
      normalizeText(item.message) ||
      normalizeText(item.reason) ||
      normalizeText(error?.message) ||
      normalizeText(error?.primaryMessage) ||
      friendlyMessageForStatus(status, 'Falha desconhecida');

    return { label, status, message, error };
  }

  function stripDevStatusPrefix(message, status) {
    const text = normalizeText(message);
    if (!text) return '';

    const statusText = Number(status) > 0 ? String(Number(status)) : '';
    const patterns = [
      /^HTTP\s+\d+\s+[—:-]\s+/i,
      /^HTTP\s+\?\s+[—:-]\s+/i
    ];

    if (statusText) {
      patterns.push(new RegExp(`^${statusText}\\s*[—:-]\\s+`));
      patterns.push(new RegExp(`^HTTP\\s+${statusText}\\s*[—:-]\\s+`, 'i'));
    }

    for (const pattern of patterns) {
      if (pattern.test(text)) {
        return text.replace(pattern, '');
      }
    }

    return text;
  }

  function formatFailureMessage(failure) {
    const status = Number(failure?.status || failure?.error?.status || 0);
    const rawMessage =
      normalizeText(failure?.message) ||
      normalizeText(failure?.reason) ||
      normalizeText(failure?.error?.message) ||
      normalizeText(failure?.error?.primaryMessage) ||
      '';

    if (!isDevelopmentMode()) {
      return rawMessage || friendlyMessageForStatus(status, 'Falha desconhecida');
    }

    if (!rawMessage) {
      const primary = normalizeText(failure?.error?.primaryMessage) || friendlyMessageForStatus(status, 'Falha desconhecida');
      const detail = normalizeText(failure?.error?.detailMessage);
      return `HTTP ${status || '?'} — ${primary}${detail ? ` | ${detail}` : ''}`;
    }

    if (/^HTTP\s+\d+\s+[—:-]\s+/i.test(rawMessage) || /^HTTP\s+\?\s+[—:-]\s+/i.test(rawMessage)) {
      return rawMessage;
    }

    return `HTTP ${status || '?'} — ${rawMessage}`;
  }

  function summarizeBatchFailures({ total, failures = [], subject = 'status' } = {}) {
    const normalizedFailures = failures.map(normalizeFailureItem);
    const failureCount = normalizedFailures.length;
    const summaryBase = `${failureCount} de ${total} ${subject} não foram salvos.`;

    if (!failureCount) {
      return {
        message: `${summaryBase} Nenhum detalhe adicional foi registrado.`,
        status: 0,
        requiresRelogin: false
      };
    }

    const requiresRelogin = normalizedFailures.some((failure) => failure.status === 401);
    const status = normalizedFailures.find((failure) => Number.isFinite(failure.status) && failure.status > 0)?.status || (requiresRelogin ? 401 : 0);

    if (isDevelopmentMode()) {
      const preview = normalizedFailures
        .map((failure) => `${failure.label}: ${formatFailureMessage(failure)}`)
        .join(' | ');

      return {
        message: `${summaryBase} ${preview}`,
        status,
        requiresRelogin
      };
    }

    return {
      message: `${summaryBase} Verifique os itens afetados e tente novamente.`,
      status,
      requiresRelogin
    };
  }

  function buildValidationMessage(message, fallbackMessage = 'Verifique os campos informados.') {
    const primary = normalizeText(message) || fallbackMessage;
    return isDevelopmentMode() ? primary : fallbackMessage;
  }

  const apiClient = Object.freeze({
    isDevelopmentMode,
    safeJson,
    normalizeText,
    extractMessages,
    extractPrimaryMessage,
    extractDetailMessage,
    friendlyMessageForStatus,
    buildApiErrorMessage,
    createApiError,
    summarizeBatchFailures,
    buildValidationMessage,
    isFailurePayload
  });

  globalObject.APP_API_CLIENT = apiClient;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = apiClient;
  }
})(typeof window !== 'undefined' ? window : globalThis);
