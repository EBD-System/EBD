(function initMelhorAlunoGeralService(root) {
  const globalObject = root || (typeof globalThis !== 'undefined' ? globalThis : {});
  const APP_CONFIG = globalObject.APP_CONFIG || {};
  const APP_API_CLIENT = globalObject.APP_API_CLIENT;

  const API_BASE_URL =
    typeof APP_CONFIG.resolveApiBaseUrl === 'function'
      ? APP_CONFIG.resolveApiBaseUrl()
      : `${globalObject.location?.protocol || 'http:'}//${globalObject.location?.hostname || 'localhost'}${globalObject.location?.port ? `:${globalObject.location.port}` : ''}/api/v1`;

  const RANKING_ENDPOINTS = Object.freeze([
    `${API_BASE_URL}/reports/students-ranking`,
    `${API_BASE_URL}/reports/student-ranking`,
    `${API_BASE_URL}/reports/best-students-ranking`
  ]);

  const service = {
    endpoints: Object.freeze({
      ranking: RANKING_ENDPOINTS[0],
      aliases: Object.freeze([...RANKING_ENDPOINTS.slice(1)])
    }),

    async fetchStudentsRanking({ token } = {}) {
      if (!token) {
        const sessionError = new Error('Sua sessão expirou. Faça login novamente.');
        sessionError.status = 401;
        sessionError.requiresRelogin = true;
        throw sessionError;
      }

      let lastError = null;

      for (const endpoint of RANKING_ENDPOINTS) {
        try {
          const response = await fetch(endpoint, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });

          const payload = await APP_API_CLIENT.safeJson(response);

          if (!response.ok || APP_API_CLIENT.isFailurePayload?.(payload) || payload?.ok === false) {
            const apiError = APP_API_CLIENT.createApiError(response, payload, {
              fallbackMessage: 'Não foi possível consultar o ranking geral de alunos.'
            });

            if (shouldTryNextEndpoint(apiError)) {
              lastError = apiError;
              continue;
            }

            throw apiError;
          }

          const ranking = normalizeRanking(payload);

          if (!ranking.length) {
            return {
              found: false,
              reason: 'Nenhum aluno encontrado no ranking geral.'
            };
          }

          return {
            found: true,
            ranking: deepFreeze(cloneValue(ranking))
          };
        } catch (error) {
          if (shouldTryNextEndpoint(error)) {
            lastError = error;
            continue;
          }

          throw error;
        }
      }

      if (lastError) {
        throw lastError;
      }

      return {
        found: false,
        reason: 'Não foi possível consultar o ranking geral de alunos.'
      };
    }
  };

  globalObject.APP_MELHOR_ALUNO_GERAL_SERVICE = Object.freeze(service);

  function normalizeRanking(payload) {
    const source = extractRankingSource(payload);
    return source
      .map((item, index) => normalizeRankingItem(item, index))
      .filter(Boolean)
      .slice(0, 10);
  }

  function extractRankingSource(payload) {
    const data = payload?.data ?? payload?.result ?? payload?.payload ?? payload?.body ?? payload?.response ?? payload;

    if (Array.isArray(data)) {
      return data;
    }

    if (data && typeof data === 'object') {
      for (const key of ['ranking', 'students', 'items', 'rows', 'list', 'data']) {
        if (Array.isArray(data[key])) {
          return data[key];
        }
      }
    }

    return [];
  }

  function normalizeRankingItem(item, index) {
    if (!item || typeof item !== 'object') {
      return null;
    }

    const nome = firstText(item, [
      'nome',
      'name',
      'student_name',
      'aluno',
      'nome_aluno',
      'student',
      'studentName'
    ]);

    const classe = firstText(item, [
      'classe',
      'class',
      'turma',
      'nome_classe',
      'class_name',
      'nomeClasse',
      'turma_nome',
      'className'
    ]);

    const percentualPresenca = firstValue(item, [
      'percentual_presenca',
      'percentualPresenca',
      'presence_percentage',
      'presencePercent',
      'percentual',
      'presenca',
      'attendance_percentage',
      'attendancePercent'
    ]);

    return {
      position: index + 1,
      nome: nome || 'Aluno sem nome',
      classe: classe || '—',
      percentual_presenca: formatPercentual(percentualPresenca)
    };
  }

  function firstText(source, keys) {
    for (const key of keys) {
      const value = readDeep(source, key);
      if (value !== undefined && value !== null && String(value).trim()) {
        return String(value).trim();
      }
    }

    return '';
  }

  function firstValue(source, keys) {
    for (const key of keys) {
      const value = readDeep(source, key);
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return value;
      }
    }

    return undefined;
  }

  function readDeep(source, key) {
    if (!source || typeof source !== 'object') return undefined;
    if (key in source) return source[key];

    const segments = String(key).split('.');
    let current = source;

    for (const segment of segments) {
      if (!current || typeof current !== 'object' || !(segment in current)) {
        return undefined;
      }
      current = current[segment];
    }

    return current;
  }

  function formatPercentual(value) {
    if (value === undefined || value === null || value === '') {
      return '—';
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return '—';
      if (trimmed.includes('%')) return trimmed;
    }

    const numeric = Number(String(value).replace(',', '.'));
    if (Number.isFinite(numeric)) {
      return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(numeric)}%`;
    }

    return String(value);
  }

  function shouldTryNextEndpoint(error) {
    const status = Number(error?.status || error?.response?.status || 0);
    return status === 404 || status === 405;
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

    for (const entry of Object.values(value)) {
      deepFreeze(entry);
    }

    return value;
  }
})(typeof window !== 'undefined' ? window : globalThis);
