function normalizePresenceValue(value) {
  const v = String(value || '').trim().toLowerCase();
  if (['atrasado', 'atrasada', 'late', 'delay'].includes(v)) return 'atrasado';
  if (['sim', 'presente', '1', 'p', 'true'].includes(v)) return 'sim';
  return 'nao';
}

function normalizeSalvoValue(value) {
  const v = String(value ?? '').trim().toLowerCase();
  return v === '1' || v === 'sim' || v === 'true' ? 1 : 0;
}

function getSavedCount(call) {
  return getMarkedRows(call).length;
}

function getSavedTotalLabelData(call) {
  const total = getAllActiveRows(call).length;
  const saved = getSavedCount(call);
  return {
    total,
    saved,
    complete: total === saved,
  };
}

function isSavedRow(row = {}) {
  return normalizeSalvoValue(row.salvo ?? row.SALVO) === 1;
}

function isPresentLikeValue(value) {
  return normalizePresenceValue(value) !== 'nao';
}

function isDelayedValue(value) {
  return normalizePresenceValue(value) === 'atrasado';
}

function syncRowPresenceFields(row = {}) {
  const delay = isDelayedValue(row.presenca) || normalizeBoolValue(row.atraso);
  const presence = delay ? 'atrasado' : normalizePresenceValue(row.presenca);
  const salvo = normalizeSalvoValue(row.salvo ?? row.SALVO);

  row.presenca = presence;
  row.atraso = delay;
  row.salvo = salvo;
  row.SALVO = salvo;
  return row;
}

function normalizeBoolValue(value) {
  const v = String(value || '').toLowerCase().trim();
  return v === 'sim' || v === 'true' || v === '1' || v === 'yes' || v === 'y';
}

function nowIso() {
  return new Date().toISOString();
}

function createAppError(message, meta = {}) {
  const err = message instanceof Error ? message : new Error(String(message || 'Erro desconhecido.'));
  err.source = String(meta.source || err.source || 'frontend').toLowerCase();
  err.stage = String(meta.stage || err.stage || '').trim();
  if (meta.status !== undefined) err.status = meta.status;
  if (meta.details !== undefined) err.details = meta.details;
  if (meta.raw !== undefined) err.raw = meta.raw;
  return err;
}

function normalizeAppError(error, fallbackSource = 'frontend') {
  if (error instanceof Error) {
    return createAppError(error, {
      source: error.source || fallbackSource,
      stage: error.stage || '',
      status: error.status,
      details: error.details,
      raw: error.raw,
    });
  }

  if (typeof error === 'string') {
    return createAppError(error, { source: fallbackSource });
  }

  const message = error?.message || error?.error || 'Erro desconhecido.';
  return createAppError(message, {
    source: error?.source || fallbackSource,
    stage: error?.stage || '',
    status: error?.status,
    details: error?.details,
    raw: error?.raw,
  });
}

function formatAppError(error, context = '') {
  const info = normalizeAppError(error);
  const sourceLabel = info.source === 'backend' ? 'BACKEND' : 'FRONTEND';
  const contextLabel = String(context || '').trim();
  const stageLabel = info.stage ? ` (${info.stage})` : '';
  const prefix = contextLabel ? `${contextLabel}: ` : '';
  return `[${sourceLabel}]${stageLabel} ${prefix}${info.message}`.trim();
}

function appendDebugConsoleLine(text) {
  if (!isDebugConsoleEnabled()) return;

  const consoleBox = document.getElementById('debugConsole');
  if (!consoleBox) return;

  const line = String(text || '').trim();
  if (!line) return;

  const current = String(consoleBox.textContent || '').trim();
  const next = current ? `${current}
${line}` : line;
  const lines = next.split('\n').filter(Boolean);
  consoleBox.textContent = lines.slice(-12).join('\n');
  consoleBox.scrollTop = consoleBox.scrollHeight;
}

function reportAppError(error, context = '', logToBrowserConsole = true) {
  const info = normalizeAppError(error);
  const message = formatAppError(info, context);
  appendDebugConsoleLine(message);

  if (logToBrowserConsole && isDebugConsoleEnabled()) {
    const payload = {
      source: info.source,
      stage: info.stage || '',
      status: info.status,
      details: info.details,
      raw: info.raw,
      context: String(context || '').trim() || undefined,
    };
    console.log(message, payload);
  }

  return message;
}

function buildWhatsAppEditUrl(alunoNome, turmaNome) {
  const phone = '5571981768164';
  const message = `Olá, eu gostaria de editar o aluno [${String(alunoNome || '').trim()}], da classe [${String(turmaNome || '').trim()}].`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
function setFeedback(type, message) {
  els.feedback.className = `feedback show ${type}`;
  els.feedback.textContent = message;
}

function clearFeedback() {
  els.feedback.className = 'feedback';
  els.feedback.textContent = '';
}

function showBusy(message) {
  setFeedback('info', message);
}

function showSuccess(message) {
  setFeedback('success', message);
}

function showError(message) {
  const text = String(message || '');
  setFeedback('error', text);

  if (text) {
    const debugText = /^\[(BACKEND|FRONTEND)\]/i.test(text) ? text : `[FRONTEND] ${text}`;
    appendDebugConsoleLine(debugText);
    if (isDebugConsoleEnabled()) {
      console.log(debugText);
    }
  }
}

function apiUrl(params = {}) {
  if (!BACKEND_API_URL || String(BACKEND_API_URL).includes('COLE_AQUI')) {
    throw createAppError('Configure a URL da API do backend PostgreSQL antes de continuar.', {
      source: 'frontend',
      stage: 'config',
    });
  }

  const url = new URL(BACKEND_API_URL, window.location.href);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    const normalizedValue = key === 'action' && typeof value === 'string'
      ? value.trim().toLowerCase()
      : value;
    url.searchParams.set(key, String(normalizedValue));
    if (key === 'action') {
      url.searchParams.set('acao', String(normalizedValue));
    }
  });
  return url.toString();
}

async function parseJsonResponse(response) {
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (err) {
    throw createAppError(text || `HTTP ${response.status}`, {
      source: 'backend',
      stage: 'parse-json',
      status: response.status,
      raw: text,
    });
  }

  if (!response.ok || data.ok === false) {
    throw createAppError(data.message || `HTTP ${response.status}`, {
      source: data.source || 'backend',
      stage: data.stage || 'backend-response',
      status: response.status,
      details: data.details,
      raw: data,
    });
  }

  return data;
}


async function apiGet(params = {}, { timeoutMs = 30000 } = {}) {

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(5000, Number(timeoutMs) || 30000));
  try {
    const response = await fetch(apiUrl(params), {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store',
      signal: controller.signal,
    });
    return await parseJsonResponse(response);
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw createAppError('A requisição demorou demais. Verifique sua conexão e tente novamente.', {
        source: 'frontend',
        stage: 'timeout',
      });
    }

    const message = String(err?.message || err || '');
    if (/failed to fetch|networkerror|fetch failed/i.test(message)) {
      throw createAppError(`Falha de comunicação com o backend PostgreSQL: ${message || 'Failed to fetch'}`, {
        source: 'frontend',
        stage: 'network',
        raw: message || err,
      });
    }

    throw normalizeAppError(err, 'frontend');
  } finally {
    clearTimeout(timer);
  }
}

async function apiPost(params = {}, { timeoutMs = 30000 } = {}) {

  const bodyParams = new URLSearchParams();
  const queryParams = {};
  const actionName = String(params.action || params.acao || '').trim().toLowerCase();
  const mirrorAllParamsInQuery = ['addaluno', 'addturma', 'updatealuno', 'register'].includes(actionName);

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;

    const normalizedValue = key === 'action' && typeof value === 'string'
      ? value.trim().toLowerCase()
      : value;

    bodyParams.set(key, String(normalizedValue));

    // O body sempre leva o payload completo.
    // A query string só espelha todos os campos quando existe fallback por GET.
    if (mirrorAllParamsInQuery) {
      queryParams[key] = normalizedValue;
    }

    if (key === 'action') {
      bodyParams.set('acao', String(normalizedValue));
      queryParams.action = normalizedValue;
      queryParams.acao = normalizedValue;
    }
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(5000, Number(timeoutMs) || 30000));

  const shouldRetryAsGet = (err) => {
    const message = String(err?.message || err || '');
    return (
      ['addaluno', 'addturma', 'updatealuno', 'register'].includes(actionName) &&
      /failed to fetch|networkerror|fetch failed|ação inválida|acao inválida|action invalid|aç[aã]o inválida/i.test(message)
    );
  };

  const sendGetFallback = async () => {
    const fallbackResponse = await fetch(apiUrl(queryParams), {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store',
      signal: controller.signal,
    });
    return parseJsonResponse(fallbackResponse);
  };

  try {
    const requestUrl = apiUrl({
      action: queryParams.action,
      acao: queryParams.acao,
      ...(mirrorAllParamsInQuery ? queryParams : {}),
    });

    const response = await fetch(requestUrl, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: bodyParams.toString(),
      signal: controller.signal,
    });

    try {
      return await parseJsonResponse(response);
    } catch (err) {
      if (shouldRetryAsGet(err)) {
        return await sendGetFallback();
      }
      throw normalizeAppError(err, 'backend');
    }
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw createAppError('O salvamento demorou demais. Verifique sua conexão e tente novamente.', {
        source: 'frontend',
        stage: 'timeout',
      });
    }

    const message = String(err?.message || err || '');
    if (/failed to fetch|networkerror|fetch failed/i.test(message)) {
      throw createAppError(`Falha de comunicação com o backend PostgreSQL: ${message || 'Failed to fetch'}`, {
        source: 'frontend',
        stage: 'network',
        raw: message || err,
      });
    }

    if (shouldRetryAsGet(err)) {
      return await sendGetFallback();
    }

    throw normalizeAppError(err, 'frontend');
  } finally {
    clearTimeout(timer);
  }
}

function storageState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
  } catch (err) {
    return {};
  }
}

function saveStorageState(next) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function readJsonStorage(key, fallback = null) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
  } catch (err) {
    return fallback;
  }
}

function writeJsonStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}


function safeClone(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (err) {
    return value;
  }
}

function ensureStorageStateShape() {
  const store = storageState();
  if (!store.savedCallsByDate || typeof store.savedCallsByDate !== 'object') {
    store.savedCallsByDate = {};
  }
  return store;
}

function cloneLocalRow(row = {}) {
  const cloned = {
    alunoId: row.alunoId ?? '',
    nome: row.nome ?? '',
    codigo: row.codigo ?? '',
    ordemCadastro: row.ordemCadastro ?? '',
    presenca: row.presenca ?? 'nao',
    atraso: !!row.atraso,
    salvo: normalizeSalvoValue(row.salvo ?? row.SALVO),
    SALVO: normalizeSalvoValue(row.salvo ?? row.SALVO),
    observacao: row.observacao ?? '',
    statusAluno: row.statusAluno ?? 'ativo',
  };

  if (row.autoPresenca !== undefined) cloned.autoPresenca = row.autoPresenca;
  if (row.autoAtraso !== undefined) cloned.autoAtraso = row.autoAtraso;
  if (row.ausSeguidas !== undefined) cloned.ausSeguidas = row.ausSeguidas;

  return syncRowPresenceFields(cloned);
}

function cloneLocalCall(call = {}, syncStatus = 'synced') {
  const rows = Array.isArray(call.rows) ? call.rows.map((row) => cloneLocalRow(row)) : [];
  const activeRows = rows.filter((row) => String(row.statusAluno || 'ativo').trim().toLowerCase() !== 'inativo');

  return {
    chamadaId: String(call.chamadaId || `${call.turmaId || ''}_${call.data || state.dateKey || todayKey()}`).trim(),
    data: String(call.data || state.dateKey || todayKey()),
    turmaId: String(call.turmaId || '').trim(),
    turmaNome: String(call.turmaNome || '').trim(),
    oferta: call.oferta ?? '',
    visitantes: Number(call.visitantes ?? 0) || 0,
    biblias: Number(call.biblias ?? 0) || 0,
    revistas: Number(call.revistas ?? 0) || 0,
    totalAlunos: Number(call.totalAlunos ?? activeRows.length) || 0,
    presentes: Number(call.presentes ?? activeRows.filter((row) => isPresentLikeValue(row.presenca)).length) || 0,
    atrasos: Number(call.atrasos ?? activeRows.filter((row) => isDelayedValue(row.presenca)).length) || 0,
    ausentes: Number(call.ausentes ?? activeRows.filter((row) => normalizePresenceValue(row.presenca) === 'nao').length) || 0,
    percentual: Number(call.percentual ?? 0) || 0,
    enviadoTelegram: !!call.enviadoTelegram,
    telegramEnviadoEm: call.telegramEnviadoEm || '',
    rows,
    isSaved: true,
    savedAt: nowIso(),
    syncStatus,
  };
}

function saveLocalSavedCall(call, syncStatus = 'synced') {
  const turmaId = String(call?.turmaId || '').trim();
  const dateKey = String(call?.data || state.dateKey || todayKey()).trim();

  if (!turmaId || !dateKey) {
    return null;
  }

  const store = ensureStorageStateShape();
  const snapshot = cloneLocalCall(call, syncStatus);
  const dateBucket = store.savedCallsByDate[dateKey] || {
    dateKey,
    updatedAt: '',
    callsByTurma: {},
  };

  dateBucket.dateKey = dateKey;
  dateBucket.updatedAt = nowIso();
  dateBucket.callsByTurma = dateBucket.callsByTurma && typeof dateBucket.callsByTurma === 'object'
    ? dateBucket.callsByTurma
    : {};
  dateBucket.callsByTurma[turmaId] = snapshot;

  store.savedCallsByDate[dateKey] = dateBucket;
  saveStorageState(store);
  return safeClone(snapshot);
}

function loadLocalSavedCallsSnapshot(dateKey = state.dateKey) {
  const store = storageState();
  const key = String(dateKey || '').trim();
  const bucket = key && store.savedCallsByDate && store.savedCallsByDate[key];
  if (!bucket || typeof bucket !== 'object') {
    return null;
  }

  const callsByTurma = {};
  Object.entries(bucket.callsByTurma || {}).forEach(([turmaId, call]) => {
    if (!turmaId || !call) return;
    callsByTurma[turmaId] = safeClone(call);
  });

  return {
    dateKey: bucket.dateKey || key,
    updatedAt: bucket.updatedAt || '',
    callsByTurma,
  };
}

function mergeCallsByTurma_(baseCalls = {}, overlayCalls = {}) {
  const merged = { ...(baseCalls || {}) };
  Object.entries(overlayCalls || {}).forEach(([turmaId, call]) => {
    if (!turmaId || !call) return;
    merged[turmaId] = safeClone(call);
  });
  return merged;
}

function hydrateLocalSavedCallsIntoState(dateKey = state.dateKey) {
  const snapshot = loadLocalSavedCallsSnapshot(dateKey);
  if (!snapshot) return null;

  state.chamadasByTurma = mergeCallsByTurma_(state.chamadasByTurma || {}, snapshot.callsByTurma || {});
  return snapshot;
}

function loadRosterCache() {
  const cache = readJsonStorage(ROSTER_CACHE_KEY, null);
  if (!cache || cache.version !== ROSTER_CACHE_VERSION) return null;
  return cache;
}


function withTimeout(promise, ms, errorMessage) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(errorMessage || 'Tempo excedido.')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function saveRosterCache() {
  const snapshot = {
    version: ROSTER_CACHE_VERSION,
    savedAt: new Date().toISOString(),
    dateKey: state.dateKey,
    selectedTurmaId: state.selectedTurmaId || '',
    turmas: state.turmas || [],
    alunos: state.alunos || [],
  };

  writeJsonStorage(ROSTER_CACHE_KEY, snapshot);
}

function rosterFingerprintTurma(turma) {
  return [
    turma?.TurmaID ?? '',
    turma?.Nome ?? '',
    turma?.Ordem ?? '',
  ].join('|');
}

function rosterFingerprintAluno(aluno) {
  return [
    aluno?.AlunoID ?? '',
    aluno?.Nome ?? '',
    aluno?.TurmaID ?? '',
    aluno?.Status ?? '',
    aluno?.Ativo ?? '',
    aluno?.FaltandoMuito ?? '',
    aluno?.Reativado ?? '',
    aluno?.Percentual ?? '',
    aluno?.TotalFaltas ?? '',
    aluno?.FaltasConsecutivas ?? '',
    aluno?.RealocadoDe ?? '',
  ].join('|');
}

function mergeById(prevList = [], nextList = [], idField, fingerprintFn = null) {
  const prevMap = new Map(
    (prevList || []).map((item) => [String(item?.[idField] ?? ''), item])
  );

  return (nextList || []).map((nextItem) => {
    const key = String(nextItem?.[idField] ?? '');
    const prevItem = prevMap.get(key);

    if (prevItem && fingerprintFn && fingerprintFn(prevItem) === fingerprintFn(nextItem)) {
      return prevItem;
    }

    return prevItem ? { ...prevItem, ...nextItem } : nextItem;
  });
}

function buildStudentRowFromAluno(aluno) {
  return syncRowPresenceFields({
    alunoId: aluno.AlunoID,
    nome: aluno.Nome,
    codigo: aluno.OrdemCadastro || '',
    ordemCadastro: aluno.OrdemCadastro || '',
    presenca: 'nao',
    atraso: false,
    salvo: 0,
    observacao: '',
    statusAluno: aluno.Status || 'ativo',
  });
}

function buildSyncedCall(turma, serverCall = null, draft = null) {
  const roster = getAlunosForTurma(turma.TurmaID);
  const serverRows = Array.isArray(serverCall?.rows) ? serverCall.rows : [];
  const draftRows = Array.isArray(draft?.rows) ? draft.rows : [];

  const serverRowsMap = new Map(
    serverRows.map((row) => [String(row?.alunoId ?? ''), row])
  );
  const draftRowsMap = new Map(
    draftRows.map((row) => [String(row?.alunoId ?? ''), row])
  );

  const rows = roster.map((aluno) => {
    const base = buildStudentRowFromAluno(aluno);
    const serverRow = serverRowsMap.get(String(aluno.AlunoID || '')) || null;
    const draftRow = draftRowsMap.get(String(aluno.AlunoID || '')) || null;

    const merged = syncRowPresenceFields({
      ...base,
      ...(serverRow || {}),
      ...(draftRow || {}),
    });

    merged.alunoId = base.alunoId;
    merged.nome = draftRow?.nome ?? serverRow?.nome ?? base.nome;
    merged.statusAluno = draftRow?.statusAluno ?? serverRow?.statusAluno ?? base.statusAluno;

    return merged;
  });

  const presentCount = rows.filter((r) => isPresentLikeValue(r.presenca) && isSavedRow(r)).length;
  const delayCount = rows.filter((r) => isDelayedValue(r.presenca) && isSavedRow(r)).length;
  const absentCount = rows.filter((r) => isSavedRow(r) && normalizePresenceValue(r.presenca) === 'nao').length;
  const neutralCount = rows.filter((r) => !isSavedRow(r)).length;
  const total = rows.length;

  return {
    chamadaId: serverCall?.chamadaId || callKey(state.dateKey, turma.TurmaID),
    data: serverCall?.data || state.dateKey,
    turmaId: turma.TurmaID,
    turmaNome: turma.Nome,
    oferta: draft?.oferta ?? serverCall?.oferta ?? '',
    visitantes: Number(draft?.visitantes ?? serverCall?.visitantes ?? 0) || 0,
    biblias: Number(draft?.biblias ?? serverCall?.biblias ?? 0) || 0,
    revistas: Number(draft?.revistas ?? serverCall?.revistas ?? 0) || 0,
    //visitantesTexto: draft?.visitantesTexto ?? serverCall?.visitantesTexto ?? '',
    totalAlunos: total,
    presentes: presentCount,
    atrasos: delayCount,
    ausentes: absentCount,
    neutros: neutralCount,
    percentual: total ? (presentCount / total) * 100 : 0,
    enviadoTelegram: !!serverCall?.enviadoTelegram,
    telegramEnviadoEm: serverCall?.telegramEnviadoEm || '',
    rows,
    isSaved: !!serverCall?.isSaved && !draft,
  };
}

function hydrateRosterFromCache() {
  const cache = loadRosterCache();
  if (!cache) return false;

  state.turmas = Array.isArray(cache.turmas) ? cache.turmas : [];
  state.alunos = Array.isArray(cache.alunos) ? cache.alunos : [];

  if (cache.selectedTurmaId) {
    state.selectedTurmaId = cache.selectedTurmaId;
  }

  return state.turmas.length > 0 || state.alunos.length > 0;
}
