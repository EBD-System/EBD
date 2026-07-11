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
  setFeedback('error', message);
}

function apiUrl(params = {}) {
  const url = new URL(APPS_SCRIPT_URL);
  Object.entries(params).forEach(([key, value]) => {
    const normalizedValue = key === 'action' && typeof value === 'string'
      ? value.trim().toLowerCase()
      : value;
    url.searchParams.set(key, normalizedValue);
    if (key === 'action' && normalizedValue !== undefined && normalizedValue !== null) {
      url.searchParams.set('acao', normalizedValue);
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
    throw new Error(text || `HTTP ${response.status}`);
  }

  if (!response.ok || data.ok === false) {
    throw new Error(data.message || `HTTP ${response.status}`);
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
      throw new Error('A requisição demorou demais. Verifique sua conexão e tente novamente.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function apiPost(params = {}, { timeoutMs = 30000 } = {}) {
  const bodyParams = new URLSearchParams();
  const queryParams = {};
  const actionName = String(params.action || params.acao || '').trim().toLowerCase();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    const normalizedValue = key === 'action' && typeof value === 'string'
      ? value.trim().toLowerCase()
      : value;
    bodyParams.set(key, String(normalizedValue));
    queryParams[key] = normalizedValue;
    if (key === 'action') {
      bodyParams.set('acao', String(normalizedValue));
      queryParams.acao = normalizedValue;
    }
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(5000, Number(timeoutMs) || 30000));

  const shouldRetryAsGet = (err) => {
    const message = String(err?.message || err || '');
    return actionName === 'updatealuno' && /ação inválida|acao inválida|action invalid|aç[aã]o inválida/i.test(message);
  };

  try {
    const response = await fetch(apiUrl(queryParams), {
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
        const fallbackResponse = await fetch(apiUrl(queryParams), {
          method: 'GET',
          mode: 'cors',
          cache: 'no-store',
          signal: controller.signal,
        });
        return await parseJsonResponse(fallbackResponse);
      }
      throw err;
    }
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error('O salvamento demorou demais. Verifique sua conexão e tente novamente.');
    }
    throw err;
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
