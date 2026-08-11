(function initRelatoriosService(root) {
  const globalObject = root || (typeof globalThis !== 'undefined' ? globalThis : {});
  const APP_CONFIG = globalObject.APP_CONFIG || {};
  const APP_API_CLIENT = globalObject.APP_API_CLIENT;

  const API_BASE_URL =
    typeof APP_CONFIG.resolveApiBaseUrl === 'function'
      ? APP_CONFIG.resolveApiBaseUrl()
      : `${globalObject.location?.protocol || 'http:'}//${globalObject.location?.hostname || 'localhost'}${globalObject.location?.port ? `:${globalObject.location.port}` : ''}/api/v1`;

  const REPORTS_ENDPOINT = `${API_BASE_URL}/reports/period`;
  const REPORT_PDF_ENDPOINT = `${API_BASE_URL}/reports/period/pdf`;
  const REPORT_FINANCIAL_ENDPOINT = `${API_BASE_URL}/reports/financial-period`;
  const REPORT_CLASS_STUDENTS_ENDPOINTS = Object.freeze([
    `${API_BASE_URL}/reports/class-students-ranking`,
    `${API_BASE_URL}/reports/best-class-ranking`,
    `${API_BASE_URL}/reports/melhor-da-classe`,
    `${API_BASE_URL}/reports/melhor-da-turma`
  ]);

  const REPORT_CLASSES_ENDPOINTS = Object.freeze([
    `${API_BASE_URL}/reports/classes-ranking`,
    `${API_BASE_URL}/reports/class-ranking`,
    `${API_BASE_URL}/reports/best-classes-ranking`
  ]);

  const service = {
    endpoints: Object.freeze({
      report: REPORTS_ENDPOINT,
      pdf: REPORT_PDF_ENDPOINT,
      financial: REPORT_FINANCIAL_ENDPOINT,
      classStudentsRanking: REPORT_CLASS_STUDENTS_ENDPOINTS[0],
      classStudentsRankingAliases: Object.freeze([...REPORT_CLASS_STUDENTS_ENDPOINTS.slice(1)]),
      classesRanking: REPORT_CLASSES_ENDPOINTS[0],
      classesRankingAliases: Object.freeze([...REPORT_CLASSES_ENDPOINTS.slice(1)])
    }),

    async searchByPeriod({ date, startDate, endDate, token } = {}) {
      const normalizedStartDate = isIsoDate(date) ? date : startDate;
      const normalizedEndDate = isIsoDate(date) ? date : endDate;

      if (!isIsoDate(normalizedStartDate) || !isIsoDate(normalizedEndDate)) {
        return {
          found: false,
          reason: 'Informe uma data válida.'
        };
      }

      if (normalizedStartDate > normalizedEndDate) {
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

      const url = `${REPORTS_ENDPOINT}?startDate=${encodeURIComponent(normalizedStartDate)}&endDate=${encodeURIComponent(normalizedEndDate)}`;
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

    async fetchPeriodPdfDetails({ date, startDate, endDate, token } = {}) {
      const normalizedStartDate = isIsoDate(date) ? date : startDate;
      const normalizedEndDate = isIsoDate(date) ? date : endDate;

      if (!isIsoDate(normalizedStartDate) || !isIsoDate(normalizedEndDate)) {
        return {
          found: false,
          reason: 'Informe uma data válida.'
        };
      }

      if (normalizedStartDate > normalizedEndDate) {
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

      const url = `${REPORT_PDF_ENDPOINT}?startDate=${encodeURIComponent(normalizedStartDate)}&endDate=${encodeURIComponent(normalizedEndDate)}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const payload = await APP_API_CLIENT.safeJson(response);
      if (!response.ok || APP_API_CLIENT.isFailurePayload?.(payload) || payload?.ok === false) {
        throw APP_API_CLIENT.createApiError(response, payload, {
          fallbackMessage: 'Não foi possível consultar os dados detalhados do PDF.'
        });
      }

      const report = payload?.data || null;
      const rows = Array.isArray(report?.rows) ? report.rows : [];
      const dailyPages = Array.isArray(report?.dailyPages) ? report.dailyPages : [];

      if (!report || (rows.length === 0 && dailyPages.length === 0)) {
        return {
          found: false,
          reason: 'Nenhum dado detalhado encontrado para o período informado.'
        };
      }

      return {
        found: true,
        report: deepFreeze(cloneValue(report))
      };
    },


    async searchFinancialPeriod({ startDate, endDate, classId, token } = {}) {
      const normalizedStartDate = isIsoDate(startDate) ? startDate : '';
      const normalizedEndDate = isIsoDate(endDate) ? endDate : '';
      const normalizedClassId = classId === null || classId === undefined || classId === ''
        ? ''
        : String(classId).trim();

      if (!normalizedStartDate || !normalizedEndDate) {
        return {
          found: false,
          reason: 'Informe uma data válida.'
        };
      }

      if (normalizedStartDate > normalizedEndDate) {
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

      const searchParams = new URLSearchParams({
        startDate: normalizedStartDate,
        endDate: normalizedEndDate
      });

      if (normalizedClassId) {
        searchParams.set('classId', normalizedClassId);
      }

      const url = `${REPORT_FINANCIAL_ENDPOINT}?${searchParams.toString()}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const payload = await APP_API_CLIENT.safeJson(response);
      if (!response.ok || APP_API_CLIENT.isFailurePayload?.(payload) || payload?.ok === false) {
        throw APP_API_CLIENT.createApiError(response, payload, {
          fallbackMessage: 'Não foi possível consultar o financeiro.'
        });
      }

      const report = payload?.data || null;
      const entries = Array.isArray(report?.entries) ? report.entries : [];

      if (!report || entries.length === 0) {
        return {
          found: false,
          reason: 'Nenhum lançamento encontrado para o período informado.'
        };
      }

      return {
        found: true,
        report: deepFreeze(cloneValue(report))
      };
    },

    async fetchClassStudentsRanking({ classId, startDate, endDate, token } = {}) {
      const normalizedClassId = Number(classId);
      const normalizedStartDate = isIsoDate(startDate) ? startDate : '';
      const normalizedEndDate = isIsoDate(endDate) ? endDate : '';

      if (!Number.isInteger(normalizedClassId) || normalizedClassId <= 0) {
        return {
          found: false,
          reason: 'Selecione uma turma válida para consultar o ranking.'
        };
      }

      if (!normalizedStartDate || !normalizedEndDate) {
        return {
          found: false,
          reason: 'Informe uma data inicial e uma data final válidas.'
        };
      }

      if (normalizedStartDate > normalizedEndDate) {
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

      let lastError = null;

      for (const endpoint of REPORT_CLASS_STUDENTS_ENDPOINTS) {
        try {
          const searchParams = new URLSearchParams({
            classId: String(normalizedClassId),
            startDate: normalizedStartDate,
            endDate: normalizedEndDate
          });
          const url = `${endpoint}?${searchParams.toString()}`;
          const response = await fetch(url, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });

          const payload = await APP_API_CLIENT.safeJson(response);

          if (!response.ok || APP_API_CLIENT.isFailurePayload?.(payload) || payload?.ok === false) {
            const apiError = APP_API_CLIENT.createApiError(response, payload, {
              fallbackMessage: 'Não foi possível consultar o ranking da turma.'
            });

            if (shouldTryNextEndpoint(apiError)) {
              lastError = apiError;
              continue;
            }

            throw apiError;
          }

          const report = extractReport(payload);
          const ranking = normalizeClassStudentsRankingList(report);

          if (!ranking.length) {
            return {
              found: false,
              reason: 'Nenhum aluno encontrado na turma selecionada para o período informado.'
            };
          }

          return {
            found: true,
            ranking: deepFreeze(cloneValue(ranking)),
            classId: Number(report?.class_id ?? normalizedClassId),
            classLabel: firstText(report, ['class_label', 'classLabel']) || '',
            periodo: report?.periodo || {
              startDate: normalizedStartDate,
              endDate: normalizedEndDate
            }
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
        reason: 'Não foi possível consultar o ranking da turma.'
      };
    },


    async fetchClassesRanking({ startDate, endDate, date, token } = {}) {
      const normalizedSingleDate = isIsoDate(date) ? date : '';
      const normalizedStartDate = isIsoDate(startDate) ? startDate : normalizedSingleDate;
      const normalizedEndDate = isIsoDate(endDate) ? endDate : normalizedSingleDate;

      if (!token) {
        const sessionError = new Error('Sua sessão expirou. Faça login novamente.');
        sessionError.status = 401;
        sessionError.requiresRelogin = true;
        throw sessionError;
      }

      if (!normalizedStartDate || !normalizedEndDate) {
        return {
          found: false,
          reason: 'Informe uma data válida.'
        };
      }

      if (normalizedStartDate > normalizedEndDate) {
        return {
          found: false,
          reason: 'A data inicial não pode ser maior que a data final.'
        };
      }

      let lastError = null;

      for (const endpoint of REPORT_CLASSES_ENDPOINTS) {
        try {
          const searchParams = new URLSearchParams({
            startDate: normalizedStartDate,
            endDate: normalizedEndDate
          });

          if (normalizedSingleDate && !isIsoDate(startDate) && !isIsoDate(endDate)) {
            searchParams.set('date', normalizedSingleDate);
          }

          const url = `${endpoint}?${searchParams.toString()}`;
          const response = await fetch(url, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });

          const payload = await APP_API_CLIENT.safeJson(response);

          if (!response.ok || APP_API_CLIENT.isFailurePayload?.(payload) || payload?.ok === false) {
            const apiError = APP_API_CLIENT.createApiError(response, payload, {
              fallbackMessage: 'Não foi possível consultar o ranking de classes.'
            });

            if (shouldTryNextEndpoint(apiError)) {
              lastError = apiError;
              continue;
            }

            throw apiError;
          }

          const report = extractReport(payload);
          const ranking = normalizeClassesRankingList(report);

          if (!ranking.length) {
            return {
              found: false,
              reason: 'Nenhuma classe encontrada no ranking de classes.'
            };
          }

          return {
            found: true,
            ranking: deepFreeze(cloneValue(ranking)),
            dataReference:
              firstText(report, ['data_referencia', 'dataReferencia', 'periodo.startDate']) ||
              normalizedStartDate ||
              normalizedEndDate ||
              normalizedSingleDate ||
              '',
            title: firstText(report, ['title']) || 'Melhores Classes',
            subtitle: firstText(report, ['subtitle']) || 'Top 10 classes por presença geral.'
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
        reason: 'Não foi possível consultar o ranking de classes.'
      };
    },

    createPdfSnapshot(report) {
      // Snapshot canônico da consulta: reutilizado pela renderização da tela e pela geração do PDF.
      return cloneValue(report);
    }
  };

  globalObject.APP_REPORTS_SERVICE = Object.freeze(service);


function extractReport(payload) {
  return payload?.data ?? payload?.result ?? payload?.payload ?? payload?.body ?? payload?.response ?? payload ?? null;
}

function normalizeRankingList(payload) {
  const source = extractRankingSource(payload);
  return source
    .map((item, index) => normalizeRankingItem(item, index))
    .filter(Boolean)
    .slice(0, 10);
}

function normalizeClassStudentsRankingList(payload) {
  const source = extractRankingSource(payload);
  return source
    .map((item, index) => normalizeRankingItem(item, index))
    .filter(Boolean);
}

function normalizeClassesRankingList(payload) {
  const source = extractRankingSource(payload);
  return source
    .map((item, index) => normalizeClassesRankingItem(item, index))
    .filter(Boolean)
    .slice(0, 10);
}

function extractRankingSource(payload) {
  const data = extractReport(payload);

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
    'percentual_frequencia',
    'percentualFrequencia',
    'presence_percentage',
    'presencePercent',
    'percentual',
    'presenca',
    'attendance_percentage',
    'attendancePercent'
  ]);

  return {
    position: Number(item.posicao ?? item.position ?? index + 1),
    nome: nome || 'Aluno sem nome',
    classe: classe || '—',
    percentual_presenca: formatPercentual(percentualPresenca)
  };
}

function normalizeClassesRankingItem(item, index) {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const classe = firstText(item, [
    'classe',
    'class',
    'turma',
    'nome_classe',
    'class_name',
    'nomeClasse',
    'turma_nome',
    'className',
    'nome'
  ]);

  const percentualPresenca = firstValue(item, [
    'percentual_presenca',
    'percentualPresenca',
    'percentual_frequencia',
    'percentualFrequencia',
    'presence_percentage',
    'presencePercent',
    'percentual',
    'presenca',
    'attendance_percentage',
    'attendancePercent'
  ]);

  const presentes = firstValue(item, [
    'presentes',
    'total_presentes',
    'totalPresentes',
    'presence_total'
  ]);

  return {
    position: Number(item.posicao ?? item.position ?? index + 1),
    id_classe: Number(item.id_classe ?? item.idClasse ?? item.classId ?? item.turmaId ?? 0) || null,
    classe: classe || 'Classe sem nome',
    presentes: presentes !== undefined && presentes !== null && String(presentes).trim() !== ''
      ? Number(presentes) || presentes
      : undefined,
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
