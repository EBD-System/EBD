const STORAGE_KEYS = window.APP_STORAGE_KEYS;
const API_CONFIG = window.APP_CONFIG || {};
const API_BASE_URL =
  typeof API_CONFIG.resolveApiBaseUrl === 'function'
    ? API_CONFIG.resolveApiBaseUrl()
    : `${window.location.protocol}//${window.location.hostname}${window.location.port ? `:${window.location.port}` : ''}/api/v1`;
const AUTH_STORAGE = window.APP_AUTH_STORAGE;
const APP_API_CLIENT = window.APP_API_CLIENT;
const APP_ACCESS_DENIED_DIALOG = window.APP_ACCESS_DENIED_DIALOG;


const classesGrid = document.getElementById('classesGrid');
const statusText = document.getElementById('statusText');
const reportStatusText = document.getElementById('reportStatusText');
const reportSummaryText = document.getElementById('reportSummaryText');
const presenceRankingList = document.getElementById('presenceRankingList');
const offersRankingList = document.getElementById('offersRankingList');
const classIntro = document.querySelector('.classes-header .subtitle');
const classHiddenCopy = document.getElementById('classesHiddenCopy');

const ATTENDANCE_SUMMARY_ENDPOINTS = [
  (classId) => `${API_BASE_URL}/attendance/classes/${encodeURIComponent(classId)}/summary`,
  (classId) => `${API_BASE_URL}/classes/${encodeURIComponent(classId)}/attendance/summary`
];

const GENERAL_SUMMARY_ENDPOINTS = [
  `${API_BASE_URL}/attendance/summary`
];

const REPORT_RANKING_ENDPOINTS = {
  presence: `${API_BASE_URL}/reports/presence-ranking`,
  offers: `${API_BASE_URL}/reports/offers-ranking`
};

const state = {
  classCardsById: new Map(),
  summaryStateByClassId: new Map(),
  classes: [],
  loadingSummaries: false,
  reportState: {
    summary: null,
    presenceRanking: [],
    offersRanking: [],
    loading: false
  }
};


function applyDevelopmentModeVisibility() {
  const hideIntro =
    typeof APP_CONFIG.shouldHideClassIntro === 'function'
      ? APP_CONFIG.shouldHideClassIntro()
      : APP_CONFIG.developmentMode === false;
  const hideStatus =
    typeof APP_CONFIG.shouldHideClassStatus === 'function'
      ? APP_CONFIG.shouldHideClassStatus()
      : APP_CONFIG.developmentMode === false;

  if (classIntro) {
    classIntro.hidden = hideIntro;
  }

  if (statusText) {
    statusText.hidden = hideStatus;
  }

  if (classHiddenCopy) {
    const hiddenMessages = [];
    if (hideIntro) {
      hiddenMessages.push('As classes abaixo estão disponíveis. Clique em uma delas para abrir a chamada.');
    }
    if (hideStatus) {
      hiddenMessages.push('6 classes carregadas. Resumos da chamada sincronizados.');
    }
    classHiddenCopy.textContent = hiddenMessages.join(' ');
    classHiddenCopy.hidden = hiddenMessages.length === 0;
  }
}

applyDevelopmentModeVisibility();

const session = readSession();
if (!session.token) {
  goToLogin();
} else {
  void loadClasses(session.token);
}

function readSession() {
  try {
    const token = AUTH_STORAGE.readToken(STORAGE_KEYS.token);
    return { token };
  } catch {
    return { token: '' };
  }
}

async function loadClasses(token) {
  setStatus('Carregando classes...');

  try {
    const response = await fetch(`${API_BASE_URL}/classes`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const payload = await APP_API_CLIENT.safeJson(response);
    if (!response.ok || APP_API_CLIENT.isFailurePayload?.(payload) || payload?.ok === false) {
      throw APP_API_CLIENT.createApiError(response, payload, {
        fallbackMessage: 'Não foi possível carregar as classes.'
      });
    }

    const classes = sortClassesForDisplay(normalizeClasses(payload));
    renderClasses(classes);

    if (classes.some((classItem) => hasAttendanceSummary(classItem))) {
      void loadGeneralReport(token);
    } else {
      renderGeneralReportIdle();
    }

    void syncAttendanceSummaries(classes, token);
    return classes;
  } catch (error) {
    if (Number(error?.status) === 403) {
      openAccessDeniedDialog(error, 'Falha ao carregar a lista de classes.');
      return [];
    }

    renderError(error.message || 'Falha ao carregar as classes.');
    openErrorDialog({
      message: 'Houve um erro. Fale com o suporte para corrigir.',
      trace: buildErrorTrace(error, 'Falha ao carregar a lista de classes.')
    });
  }
}

async function loadGeneralReport(token) {
  if (!reportStatusText || !reportSummaryText || !presenceRankingList || !offersRankingList) {
    return;
  }

  state.reportState.loading = true;
  setReportStatus('Sincronizando relatório geral e rankings...');

  const [summaryResult, presenceResult, offersResult] = await Promise.allSettled([
    loadGeneralSummary(token),
    loadRanking(token, 'presence'),
    loadRanking(token, 'offers')
  ]);

  const reportErrors = [];

  if (summaryResult.status === 'fulfilled') {
    state.reportState.summary = summaryResult.value;
    renderGeneralSummary(summaryResult.value);
  } else {
    const error = normalizeError(summaryResult.reason, 'Falha ao carregar o relatório geral.');
    reportErrors.push({ kind: 'relatório geral', error });
    renderGeneralSummaryError();
  }

  if (presenceResult.status === 'fulfilled') {
    state.reportState.presenceRanking = presenceResult.value;
    renderRankingList('presence', presenceResult.value);
  } else {
    const error = normalizeError(presenceResult.reason, 'Falha ao carregar o ranking de presença.');
    reportErrors.push({ kind: 'ranking de presença', error });
    renderRankingError('presence');
  }

  if (offersResult.status === 'fulfilled') {
    state.reportState.offersRanking = offersResult.value;
    renderRankingList('offers', offersResult.value);
  } else {
    const error = normalizeError(offersResult.reason, 'Falha ao carregar o ranking de ofertas.');
    reportErrors.push({ kind: 'ranking de ofertas', error });
    renderRankingError('offers');
  }

  state.reportState.loading = false;

  if (reportErrors.length) {
    setReportStatus('Relatório geral carregado parcialmente.');
    refreshReportPresentation();
    openErrorDialog({
      message: 'Houve um erro. Fale com o suporte para corrigir.',
      trace: reportErrors
        .map((entry) => buildErrorTrace(entry.error, `Falha ao sincronizar ${entry.kind}.`))
        .join('\n\n---\n\n')
    });
    return;
  }

  setReportStatus('Relatório geral e rankings sincronizados.');
  refreshReportPresentation();
}

async function loadGeneralSummary(token) {
  const date = getReportDate();
  let lastError = null;

  for (const url of GENERAL_SUMMARY_ENDPOINTS) {
    try {
      const payload = await requestJson(appendQueryParams(url, { date }), token, 'Não foi possível carregar o relatório geral.');
      return normalizeAttendanceSummary(payload);
    } catch (error) {
      const normalizedError = normalizeError(error, 'Falha ao carregar o relatório geral.');
      if ([404, 405].includes(Number(normalizedError.status))) {
        lastError = normalizedError;
        continue;
      }
      throw normalizedError;
    }
  }

  throw lastError || new Error('Não foi possível carregar o relatório geral.');
}

async function loadRanking(token, kind) {
  const url = REPORT_RANKING_ENDPOINTS[kind];
  if (!url) {
    return [];
  }

  const date = getReportDate();
  const payload = await requestJson(
    appendQueryParams(url, { date }),
    token,
    `Não foi possível carregar o ranking de ${kind === 'presence' ? 'presença' : 'ofertas'}.`
  );
  return normalizeRankingPayload(payload, kind);
}

function getReportDate() {
  const explicitDate = new URLSearchParams(window.location.search).get('date');
  if (isIsoDate(explicitDate)) {
    return explicitDate;
  }

  return formatLocalIsoDate(new Date());
}

function formatLocalIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function appendQueryParams(url, params) {
  const nextUrl = new URL(url);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    nextUrl.searchParams.set(key, String(value));
  });
  return nextUrl.toString();
}

async function requestJson(url, token, fallbackMessage) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const payload = await APP_API_CLIENT.safeJson(response);
  if (!response.ok || APP_API_CLIENT.isFailurePayload?.(payload) || payload?.ok === false) {
    throw APP_API_CLIENT.createApiError(response, payload, {
      fallbackMessage
    });
  }

  return payload;
}

const CLASS_DISPLAY_ORDER = new Map(
  [
    'Cordeirinhos de Cristo',
    'Shalon',
    'Filhos de Asáfe',
    'Mensageiros de Cristo',
    'Filhos de Sião',
    'Rosas de Saron'
  ].map((name, index) => [normalizeClassOrderKey(name), index])
);

function normalizeClasses(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function sortClassesForDisplay(classes) {
  if (!Array.isArray(classes)) {
    return [];
  }

  return classes
    .map((classItem, index) => ({ classItem, index }))
    .sort((left, right) => {
      const leftPriority = getClassDisplayPriority(left.classItem);
      const rightPriority = getClassDisplayPriority(right.classItem);

      if (leftPriority !== rightPriority) {
        if (leftPriority === null) return 1;
        if (rightPriority === null) return -1;
        return leftPriority - rightPriority;
      }

      const leftId = getClassNumericId(left.classItem);
      const rightId = getClassNumericId(right.classItem);

      if (leftId !== rightId) {
        if (leftId === null) return 1;
        if (rightId === null) return -1;
        return leftId - rightId;
      }

      const leftTitle = normalizeTextValue(getClassTitle(left.classItem, left.index));
      const rightTitle = normalizeTextValue(getClassTitle(right.classItem, right.index));
      const titleComparison = leftTitle.localeCompare(rightTitle, 'pt-BR', { sensitivity: 'base' });

      if (titleComparison !== 0) {
        return titleComparison;
      }

      return left.index - right.index;
    })
    .map(({ classItem }) => classItem);
}

function getClassDisplayPriority(classItem) {
  const title = normalizeClassOrderKey(getClassTitle(classItem, 0));
  return CLASS_DISPLAY_ORDER.has(title) ? CLASS_DISPLAY_ORDER.get(title) : null;
}

function getClassNumericId(classItem) {
  const rawId = classItem?.id_classe ?? classItem?.idClasse ?? classItem?.classId ?? classItem?.id;
  const parsed = Number(rawId);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeClassOrderKey(value) {
  return normalizeTextValue(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function renderClasses(classes) {
  state.classCardsById = new Map();
  state.summaryStateByClassId = new Map();
  state.classes = Array.isArray(classes) ? classes : [];

  if (!classes.length) {
    classesGrid.innerHTML = `
      <article class="class-card is-empty" tabindex="0" aria-disabled="true">
        <h3 class="class-card__title">Nenhuma classe encontrada</h3>
        <p class="class-card__fallback">Nenhuma informação disponível para exibir.</p>
      </article>
    `;
    setStatus('0 classes carregadas.');
    return;
  }

  const cardsMarkup = classes
    .map((classItem, index) => {
      const title = getClassTitle(classItem, index);
      const badge = buildBadge(title, index);
      const callStatusEmoji = getCallStatusEmoji(classItem);
      const classId = getClassId(classItem);
      const hasClassId = Boolean(classId);
      const hasAttendanceCall = hasAttendanceSummary(classItem);

      if (hasAttendanceCall && hasClassId) {
        state.summaryStateByClassId.set(classId, { status: 'loading' });
      }

      return `
        <button
          type="button"
          class="class-card${hasClassId ? '' : ' is-disabled'}"
          data-class-name="${escapeHtml(title)}"
          data-class-id="${escapeHtml(classId)}"
          data-has-attendance-call="${hasAttendanceCall ? 'true' : 'false'}"
          ${hasClassId ? '' : 'disabled aria-disabled="true"'}
        >
          <span class="class-card__badge" aria-hidden="true">${escapeHtml(badge)}</span>
          <h3 class="class-card__title">
            <span class="class-card__title-text">${escapeHtml(title)}</span>
            <span class="class-card__status-emoji" aria-hidden="true">${escapeHtml(callStatusEmoji)}</span>
          </h3>
          <div class="class-card__meta">
            ${renderSummaryMarkup({
              classId,
              hasAttendanceCall
            })}
          </div>
          <span class="class-card__footer">${hasClassId ? 'Abrir chamada' : 'ID da classe indisponível'}</span>
        </button>
      `;
    })
    .join('');

  classesGrid.innerHTML = cardsMarkup;

  classesGrid.querySelectorAll('.class-card[data-class-id]').forEach((button) => {
    const classId = button.dataset.classId || '';
    if (classId) {
      state.classCardsById.set(classId, button);
    }

    button.addEventListener('click', () => {
      const className = button.dataset.className || 'Classe';
      const selectedClassId = button.dataset.classId || '';
      goToCallPage(selectedClassId, className);
    });
  });

  setStatus(`${classes.length} classe${classes.length === 1 ? '' : 's'} carregada${classes.length === 1 ? '' : 's'}.`);
  refreshReportPresentation();
}

async function syncAttendanceSummaries(classes, token) {
  const classesWithAttendance = classes.filter((classItem) => hasAttendanceSummary(classItem) && getClassId(classItem));

  if (!classesWithAttendance.length) {
    state.loadingSummaries = false;
    setStatus(`${classes.length} classe${classes.length === 1 ? '' : 's'} carregada${classes.length === 1 ? '' : 's'}.`);
    return;
  }

  state.loadingSummaries = true;
  setStatus(
    `${classes.length} classe${classes.length === 1 ? '' : 's'} carregada${classes.length === 1 ? '' : 's'}. ` +
      'Resumos da chamada sincronizando em segundo plano...'
  );

  const results = await Promise.allSettled(
    classesWithAttendance.map((classItem) => loadAttendanceSummaryForClass(classItem, token))
  );

  const failures = [];
  results.forEach((result, index) => {
    const classItem = classesWithAttendance[index];
    const classId = getClassId(classItem);

    if (result.status === 'fulfilled') {
      updateClassSummary(classItem, result.value);
      return;
    }

    const error = result.reason instanceof Error ? result.reason : new Error(String(result.reason || 'Erro desconhecido'));
    failures.push({ classItem, error });
    markClassSummaryError(classId, error);
  });

  state.loadingSummaries = false;

  if (failures.length) {
    setStatus(
      `${classes.length} classe${classes.length === 1 ? '' : 's'} carregada${classes.length === 1 ? '' : 's'}. ` +
        `${failures.length} resumo${failures.length === 1 ? '' : 's'} não puderam ser sincronizados.`
    );
    openErrorDialog({
      message: 'Houve um erro. Fale com o suporte para corrigir.',
      trace: buildErrorTrace(failures[0].error, 'Falha ao sincronizar o resumo da chamada.', failures[0].classItem)
    });
    return;
  }

  setStatus(
    `${classes.length} classe${classes.length === 1 ? '' : 's'} carregada${classes.length === 1 ? '' : 's'}. ` +
      'Resumos da chamada sincronizados.'
  );
}

async function loadAttendanceSummaryForClass(classItem, token) {
  const classId = getClassId(classItem);
  if (!classId) {
    throw new Error('Classe sem identificador não pode carregar resumo de chamada.');
  }

  let lastError = null;

  for (const buildUrl of ATTENDANCE_SUMMARY_ENDPOINTS) {
    const url = buildUrl(classId);

    try {
      const payload = await requestJson(url, token, 'Não foi possível carregar o resumo da chamada.');
      return normalizeAttendanceSummary(payload);
    } catch (error) {
      const normalizedError = normalizeError(error, 'Falha ao carregar o resumo da chamada.');

      if ([404, 405].includes(Number(normalizedError.status))) {
        lastError = normalizedError;
        continue;
      }

      throw normalizedError;
    }
  }

  throw lastError || new Error('Não foi possível carregar o resumo da chamada.');
}

function normalizeAttendanceSummary(payload) {
  const root = extractSummaryRoot(payload);
  const source = root && typeof root === 'object' ? root : {};

  const matriculados = extractCountFromSummary(source, ['matriculados', 'totalMatriculados', 'alunosMatriculados', 'inscritos', 'enrolled', 'totalAlunos']);
  const ausentes = extractCountFromSummary(source, ['ausentes', 'absentCount', 'faltas', 'faltantes']);
  const presentes = extractCountFromSummary(source, ['presentes', 'presentCount', 'present', 'presenceCount']);
  const visitantes = extractCountFromSummary(source, ['visitantes', 'visitorCount', 'visitors']);
  const biblias = extractCountFromSummary(source, ['biblias', 'bíblias', 'biblia', 'bibleCount', 'bibles']);
  const revistas = extractCountFromSummary(source, ['revistas', 'revistaCount', 'magazines']);
  const ofertas = extractMoneyFromSummary(source, ['ofertas', 'oferta', 'valor_oferta', 'valorOferta', 'offerCount', 'offers']);

  return {
    matriculados,
    ausentes,
    presentes,
    visitantes,
    total: sumCounts(presentes, visitantes),
    biblias,
    revistas,
    ofertas
  };
}

function extractSummaryRoot(payload) {
  const candidates = [
    payload?.data?.summary,
    payload?.summary,
    payload?.data?.data?.summary,
    payload?.data?.result?.summary,
    payload?.data,
    payload?.result,
    payload?.payload,
    payload?.attendanceSummary,
    payload?.callSummary,
    payload?.stats,
    payload?.statistics
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object') {
      return candidate;
    }
  }

  return payload;
}

function extractCountFromSummary(root, keys) {
  const value = findValueInObjectTree(root, keys);
  return normalizeCount(value);
}

function extractMoneyFromSummary(root, keys) {
  const value = findValueInObjectTree(root, keys);
  return normalizeMoney(value);
}

function normalizeMoney(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = parseCurrencyValue(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function findValueInObjectTree(root, keys) {
  const normalizedKeys = keys.map(normalizeLookupKey);
  const queue = [root];
  const seen = new Set();

  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== 'object' || seen.has(current)) continue;
    seen.add(current);

    for (const [key, value] of Object.entries(current)) {
      if (normalizedKeys.includes(normalizeLookupKey(key))) {
        return value;
      }

      if (value && typeof value === 'object') {
        queue.push(value);
      }
    }
  }

  return undefined;
}

function normalizeLookupKey(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

function normalizeCount(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }

  const raw = String(value)
    .trim()
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');

  if (!raw) return null;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;

  return Math.max(0, Math.trunc(parsed));
}

function sumCounts(a, b) {
  if (!Number.isFinite(a) && !Number.isFinite(b)) {
    return null;
  }

  return (Number.isFinite(a) ? a : 0) + (Number.isFinite(b) ? b : 0);
}

function renderSummaryMarkup({ classId, hasAttendanceCall }) {
  if (!hasAttendanceCall) {
    return '';
  }

  const summaryState = state.summaryStateByClassId.get(classId);

  if (!summaryState || summaryState.status === 'loading') {
    return `
      <div class="class-card__summary is-loading" aria-live="polite">
        <p class="class-card__summary-placeholder">Sincronizando o resumo da chamada...</p>
      </div>
    `;
  }

  if (summaryState.status === 'error') {
    return `
      <div class="class-card__summary is-error" aria-live="polite">
        <p class="class-card__summary-placeholder">Resumo indisponível no momento.</p>
      </div>
    `;
  }

  return `
    <div class="class-card__summary">
      <pre class="class-card__summary-content">${escapeHtml(formatSummaryText(summaryState.summary))}</pre>
    </div>
  `;
}


function updateClassSummary(classItem, summary) {
  const classId = getClassId(classItem);
  if (!classId) {
    return;
  }

  const normalizedSummary = {
    ...summary,
    total: sumCounts(summary?.presentes, summary?.visitantes)
  };

  state.summaryStateByClassId.set(classId, {
    status: 'ready',
    summary: normalizedSummary
  });

  refreshClassSummaryCard(classId);
  refreshReportPresentation();
}

function markClassSummaryError(classId, error) {
  if (!classId) {
    return;
  }

  state.summaryStateByClassId.set(classId, {
    status: 'error',
    error: normalizeError(error, 'Falha ao sincronizar o resumo da chamada.')
  });

  refreshClassSummaryCard(classId);
  refreshReportPresentation();
}

function refreshClassSummaryCard(classId) {
  const card = state.classCardsById.get(classId);
  if (!card) {
    return;
  }

  const meta = card.querySelector('.class-card__meta');
  if (!meta) {
    return;
  }

  const hasAttendanceCall = card.dataset.hasAttendanceCall === 'true';
  meta.innerHTML = renderSummaryMarkup({ classId, hasAttendanceCall });
}

function formatSummaryText(summary) {
  const total = sumCounts(summary.presentes, summary.visitantes);

  const lines = [
    `Matriculados: ${formatSummaryValue(summary.matriculados)}`,
    `Ausentes: ${formatSummaryValue(summary.ausentes)}`,
    `Presentes: ${formatSummaryValue(summary.presentes)}`,
    `Visitantes: ${formatSummaryValue(summary.visitantes)}`,
    `Total: ${formatSummaryValue(total)}`,
    `Bíblias: ${formatSummaryValue(summary.biblias)}`,
    `Revistas: ${formatSummaryValue(summary.revistas)}`,
    `Ofertas: ${formatOfferValue(summary.ofertas)}`
  ];

  return lines.join('\n');
}

function formatGeneralReportText(summary) {
  const total = sumCounts(summary.presentes, summary.visitantes);

  const lines = [
    `Matriculados: ${formatSummaryValue(summary.matriculados)}`,
    `Ausentes: ${formatSummaryValue(summary.ausentes)}`,
    `Presentes: ${formatSummaryValue(summary.presentes)}`,
    `Visitantes: ${formatSummaryValue(summary.visitantes)}`,
    `Total: ${formatSummaryValue(total)}`,
    `Bíblias: ${formatSummaryValue(summary.biblias)}`,
    `Revistas: ${formatSummaryValue(summary.revistas)}`,
    `Ofertas: ${formatOfferValue(summary.ofertas)}`
  ];

  return lines.join('\n');
}

function formatSummaryValue(value) {
  if (value === undefined || value === null || value === '') {
    return 'Não houve';
  }

  if (typeof value === 'number') {
    return value > 0 ? String(value) : 'Não houve';
  }

  const parsed = Number(String(value).replace(',', '.').replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 'Não houve';
  }

  return String(Math.trunc(parsed));
}

function formatOfferValue(value) {
  const numeric = parseCurrencyValue(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 'Não houve';
  }

  return numeric.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function parseCurrencyValue(value) {
  if (value === undefined || value === null || value === '') {
    return NaN;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : NaN;
  }

  let raw = String(value).trim();
  if (!raw) {
    return NaN;
  }

  raw = raw.replace(/[^\d.,-]/g, '');

  if (!raw) {
    return NaN;
  }

  const hasComma = raw.includes(',');
  const hasDot = raw.includes('.');

  if (hasComma && hasDot) {
    const lastComma = raw.lastIndexOf(',');
    const lastDot = raw.lastIndexOf('.');

    if (lastComma > lastDot) {
      raw = raw.replace(/\./g, '');
      raw = raw.replace(',', '.');
    } else {
      raw = raw.replace(/,/g, '');
    }
  } else if (hasComma) {
    raw = raw.replace(/\./g, '');
    raw = raw.replace(',', '.');
  } else if (hasDot) {
    const parts = raw.split('.');
    if (parts.length > 2) {
      raw = parts.join('');
    }
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function normalizeRankingPayload(payload, kind) {
  const items = extractRankingItems(payload)
    .map((item, index) => normalizeRankingItem(item, kind, index))
    .filter((item) => item.className || item.metric !== null);

  items.sort((left, right) => compareRankingItems(left, right));
  return items.slice(0, 3);
}

function extractRankingItems(payload) {
  const candidates = [
    payload?.data?.itens,
    payload?.data?.items,
    payload?.data?.result?.itens,
    payload?.data?.result?.items,
    payload?.data?.ranking,
    payload?.data?.leaders,
    payload?.data?.rows,
    payload?.data?.records,
    payload?.data?.list,
    payload?.data?.top3,
    payload?.data,
    payload?.result?.itens,
    payload?.result?.items,
    payload?.result,
    payload?.items,
    payload?.itens,
    payload?.ranking,
    payload?.payload,
    payload?.statistics,
    payload?.stats
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }

    if (candidate && typeof candidate === 'object') {
      for (const key of ['itens', 'items', 'result', 'ranking', 'leaders', 'rows', 'records', 'data', 'list', 'top3']) {
        if (Array.isArray(candidate[key])) {
          return candidate[key];
        }
      }

      if (candidate.rows && typeof candidate.rows === 'object' && Array.isArray(candidate.rows.data)) {
        return candidate.rows.data;
      }

      if (candidate.data && typeof candidate.data === 'object') {
        if (Array.isArray(candidate.data.itens)) {
          return candidate.data.itens;
        }
        if (Array.isArray(candidate.data.items)) {
          return candidate.data.items;
        }
      }
    }
  }

  return [];
}

function normalizeRankingItem(item, kind, index) {
  const className =
    normalizeTextValue(findFirstValue(item, [
      'nome_classe',
      'nomeClasse',
      'className',
      'class_name',
      'turma',
      'classe',
      'name',
      'nome',
      'label',
      'title'
    ])) || `Classe ${index + 1}`;

  const valueKeys =
    kind === 'presence'
      ? ['percentual_presenca', 'percentualPresenca', 'presenca_percentual', 'presencePercent', 'presence_percentage', 'percentual', 'presenca']
      : ['valor_oferta', 'valorOferta', 'offerValue', 'valor', 'value', 'amount', 'oferta'];

  const rawValue = findFirstValue(item, valueKeys);
  const metric = parseCurrencyValue(rawValue);
  const displayValue = formatRankingDisplayValue(rawValue, kind, metric);

  return {
    className,
    metric,
    displayValue
  };
}

function findFirstValue(root, keys) {
  return findValueInObjectTree(root, keys);
}

function compareRankingItems(left, right) {
  const leftHasMetric = Number.isFinite(left.metric);
  const rightHasMetric = Number.isFinite(right.metric);

  if (leftHasMetric && rightHasMetric) {
    return right.metric - left.metric;
  }

  if (rightHasMetric && !leftHasMetric) {
    return 1;
  }

  if (leftHasMetric && !rightHasMetric) {
    return -1;
  }

  return 0;
}

function formatRankingDisplayValue(rawValue, kind, metric) {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return 'Não houve';
  }

  if (kind === 'presence') {
    const numberValue = parseCurrencyValue(rawValue);
    if (!Number.isFinite(numberValue) || numberValue <= 0) {
      return 'Não houve';
    }

    const normalized = numberValue % 1 === 0 ? String(Math.trunc(numberValue)) : numberValue.toFixed(1);
    return `${normalized}%`;
  }

  return formatOfferValue(rawValue);
}

function renderGeneralSummary(summary) {
  state.reportState.summary = summary || null;
  reportSummaryText.innerHTML = escapeHtml(formatGeneralReportText(summary));
  refreshReportPresentation();
}

function renderGeneralSummaryError() {
  state.reportState.summary = null;
  reportSummaryText.textContent = 'Relatório geral indisponível no momento.';
  refreshReportPresentation();
}

function renderGeneralReportIdle() {
  if (!reportStatusText || !reportSummaryText || !presenceRankingList || !offersRankingList) {
    return;
  }

  state.reportState.loading = false;
  state.reportState.summary = null;
  state.reportState.presenceRanking = [];
  state.reportState.offersRanking = [];

  setReportStatus('Aguardando a primeira chamada para liberar o relatório geral.');
  reportSummaryText.textContent = 'Faça a primeira chamada para exibir o relatório geral.';
  presenceRankingList.innerHTML = `
    <p class="report-card__placeholder">Os rankings aparecem depois da primeira chamada.</p>
  `;
  offersRankingList.innerHTML = `
    <p class="report-card__placeholder">Os rankings aparecem depois da primeira chamada.</p>
  `;
  refreshReportPresentation();
}

function renderRankingList(kind, items) {
  const listElement = kind === 'presence' ? presenceRankingList : offersRankingList;
  if (!listElement) return;

  if (!items.length) {
    listElement.innerHTML = `
      <p class="report-card__placeholder">Nenhuma informação de ranking foi retornada.</p>
    `;
    return;
  }

  listElement.innerHTML = `
    <ol class="report-card__ranking">
      ${items
        .map(
          (item, index) => `
            <li class="report-card__ranking-item">
              <span class="report-card__ranking-position">${index + 1}.</span>
              <span class="report-card__ranking-name">${escapeHtml(item.className)}</span>
              <span class="report-card__ranking-value">${escapeHtml(item.displayValue || formatSummaryValue(item.metric))}</span>
            </li>
          `
        )
        .join('')}
    </ol>
  `;
}

function renderRankingError(kind) {
  const listElement = kind === 'presence' ? presenceRankingList : offersRankingList;
  if (!listElement) return;

  listElement.innerHTML = `
    <p class="report-card__placeholder">Ranking indisponível no momento.</p>
  `;
}

function hasAttendanceSummary(classItem) {
  return Boolean(
    classItem?.chamada_ja_feita ||
      classItem?.chamadaJaFeita ||
      classItem?.attendanceDone ||
      classItem?.hasAttendance ||
      classItem?.hasCall ||
      classItem?.chamadaFeita
  );
}

function renderError(message) {
  classesGrid.innerHTML = `
    <article class="class-card is-empty" tabindex="0" aria-disabled="true">
      <h3 class="class-card__title">Erro ao carregar classes</h3>
      <p class="class-card__fallback">${escapeHtml(message)}</p>
    </article>
  `;
  setStatus('Não foi possível carregar as classes.');
}

function goToCallPage(classId, className) {
  const params = new URLSearchParams();
  if (classId) params.set('classId', classId);
  if (className) params.set('className', className);

  const query = params.toString();
  const target = `../../chamada/pages/index.html${query ? `?${query}` : ''}`;
  window.location.assign(target);
}

function setStatus(message) {
  if (statusText) {
    statusText.textContent = message;
    if (APP_CONFIG.developmentMode && typeof APP_CONFIG.shouldHideClassStatus === 'function' && APP_CONFIG.shouldHideClassStatus()) {
      statusText.hidden = true;
    }
  }
}

function setReportStatus(message) {
  if (reportStatusText) {
    reportStatusText.textContent = message;
  }
}


function refreshReportPresentation() {
  if (!reportStatusText || !reportSummaryText) {
    return;
  }

  const incompleteCalls = hasIncompleteCalls();
  const zeroPresentClass = hasZeroPresentClass();
  const reportReady = Boolean(state.reportState.summary);

  reportSummaryText.classList.toggle('is-danger', incompleteCalls);
  reportSummaryText.classList.toggle('is-warning', !incompleteCalls && zeroPresentClass);
  reportSummaryText.classList.toggle('is-success', reportReady && !incompleteCalls && !zeroPresentClass);

  reportStatusText.classList.toggle('is-danger', incompleteCalls && !zeroPresentClass);
  reportStatusText.classList.toggle('is-warning', zeroPresentClass);
  reportStatusText.classList.toggle('is-success', reportReady && !incompleteCalls && !zeroPresentClass);

  if (incompleteCalls) {
    reportStatusText.textContent = 'Existe classe com alunos sem presenças.';
  }
}

function hasIncompleteCalls() {
  if (!Array.isArray(state.classes) || state.classes.length === 0) {
    return false;
  }

  return state.classes.some((classItem) => !hasAttendanceSummary(classItem));
}

function hasZeroPresentClass() {
  if (!Array.isArray(state.classes) || state.classes.length === 0) {
    return false;
  }

  return state.classes.some((classItem) => {
    if (!hasAttendanceSummary(classItem)) {
      return false;
    }

    const classId = getClassId(classItem);
    if (!classId) {
      return false;
    }

    const summaryState = state.summaryStateByClassId.get(classId);
    if (!summaryState || summaryState.status !== 'ready') {
      return false;
    }

    return normalizeCount(summaryState.summary?.presentes) === 0;
  });
}

function getClassTitle(classItem, index) {
  return (
    classItem?.nome ||
    classItem?.name ||
    classItem?.titulo ||
    classItem?.descricao ||
    classItem?.label ||
    `Classe ${index + 1}`
  );
}

function getClassId(classItem) {
  const value = classItem?.id_classe ?? classItem?.idClasse ?? classItem?.classId ?? classItem?.id;

  if (value === undefined || value === null || value === '') {
    return '';
  }

  return String(value);
}

function buildBadge(title, index) {
  const first = String(title || '')
    .trim()
    .charAt(0)
    .toUpperCase();
  if (first) return first;
  return String(index + 1);
}

function getCallStatusEmoji(classItem) {
  return classItem?.chamada_ja_feita ? '✅' : '🟡';
}

function buildErrorTrace(error, context, classItem = null) {
  const pieces = [
    `Contexto: ${context || 'Erro na interface'}`,
    classItem?.nome ? `Classe: ${classItem.nome}` : '',
    classItem?.id_classe || classItem?.id || classItem?.classId ? `ClassId: ${classItem.id_classe || classItem?.id || classItem?.classId}` : '',
    error?.name ? `Nome: ${error.name}` : '',
    error?.message ? `Mensagem: ${error.message}` : '',
    error?.status ? `Status: ${error.status}` : '',
    error?.stack ? `Stack:\n${error.stack}` : ''
  ].filter(Boolean);

  return pieces.join('\n\n');
}

function normalizeError(error, fallbackMessage) {
  if (error instanceof Error) {
    return error;
  }

  const normalized = new Error(String(fallbackMessage || error || 'Erro desconhecido'));
  if (error && typeof error === 'object') {
    if ('status' in error) {
      normalized.status = error.status;
    }
    if ('payload' in error) {
      normalized.payload = error.payload;
    }
  }

  return normalized;
}

function openErrorDialog({ message, trace }) {
  if (!window.APP_ERROR_DIALOG?.open) {
    window.alert(`${message}\n\n${trace || ''}`.trim());
    return;
  }

  const dialog = window.APP_ERROR_DIALOG.ensure?.();
  if (dialog?.open) {
    return;
  }

  window.APP_ERROR_DIALOG.open({
    title: 'Erro',
    message: message || 'Houve um erro. Fale com o suporte para corrigir.',
    trace: trace || ''
  });
}


function resolveAccessDeniedMessage(error) {
  const message = normalizeTextValue(error?.backendMessage) ||
    normalizeTextValue(error?.primaryMessage) ||
    normalizeTextValue(error?.message) ||
    'Você não tem permissão para executar esta ação.';

  return message;
}

function openAccessDeniedDialog(error, context) {
  const message = resolveAccessDeniedMessage(error);
  if (APP_ACCESS_DENIED_DIALOG?.open) {
    APP_ACCESS_DENIED_DIALOG.open({
      title: 'Erro',
      message,
      hideTargets: ['.classes-shell']
    });
    return;
  }

  window.alert(message);
}

function normalizeTextValue(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  return '';
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function goToLogin() {
  window.location.replace('../../../../../index.html');
}
