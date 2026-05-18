const APPS_SCRIPT_URL =
  window.APPS_SCRIPT_URL ||
  'https://script.google.com/macros/s/AKfycbxqqMq1jnkQ3c_5KjEW7i6a0EZgXiy-hqduShtvpeRl-4olRKc6cEKFPAH1C42HZQ2kUw/exec';

const STORAGE_KEY = 'prb_presenca_turmas_v2';
const ROSTER_CACHE_KEY = 'prb_roster_cache_v1';
const ROSTER_CACHE_VERSION = 1;
const showDebugBox = false;

// Se false, o carregamento inicial usa somente o que vem do backend.
// Se true, o rascunho local pode voltar a ser aplicado quando existir.
const APPLY_LOCAL_DRAFTS_ON_LOAD = false;

const state = {
  syncToken: 0,
  loading: false,
  dateKey: todayKey(),
  turmas: [],
  alunos: [],
  chamadasByTurma: {},
  resumoGeral: null,
  selectedTurmaId: '',
  search: '',
  showInactive: true,
  dirty: false,
  initialized: false,
  autosaveTimer: null,
  accessCode: '',
  accessMode: 'restricted',
  baseRowsCount: 0,
};

const ACCESS_CODES = {
  full: new Set(['50292230']),
  restricted: new Set(['ninha', 'professor1', 'professor2']),
};

const els = {
  dateInput: document.getElementById('dateInput'),
  turmaSelect: document.getElementById('turmaSelect'),
  alunoTurma: document.getElementById('alunoTurma'),
  searchInput: document.getElementById('searchInput'),
  showInactive: document.getElementById('showInactive'),
  reloadBtn: document.getElementById('reloadBtn'),
  clearBtn: document.getElementById('clearBtn'),
  saveBtn: document.getElementById('saveBtn'),
  sendTurmaBtn: document.getElementById('sendTurmaBtn'),
  sendGeralBtn: document.getElementById('sendGeralBtn'),
  saveNextBtn: document.getElementById('saveNextBtn'),
  markAllPresentBtn: document.getElementById('markAllPresentBtn'),
  markAllAbsentBtn: document.getElementById('markAllAbsentBtn'),
  copyTurmaBtn: document.getElementById('copyTurmaBtn'),
  copyGeralBtn: document.getElementById('copyGeralBtn'),
  turmaForm: document.getElementById('turmaForm'),
  turmaNome: document.getElementById('turmaNome'),
  turmaOrdem: document.getElementById('turmaOrdem'),
  alunoForm: document.getElementById('alunoForm'),
  alunoNome: document.getElementById('alunoNome'),
  alunoCpf: document.getElementById('alunoCpf'),
  feedback: document.getElementById('feedback'),
  turmaMeta: document.getElementById('turmaMeta'),
  summary: {
    total: document.getElementById('statTotalAlunos'),
    presentes: document.getElementById('statPresentes'),
    ausentes: document.getElementById('statAusentes'),
    percentual: document.getElementById('statPercentual'),
    oferta: document.getElementById('statOferta'),
    visitantes: document.getElementById('statVisitantes'),
    biblias: document.getElementById('statBiblias'),
    revistas: document.getElementById('statRevistas'),
  },
  studentsList: document.getElementById('studentsList'),
  emptyState: document.getElementById('emptyState'),
  studentTemplate: document.getElementById('studentTemplate'),
  turmaReport: document.getElementById('turmaReport'),
  geralReport: document.getElementById('geralReport'),
};

let loadingCount = 0;
let loadingWatchdog = null;
let loadingWatchdogMessage = 'A operação demorou demais. Tente novamente.';

function ensureLoadingOverlay() {
  if (document.getElementById('loadingOverlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'loadingOverlay';
  overlay.className = 'loading-overlay';
  overlay.innerHTML = `
    <div class="loading-card">
      <div class="loading-spinner"></div>
      <div class="loading-text">Carregando...</div>
    </div>
  `;

  document.body.appendChild(overlay);
}

function scheduleLoadingWatchdog(timeoutMs = 35000, message = loadingWatchdogMessage) {
  if (loadingWatchdog) clearTimeout(loadingWatchdog);
  loadingWatchdogMessage = message || loadingWatchdogMessage;
  loadingWatchdog = setTimeout(() => {
    loadingWatchdog = null;
    loadingCount = 0;
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.remove('show');
    showError(loadingWatchdogMessage);
  }, Math.max(5000, Number(timeoutMs) || 35000));
}

function clearLoadingWatchdog() {
  if (loadingWatchdog) {
    clearTimeout(loadingWatchdog);
    loadingWatchdog = null;
  }
}

function clearAutosaveTimer() {
  if (state.autosaveTimer) {
    clearTimeout(state.autosaveTimer);
    state.autosaveTimer = null;
  }
}


function showLoading(message = 'Carregando...', timeoutMs = 35000) {
  ensureLoadingOverlay();

  const overlay = document.getElementById('loadingOverlay');
  const text = overlay.querySelector('.loading-text');

  if (text) text.textContent = message;

  loadingCount += 1;
  overlay.classList.add('show');
  scheduleLoadingWatchdog(timeoutMs, 'A operação demorou demais e foi cancelada. Tente novamente.');
}

function hideLoading(force = false) {
  if (force) {
    loadingCount = 0;
    clearLoadingWatchdog();
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.remove('show');
    return;
  }

  loadingCount = Math.max(0, loadingCount - 1);

  if (loadingCount === 0) {
    clearLoadingWatchdog();
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.remove('show');
  }
}

function forceHideLoading() {
  hideLoading(true);
}

function todayKey() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(Date.now() - tz).toISOString().slice(0, 10);
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function formatCpf(value) {
  const d = onlyDigits(value).slice(0, 11);
  const p1 = d.slice(0, 3);
  const p2 = d.slice(3, 6);
  const p3 = d.slice(6, 9);
  const p4 = d.slice(9, 11);
  let out = '';
  if (p1) out += p1;
  if (p2) out += `.${p2}`;
  if (p3) out += `.${p3}`;
  if (p4) out += `-${p4}`;
  return out;
}

function isModifierKey(event) {
  return !!(event?.ctrlKey || event?.metaKey || event?.altKey);
}

function formatTensToBRL(event) {
  if (!event?.target) return;
  if (isModifierKey(event)) return;

  const digits = String(event.target.value || '').replace(/\D/g, '');
  const cents = digits.padStart(3, '0');
  const number = Number(cents) / 100;

  event.target.value = number.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function parseCurrencyBR(value) {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  let str = String(value).trim();

  if (!str) {
    return 0;
  }

  // Remove tudo que não for número, vírgula, ponto ou sinal de menos
  str = str.replace(/[^\d.,-]/g, '');

  if (!str) {
    return 0;
  }

  const hasComma = str.includes(',');
  const hasDot = str.includes('.');

  if (hasComma && hasDot) {
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');

    if (lastComma > lastDot) {
      str = str.replace(/\./g, '');
      str = str.replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (hasComma) {
    str = str.replace(/\./g, '');
    str = str.replace(',', '.');
  } else if (hasDot) {
    const parts = str.split('.');
    if (parts.length > 2) {
      str = parts.join('');
    }
  }

  const num = Number(str);
  return Number.isFinite(num) ? num : 0;
}

function formatCurrencyBR(value) {

  const number = parseCurrencyBR(value);

  return number.toLocaleString(
    'pt-BR',
    {
      style: 'currency',
      currency: 'BRL',
    }
  );
}

function formatMoney(value) {

  const n =
    value === null ||
    value === undefined ||
    value === ''
      ? 0
      : Number(value);

  try {

    return n.toLocaleString(
      'pt-BR',
      {
        style: 'currency',
        currency: 'BRL',
      }
    );

  } catch (err) {

    return `R$ ${n.toFixed(2)}`;
  }
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1).replace('.', ',')}%`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getAccessCodeFromUrl() {
  try {
    return String(new URLSearchParams(window.location.search).get('code') || '').trim().toLowerCase();
  } catch (err) {
    return '';
  }
}

function resolveAccessMode(code) {
  const normalized = String(code || '').trim().toLowerCase();
  if (ACCESS_CODES.full.has(normalized)) return 'full';
  if (ACCESS_CODES.restricted.has(normalized)) return 'restricted';
  return 'restricted';
}

function isRestrictedMode() {
  return state.accessMode !== 'full';
}

function applyAccessMode() {
  document.body.classList.toggle('access-restricted', isRestrictedMode());
  document.body.classList.toggle('access-full', !isRestrictedMode());
}


function normalizePresenceValue(value) {
  const v = String(value || '').trim().toLowerCase();
  if (['atrasado', 'atrasada', 'late', 'delay'].includes(v)) return 'atrasado';
  if (['sim', 'presente', '1', 'p', 'true'].includes(v)) return 'sim';
  return 'nao';
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
  row.presenca = presence;
  row.atraso = delay;
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
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
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
  const formData = new FormData();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) formData.append(key, value);
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(5000, Number(timeoutMs) || 30000));
  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-store',
      body: formData,
      signal: controller.signal,
    });
    return await parseJsonResponse(response);
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
    presenca: 'nao',
    atraso: false,
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

  const presentCount = rows.filter((r) => isPresentLikeValue(r.presenca)).length;
  const delayCount = rows.filter((r) => isDelayedValue(r.presenca)).length;
  const absentCount = rows.length - presentCount;

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
    totalAlunos: rows.length,
    presentes: presentCount,
    atrasos: delayCount,
    ausentes: absentCount,
    percentual: rows.length ? (presentCount / rows.length) * 100 : 0,
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

function callKey(dateKey, turmaId) {
  return `${dateKey}_${turmaId}`;
}

function getTurmasSorted() {
  return [...state.turmas].sort((a, b) => {
    const oa = Number(a.Ordem || 0) || 0;
    const ob = Number(b.Ordem || 0) || 0;
    if (oa !== ob) return oa - ob;
    return String(a.Nome || '').localeCompare(String(b.Nome || ''));
  });
}

function getAlunosForTurma(turmaId) {
  return state.alunos
    .filter((a) => String(a.TurmaID || '') === String(turmaId || ''))
    .sort((a, b) => {
      const ia = String(a.Status || 'ativo') === 'inativo' ? 1 : 0;
      const ib = String(b.Status || 'ativo') === 'inativo' ? 1 : 0;
      if (ia !== ib) return ia - ib;
      return String(a.Nome || '').localeCompare(String(b.Nome || ''));
    });
}

function blankCallForTurma(turma) {
  const roster = getAlunosForTurma(turma.TurmaID);
  const activeRoster = roster.filter((aluno) =>
    String(aluno.Status || 'ativo').trim().toLowerCase() !== 'inativo'
  );

  return {
    chamadaId: `${turma.TurmaID}_${state.dateKey}`,
    data: state.dateKey,
    turmaId: turma.TurmaID,
    turmaNome: turma.Nome,
    oferta: '',
    visitantes: 0,
    biblias: 0,
    revistas: 0,
    //visitantesTexto: '',
    totalAlunos: activeRoster.length,
    presentes: 0,
    atrasos: 0,
    ausentes: activeRoster.length,
    percentual: 0,
    enviadoTelegram: false,
    telegramEnviadoEm: '',
    rows: roster.map((aluno) => syncRowPresenceFields({
      alunoId: aluno.AlunoID,
      nome: aluno.Nome,
      presenca: 'nao',
      atraso: false,
      observacao: '',
      statusAluno: aluno.Status || 'ativo',
    })),
    isSaved: false,
  };
}
function restoreDraft(call) {
  if (!APPLY_LOCAL_DRAFTS_ON_LOAD) return call;

  const drafts = storageState().drafts || {};
  const draft = drafts[call.chamadaId];
  if (!draft) return call;

  return {
    ...call,
    oferta: draft.oferta ?? call.oferta,
    visitantes: draft.visitantes ?? call.visitantes,
    biblias: draft.biblias ?? call.biblias,
    revistas: draft.revistas ?? call.revistas,
    //visitantesTexto: draft.visitantesTexto ?? call.visitantesTexto,
    rows: Array.isArray(draft.rows)
      ? draft.rows.map((row) => syncRowPresenceFields({ ...row }))
      : call.rows,
    isSaved: draft.isSaved === true ? true : call.isSaved,
  };
}

function persistDraft(call) {
  const data = storageState();
  data.drafts = data.drafts || {};
  data.drafts[call.chamadaId] = {
    oferta: call.oferta,
    visitantes: call.visitantes,
    biblias: call.biblias,
    revistas: call.revistas,
    //visitantesTexto: call.visitantesTexto || '',
    rows: call.rows.map((row) => syncRowPresenceFields({
      alunoId: row.alunoId,
      nome: row.nome,
      presenca: row.presenca,
      atraso: row.atraso,
      observacao: row.observacao || '',
      statusAluno: row.statusAluno || '',
    })),
    isSaved: false,
    updatedAt: new Date().toISOString(),
  };
  saveStorageState(data);
}

function clearDraft(callId) {
  const data = storageState();
  if (data.drafts) {
    delete data.drafts[callId];
    saveStorageState(data);
  }
}

function setCurrentCall(call) {
  state.chamadasByTurma[call.turmaId] = call;
  state.dirty = false;
}

function getCurrentTurma() {
  return getTurmasSorted().find((t) => String(t.TurmaID || '') === String(state.selectedTurmaId || '')) || null;
}

function getCurrentCall() {
  const turma = getCurrentTurma();
  if (!turma) return null;
  let call = state.chamadasByTurma[turma.TurmaID];
  if (!call) {
    call = blankCallForTurma(turma);
    call = restoreDraft(call);
    state.chamadasByTurma[turma.TurmaID] = call;
  }
  return call;
}

function updateCallFromInputs() {
  const call = getCurrentCall();

  if (!call) return;

  call.data = state.dateKey;

  const ofertaInput = document.getElementById('ofertaInput');
  const visitantesInput = document.getElementById('visitantesInput');
  const bibliasInput = document.getElementById('bibliasInput');
  const revistasInput = document.getElementById('revistasInput');
  // ANTIGO // const visitantesTextoInput = document.getElementById('visitantesTextoInput');

  // OFERTA
  call.oferta = parseCurrencyBR(ofertaInput?.value ?? 0);

  // VISITANTES
  call.visitantes =
    visitantesInput?.value === ''
      ? 0
      : Number(visitantesInput.value);

  // BÍBLIAS
  call.biblias =
    bibliasInput?.value === ''
      ? 0
      : Number(bibliasInput.value);

  // REVISTAS
  call.revistas =
    revistasInput?.value === ''
      ? 0
      : Number(revistasInput.value);

  // TEXTO VISITANTES
  // ANTIGO // call.visitantesTexto = visitantesTextoInput?.value?.trim?.() ?? '';

  console.log('[updateCallFromInputs]', {
    ofertaInput: ofertaInput?.value,
    ofertaFinal: call.oferta,
  });
}

function isInactiveStudent(row, rosterMap = null) {
  return studentStatusFromRow(row, rosterMap) === 'inativo';
}

function getActiveRows(call) {
  const rosterMap = currentStudentsMap();
  return (call?.rows || []).filter((row) => !isInactiveStudent(row, rosterMap));
}

function computeLocalStats(call) {
  const activeRows = getActiveRows(call);
  const total = activeRows.length;
  const presentes = activeRows.filter((r) => isPresentLikeValue(r.presenca)).length;
  const atrasos = activeRows.filter((r) => isDelayedValue(r.presenca)).length;
  const ausentes = total - presentes;
  const percentual = total ? (presentes / total) * 100 : 0;

  return { total, presentes, atrasos, ausentes, percentual };
}

function bestStudentForCurrentTurma() {
  const turmaId = state.selectedTurmaId;
  const turmaStudents = state.alunos
    .filter((a) => String(a.TurmaID || '') === String(turmaId || ''))
    .filter((a) => Number(a.Percentual || 0) > 0)
    .sort((a, b) => Number(b.Percentual || 0) - Number(a.Percentual || 0) || String(a.Nome || '').localeCompare(String(b.Nome || '')));
  return turmaStudents[0] || null;
}

function getCurrentStats() {
  const call = getCurrentCall();
  if (!call) return { total: 0, presentes: 0, ausentes: 0, percentual: 0 };
  return computeLocalStats(call);
}

function currentStudentsMap() {
  const map = {};
  getAlunosForTurma(state.selectedTurmaId).forEach((aluno) => {
    map[aluno.AlunoID] = aluno;
  });
  return map;
}

function studentStatusFromRow(row, rosterMap = null) {
  const aluno = rosterMap && row?.alunoId ? rosterMap[row.alunoId] : null;
  return String(aluno?.Status ?? row?.statusAluno ?? 'ativo').trim().toLowerCase();
}

function buildTurmaReportText() {
  if (isRestrictedMode()) return 'Relatório oculto neste modo.';

  const call = getCurrentCall();
  const turma = getCurrentTurma();
  if (!call || !turma) return 'Nenhuma turma selecionada.';
  const stats = computeLocalStats(call);
  const best = bestStudentForCurrentTurma();
  const presentNames = getActiveRows(call).filter((r) => isPresentLikeValue(r.presenca)).map((r) => r.nome).join(', ') || 'nenhum';
  const delayedNames = getActiveRows(call).filter((r) => isDelayedValue(r.presenca)).map((r) => r.nome).join(', ') || 'nenhum';
  const absentNames = getActiveRows(call).filter((r) => !isPresentLikeValue(r.presenca)).map((r) => r.nome).join(', ') || 'nenhum';
  const inactiveNames = getAlunosForTurma(turma.TurmaID).filter((a) => String(a.Status || '') === 'inativo').map((a) => a.Nome).join(', ') || 'nenhum';
  const faltandoMuito = getAlunosForTurma(turma.TurmaID).filter((a) => String(a.FaltandoMuito || '') === 'sim').map((a) => a.Nome).join(', ') || 'nenhum';

  return [
    '📋 RELATÓRIO DA TURMA',
    `Turma: ${turma.Nome}`,
    `Data: ${formatDateBR(state.dateKey)}`,
    '',
    `Total de alunos: ${stats.total}`,
    `Presentes: ${stats.presentes}`,
    `Atrasados: ${stats.atrasos}`,
    `Ausentes: ${stats.ausentes}`,
    `Presença: ${formatPercent(stats.percentual)}`,
    `Oferta da classe: ${call.oferta || '-'}`,
    `Visitantes: ${Number(call.visitantes || 0) > 0 ? call.visitantes : 'não informado'}`,
    `Bíblias: ${Number(call.biblias || 0) > 0 ? call.biblias : 'não informado'}`,
    `Revistas: ${Number(call.revistas || 0) > 0 ? call.revistas : 'não informado'}`,
    //call.visitantesTexto ? `Detalhe visitantes: ${call.visitantesTexto}` : '',
    '',
    `Melhor aluno: ${best ? `${best.Nome} (${formatPercent(best.Percentual)})` : '—'}`,
    `Inativos: ${inactiveNames}`,
    `Faltando muito: ${faltandoMuito}`,
    '',
    `Presentes: ${presentNames}`,
    `Atrasados: ${delayedNames}`,
    `Ausentes: ${absentNames}`,
  ].filter(Boolean).join('\n');
}
function buildGeneralReportText() {
  if (isRestrictedMode()) return 'Relatório oculto neste modo.';
  const geral = state.resumoGeral;
  if (!geral) return 'Sem dados gerais carregados.';
  const lines = [
    '📊 RELATÓRIO GERAL',
    `Data: ${formatDateBR(state.dateKey)}`,
    '',
    `Turmas salvas: ${geral.turmasSalvas}/${geral.totalTurmas}`,
    `Total de alunos: ${geral.totalAlunos}`,
    `Presentes: ${geral.presentes}`,
    `Atrasados: ${geral.atrasos || 0}`,
    `Ausentes: ${geral.ausentes}`,
    `Presença geral: ${formatPercent(geral.percentual)}`,
    `Oferta total: ${formatMoney(geral.ofertaTotal)}`,
    `Visitantes: ${geral.visitantesTotal}`,
    `Bíblias: ${geral.bibliasTotal}`,
    `Revistas: ${geral.revistasTotal}`,
    '',
    'Resumo por turma:',
  ];

  (geral.turmaSummaries || []).forEach((item) => {
    lines.push(`- ${item.nome}: ${item.presentes}/${item.totalAlunos} (${formatPercent(item.percentual)}) | Oferta ${item.oferta || '-'} | Visitantes ${item.visitantes || 0} | Bíblias ${item.biblias || 0} | Revistas ${item.revistas || 0}`);
  });

  lines.push('');
  lines.push(`Melhores alunos: ${geral.melhores?.length ? geral.melhores.map((a) => `${a.Nome} (${formatPercent(a.Percentual)})`).join(', ') : '—'}`);
  lines.push(`Inativos: ${geral.inativos?.length ? geral.inativos.map((a) => a.Nome).join(', ') : 'nenhum'}`);
  lines.push(`Faltando muito: ${geral.faltandoMuito?.length ? geral.faltandoMuito.map((a) => a.Nome).join(', ') : 'nenhum'}`);
  lines.push(`Reativados: ${geral.reativados?.length ? geral.reativados.map((a) => a.Nome).join(', ') : 'nenhum'}`);

  return lines.join('\n');
}
function formatDateBR(dateKey) {
  const [y, m, d] = String(dateKey || todayKey()).split('-');
  return `${d}/${m}/${y}`;
}

function renderTurmaSelects() {
  const options = getTurmasSorted().map((turma) => `<option value="${escapeHtml(turma.TurmaID)}">${escapeHtml(turma.Nome)}</option>`).join('');
  els.turmaSelect.innerHTML = options || '<option value="">Nenhuma turma cadastrada</option>';
  els.alunoTurma.innerHTML = options || '<option value="">Cadastre uma turma primeiro</option>';

  const exists = getTurmasSorted().some((t) => String(t.TurmaID || '') === String(state.selectedTurmaId || ''));
  if (!exists) {
    state.selectedTurmaId = getTurmasSorted()[0]?.TurmaID || '';
  }

  els.turmaSelect.value = state.selectedTurmaId || '';
  els.alunoTurma.value = state.selectedTurmaId || getTurmasSorted()[0]?.TurmaID || '';
}

function renderSummary() {
  const call = getCurrentCall();

  els.turmaMeta.className = 'turma-meta';

  if (!call) {
    els.summary.total.textContent = '0';
    els.summary.presentes.textContent = '0';
    els.summary.ausentes.textContent = '0';
    els.summary.percentual.textContent = '0%';
    els.summary.oferta.textContent = 'R$ 0,00';
    els.summary.visitantes.textContent = '0';
    els.summary.biblias.textContent = '0';
    els.summary.revistas.textContent = '0';
    els.turmaMeta.textContent = isRestrictedMode() ? 'Chamada não salva.' : 'Selecione uma turma para carregar a chamada.';
    if (isRestrictedMode()) els.turmaMeta.classList.add('turma-meta--warn');
    return;
  }

  const stats = computeLocalStats(call);
  els.summary.total.textContent = String(stats.total);
  els.summary.presentes.textContent = String(stats.presentes);
  els.summary.ausentes.textContent = String(stats.ausentes);
  els.summary.percentual.textContent = formatPercent(stats.percentual);
  els.summary.oferta.textContent = formatMoney(call.oferta);
  els.summary.visitantes.textContent = String(Number(call.visitantes || 0));
  els.summary.biblias.textContent = String(Number(call.biblias || 0));
  els.summary.revistas.textContent = String(Number(call.revistas || 0));

  if (isRestrictedMode()) {
    els.turmaMeta.textContent = call.isSaved ? 'Chamada salva.' : 'Chamada não salva.';
    els.turmaMeta.classList.add(call.isSaved ? 'turma-meta--ok' : 'turma-meta--warn');
    return;
  }

  const turma = getCurrentTurma();
  const best = bestStudentForCurrentTurma();
  const activeCount = stats.total;
  const inactiveCount = (call.rows || []).length - activeCount;
  const missingMuchCount = getAlunosForTurma(call.turmaId).filter(
    (a) => String(a.FaltandoMuito || '') === 'sim'
  ).length;

  els.turmaMeta.textContent = [
    turma ? `Turma: ${turma.Nome}` : '',
    `Ativos: ${activeCount}`,
    `Inativos: ${inactiveCount}`,
    `Atrasos: ${stats.atrasos}`,
    `Faltando muito: ${missingMuchCount}`,
    best ? `Melhor aluno: ${best.Nome} (${formatPercent(best.Percentual)})` : 'Melhor aluno: —',
    call.isSaved ? 'Chamada salva no dia.' : 'Chamada ainda não salva.',
  ].filter(Boolean).join(' • ');
}
function renderReports() {
  els.turmaReport.value = buildTurmaReportText();
  els.geralReport.value = buildGeneralReportText();
}

function renderStudents() {
  const call = getCurrentCall();
  const container = els.studentsList;

  if (!container) return;

  container.innerHTML = '';

  if (!call || !Array.isArray(call.rows) || call.rows.length === 0) {
    els.emptyState.style.display = 'block';
    els.emptyState.textContent = 'Nenhum aluno nesta turma.';
    container.classList.add('hidden');
    return;
  }

  const query = String(state.search || '').trim().toLowerCase();
  const rosterMap = currentStudentsMap();

  const filtered = call.rows.filter((row) => {
    const aluno = rosterMap[row.alunoId];
    const matchSearch = !query || String(row.nome || '').toLowerCase().includes(query);
    const isInactive = String(aluno?.Status || row.statusAluno || '').trim().toLowerCase() === 'inativo';
    const matchInactive = state.showInactive || !isInactive;
    return matchSearch && matchInactive;
  });

  if (!filtered.length) {
    els.emptyState.style.display = 'block';
    els.emptyState.textContent = query
      ? 'Nenhum aluno encontrado com este filtro.'
      : 'Nenhum aluno nesta turma.';
    container.classList.add('hidden');
    return;
  }

  els.emptyState.style.display = 'none';
  container.classList.remove('hidden');

  filtered.forEach((row) => {
    try {
      const aluno = rosterMap[row.alunoId] || {};
      const fragment = els.studentTemplate.content.cloneNode(true);

      const article = fragment.querySelector('.student');
      const nameEl = fragment.querySelector('.student-name');
      const badgesEl = fragment.querySelector('.student-badges');
      const percentEl = fragment.querySelector('.student-percent');
      const absenceEl = fragment.querySelector('.student-absence');
      const runEl = fragment.querySelector('.student-run');
      const presentBtn = fragment.querySelector('[data-action="present"]');
      const absentBtn = fragment.querySelector('[data-action="absent"]');
      const delayBtn = fragment.querySelector('[data-action="delay"]');
      const editBtn = fragment.querySelector('[data-action="edit"]');
      const toggleBtn = fragment.querySelector('[data-action="toggle"]');
      const noteInput = fragment.querySelector('.student-observacao');

      if (!article || !nameEl || !badgesEl || !percentEl || !absenceEl || !runEl || !presentBtn || !absentBtn || !delayBtn || !editBtn || !toggleBtn || !noteInput) {
        console.warn('Template do aluno incompleto:', row);
        return;
      }

      const isInactive = String(aluno.Status || row.statusAluno || '').trim().toLowerCase() === 'inativo';
      const isFaltandoMuito = String(aluno.FaltandoMuito || '').trim().toLowerCase() === 'sim';
      const isReativado = String(aluno.Reativado || '').trim().toLowerCase() === 'sim';
      const presence = normalizePresenceValue(row.presenca);
      const isDelayed = presence === 'atrasado';

      article.dataset.alunoId = row.alunoId;
      article.classList.toggle('is-inactive', isInactive);

      const statusLabel = isInactive ? 'Inativo' : 'Ativo';
      nameEl.innerHTML = `<span class="student-status ${isInactive ? 'student-status--inactive' : 'student-status--active'}">${statusLabel}</span> - ${escapeHtml(row.nome || '')}`;

      badgesEl.innerHTML = [
        isDelayed ? '<span class="badge-pill badge-pill--warn">Atrasado(a)</span>' : '',
        isFaltandoMuito ? '<span class="badge-pill badge-pill--warn">Faltando muito</span>' : '',
        isReativado ? '<span class="badge-pill badge-pill--info">Reativado</span>' : '',
        aluno.RealocadoDe ? `<span class="badge-pill badge-pill--info">Veio de ${escapeHtml(aluno.RealocadoDe)}</span>` : '',
      ].filter(Boolean).join('');

      const percent = Number(aluno.Percentual || 0);
      const faltas = Number(aluno.TotalFaltas || 0);
      const run = Number(aluno.FaltasConsecutivas || 0);

      percentEl.textContent = `Presença individual: ${formatPercent(percent)}`;
      absenceEl.textContent = `Faltas: ${faltas}`;
      runEl.textContent = `Faltas seguidas: ${run}`;
      runEl.style.color = run >= 4 ? '#c46a6a' : '';
      runEl.style.fontWeight = run >= 4 ? '700' : '';

      presentBtn.classList.toggle('is-selected-present', presence === 'sim');
      absentBtn.classList.toggle('is-selected-absent', presence === 'nao');
      delayBtn.classList.toggle('is-selected-delay', presence === 'atrasado');
      toggleBtn.textContent = isInactive ? 'Ativar' : 'Inativar';

      presentBtn.addEventListener('click', () => setStudentPresence(row.alunoId, 'sim'));
      absentBtn.addEventListener('click', () => setStudentPresence(row.alunoId, 'nao'));
      delayBtn.addEventListener('click', () => setStudentPresence(row.alunoId, 'atrasado'));
      editBtn.addEventListener('click', () => editStudentOnWhatsApp(row.alunoId));
      toggleBtn.addEventListener('click', () => toggleStudentStatus(row.alunoId));

      noteInput.value = row.observacao || '';
      noteInput.addEventListener('input', (event) => {
        row.observacao = event.target.value;
        markDirty();
      });

      container.appendChild(fragment);
    } catch (err) {
      console.error('Falha ao renderizar aluno:', row, err);
    }
  });
}

function markDirty() {
  const call = getCurrentCall();
  if (!call) return;
  state.dirty = true;
  persistDraft(call);
  renderReports();
}

function setStudentPresence(alunoId, presence) {
  const call = getCurrentCall();
  if (!call) return;
  const row = call.rows.find((r) => r.alunoId === alunoId);
  if (!row) return;
  row.presenca = normalizePresenceValue(presence);
  row.atraso = row.presenca === 'atrasado';
  state.dirty = true;
  persistDraft(call);
  renderAll();
}
function setAllPresence(presence) {
  const call = getCurrentCall();
  if (!call) return;
  call.rows.forEach((row) => {
    if (isInactiveStudent(row)) return;
    row.presenca = normalizePresenceValue(presence);
    row.atraso = row.presenca === 'atrasado';
  });
  state.dirty = true;
  persistDraft(call);
  renderAll();
}

async function saveCurrentCall({ silent = false } = {}) {
  const turma = getCurrentTurma();
  const call = getCurrentCall();

  updateCallFromInputs();

  if (!turma || !call) {
    throw new Error('Selecione uma turma antes de salvar.');
  }

  const beforeRows = Number(state.baseRowsCount || 0);

  const payload = {
    action: 'saveCall',
    date: state.dateKey,
    turmaId: turma.TurmaID,
    chamadaId: call.chamadaId,
    oferta: call.oferta ?? 0,
    visitantes: String(call.visitantes ?? 0),
    biblias: String(call.biblias ?? 0),
    revistas: String(call.revistas ?? 0),
    //visitantesTexto: call.visitantesTexto || '',
    rowsJson: JSON.stringify(call.rows),
  };

  if (!silent) {
    showLoading('Salvando chamada...', 30000);
  }

  let timeoutId = null;
  let loadingClosed = false;

  const closeLoading = () => {
    if (loadingClosed) return;
    loadingClosed = true;

    clearTimeout(timeoutId);

    if (!silent) {
      if (typeof forceHideLoading === 'function') {
        forceHideLoading();
      }
      hideLoading();
    }
  };

  const timeoutPromise = new Promise((resolve) => {
    timeoutId = setTimeout(() => {
      resolve({ type: 'timeout' });
    }, 7000);
  });

  const requestPromise = apiPost(payload, { timeoutMs: 60000 }).then(
    (result) => ({ type: 'response', result }),
    (error) => ({ type: 'error', error })
  );

  try {
    const first = await Promise.race([requestPromise, timeoutPromise]);

    // Resposta chegou antes dos 7s
    if (first.type === 'response') {
      closeLoading();

      const result = first.result;

      const afterRows = Number(result?.baseWrite?.afterRows ?? beforeRows);
      const insertedRows = Number(
        result?.baseWrite?.insertedRows ?? (afterRows - beforeRows)
      );

      if (afterRows > beforeRows && insertedRows > 0) {
        state.baseRowsCount = afterRows;
      }

      state.resumoGeral = result.resumoGeral || state.resumoGeral;
      state.chamadasByTurma[turma.TurmaID] = result.turmaCall || call;
      state.dirty = false;
      clearDraft(call.chamadaId);
      state.selectedTurmaId = turma.TurmaID;
      renderAll();

      refreshFromBackend(false, { silent: true }).catch((err) => {
        console.warn('Falha ao atualizar dados após salvar:', err);
      });

      showSuccess(result.message || 'Chamada salva com sucesso.');
      return result;
    }

    // Passaram 7s e não veio resposta: para o loading e segue
    if (first.type === 'timeout') {
      closeLoading();

      state.dirty = false;
      clearDraft(call.chamadaId);
      state.selectedTurmaId = turma.TurmaID;
      renderAll();

      requestPromise.then((settled) => {
        if (settled?.type === 'response') {
          const result = settled.result;
          const afterRows = Number(result?.baseWrite?.afterRows ?? state.baseRowsCount);
          const insertedRows = Number(
            result?.baseWrite?.insertedRows ?? (afterRows - state.baseRowsCount)
          );

          if (afterRows > state.baseRowsCount && insertedRows > 0) {
            state.baseRowsCount = afterRows;
          }

          state.resumoGeral = result.resumoGeral || state.resumoGeral;
          state.chamadasByTurma[turma.TurmaID] = result.turmaCall || call;

          refreshFromBackend(false, { silent: true }).catch((err) => {
            console.warn('Falha ao atualizar dados após salvar:', err);
          });
        } else if (settled?.type === 'error') {
          console.warn('Resposta do Apps Script falhou depois dos 7s:', settled.error);
        }
      });

      showSuccess('Chamada enviada para salvamento.');
      return { ok: true, pending: true };
    }

    throw first.error instanceof Error
      ? first.error
      : new Error('Erro ao salvar chamada.');
  } catch (err) {
    closeLoading();
    showError(err?.message || 'Erro ao salvar chamada.');
    throw err;
  } finally {
    closeLoading();
  }
}

async function sendReport(scope) {
  if (isRestrictedMode()) {
    throw new Error('Ação indisponível neste modo.');
  }
  const turma = getCurrentTurma();
  if (scope === 'turma' && !turma) throw new Error('Selecione uma turma.');
  if (state.dirty) {
    await saveCurrentCall({ silent: true });
  }

  showLoading(scope === 'geral' ? 'Enviando relatório geral...' : 'Enviando relatório da turma...');
  try {
    const result = await apiPost({
      action: 'sendReport',
      scope,
      date: state.dateKey,
      turmaId: turma ? turma.TurmaID : '',
    });

    if (result.text) {
      if (scope === 'turma') els.turmaReport.value = result.text;
      if (scope === 'geral') els.geralReport.value = result.text;
    }

    showSuccess(result.message || 'Relatório enviado.');
    await refreshFromBackend(false);
    renderAll();
  } finally {
    hideLoading();
  }
}

function moveStudent(alunoId) {
  if (isRestrictedMode()) {
    showError('Ação indisponível neste modo.');
    return;
  }
  const turmaAtual = getCurrentTurma();
  const turmas = getTurmasSorted().filter((t) => !turmaAtual || t.TurmaID !== turmaAtual.TurmaID);
  if (!turmas.length) {
    showError('Cadastre outra turma antes de mover aluno.');
    return;
  }

  const destino = window.prompt(
    `Digite o ID da turma destino:\n\n${turmas.map((t) => `${t.Nome} → ${t.TurmaID}`).join('\n')}`
  );

  if (!destino) return;
  const turmaDestino = turmas.find((t) => t.TurmaID === destino.trim()) || null;
  if (!turmaDestino) {
    showError('Turma destino inválida.');
    return;
  }

  apiPost({
    action: 'moveAluno',
    alunoId,
    turmaId: turmaDestino.TurmaID,
  })
    .then(async (res) => {
      showSuccess(res.message || 'Aluno movido com sucesso.');
      await refreshFromBackend(false);
      renderAll();
    })
    .catch((err) => showError(err.message || 'Falha ao mover aluno.'));
}

function toggleStudentStatus(alunoId) {
  if (isRestrictedMode()) {
    showError('Ação indisponível neste modo.');
    return;
  }
  const aluno = state.alunos.find((a) => a.AlunoID === alunoId);
  if (!aluno) return;
  const ativo = String(aluno.Ativo || 'sim').toLowerCase() === 'nao';
  const novoAtivo = ativo ? 'sim' : 'nao';

  apiPost({
    action: 'toggleAluno',
    alunoId,
    ativo: novoAtivo,
  })
    .then(async (res) => {
      showSuccess(res.message || 'Status atualizado.');
      await refreshFromBackend(false);
      renderAll();
    })
    .catch((err) => showError(err.message || 'Falha ao atualizar status.'));
}

function editStudentOnWhatsApp(alunoId) {
  const call = getCurrentCall();
  const row = call?.rows?.find((item) => item.alunoId === alunoId);
  const turma = getCurrentTurma();
  if (!row || !turma) {
    showError('Não foi possível montar a mensagem de edição.');
    return;
  }

  const url = buildWhatsAppEditUrl(row.nome, turma.Nome);
  window.open(url, '_blank', 'noopener,noreferrer');
}
async function addTurma(event) {
  if (isRestrictedMode()) {
    showError('Ação indisponível neste modo.');
    return;
  }
  event.preventDefault();
  const nome = els.turmaNome.value.trim();
  const ordem = els.turmaOrdem.value.trim() || '0';
  if (!nome) {
    showError('Informe o nome da turma.');
    return;
  }

  showBusy('Cadastrando turma...');
  const result = await apiPost({
    action: 'addTurma',
    nome,
    ordem,
  });

  showSuccess(result.message || 'Turma cadastrada.');
  els.turmaNome.value = '';
  els.turmaOrdem.value = '';
  await refreshFromBackend(false);
  state.selectedTurmaId = result.turmaId || state.selectedTurmaId;
  renderAll();
}

async function addAluno(event) {
  if (isRestrictedMode()) {
    showError('Ação indisponível neste modo.');
    return;
  }
  event.preventDefault();
  const nome = els.alunoNome.value.trim();
  const cpf = onlyDigits(els.alunoCpf.value).slice(0, 11);
  const turmaId = els.alunoTurma.value;
  if (!nome) {
    showError('Informe o nome do aluno.');
    return;
  }
  if (!turmaId) {
    showError('Selecione uma turma.');
    return;
  }

  showBusy('Cadastrando aluno...');
  const result = await apiPost({
    action: 'addAluno',
    nome,
    cpf,
    turmaId,
  });

  showSuccess(result.message || 'Aluno cadastrado.');
  els.alunoNome.value = '';
  els.alunoCpf.value = '';
  await refreshFromBackend(false);
  renderAll();
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(
    () => showSuccess('Texto copiado para a área de transferência.'),
    () => showError('Não foi possível copiar o texto.')
  );
}

function clearCurrentCall() {
  if (isRestrictedMode()) {
    showError('Ação indisponível neste modo.');
    return;
  }
  const call = getCurrentCall();
  if (!call) return;
  const ok = window.confirm('Limpar a chamada desta turma nesta data? Isso só altera a tela atual até salvar novamente.');
  if (!ok) return;
  call.rows.forEach((row) => {
    row.presenca = 'nao';
    row.atraso = false;
    row.observacao = '';
  });
  call.oferta = '';
  call.visitantes = 0;
  call.biblias = 0;
  call.revistas = 0;
  //call.visitantesTexto = '';
  state.dirty = true;
  persistDraft(call);
  renderAll();
}
async function saveAndAdvance() {
  if (isRestrictedMode()) {
    showError('Ação indisponível neste modo.');
    return;
  }
  const currentIndex = getTurmasSorted().findIndex((t) => t.TurmaID === state.selectedTurmaId);
  await saveCurrentCall();
  const next = getTurmasSorted()[(currentIndex + 1) % getTurmasSorted().length];
  if (next) {
    state.selectedTurmaId = next.TurmaID;
    loadSelectedTurma();
    renderAll();
  }
}

function loadSelectedTurma() {
  const turma = getCurrentTurma();
  if (!turma) return;
  let call = state.chamadasByTurma[turma.TurmaID];
  if (!call) {
    call = blankCallForTurma(turma);
    call = restoreDraft(call);
    state.chamadasByTurma[turma.TurmaID] = call;
  }
}

function renderAll() {
  applyAccessMode();
  renderTurmaSelects();
  loadSelectedTurma();
  renderSummary();
  renderStudents();
  renderReports();
  bindCallFieldValues();
}

function bindCallFieldValues() {
  const call = getCurrentCall();
  if (!call) return;

  const ofertaInput = document.getElementById('ofertaInput');
  const visitantesInput = document.getElementById('visitantesInput');
  const bibliasInput = document.getElementById('bibliasInput');
  const revistasInput = document.getElementById('revistasInput');
  //const visitantesTextoInput = document.getElementById('visitantesTextoInput');

  if (ofertaInput) {
  ofertaInput.value =
    formatCurrencyBR(
      call.oferta ?? 0
    );
}
  if (visitantesInput) visitantesInput.value = String(call.visitantes || 0);
  if (bibliasInput) bibliasInput.value = String(call.biblias || 0);
  if (revistasInput) revistasInput.value = String(call.revistas || 0);
  //if (visitantesTextoInput) visitantesTextoInput.value = call.visitantesTexto || '';

if (ofertaInput && !ofertaInput.dataset.bound) {

  ofertaInput.dataset.bound = '1';

  ofertaInput.addEventListener('input', (event) => {

    formatTensToBRL(event);

    const current = getCurrentCall();

    if (!current) return;

    current.oferta =
      parseCurrencyBR(event.target.value);

    console.log(
      '[ofertaInput]',
      {
        digitado: event.target.value,
        armazenado: current.oferta,
      }
    );

    persistDraft(current);

    markDirty();

    renderSummary();

    renderReports();
  });
}

  if (visitantesInput && !visitantesInput.dataset.bound) {
    visitantesInput.dataset.bound = '1';
    visitantesInput.addEventListener('input', (event) => {
      const current = getCurrentCall();
      if (!current) return;
      current.visitantes = Number(event.target.value || 0) || 0;
      persistDraft(current);
      markDirty();
      renderSummary();
      renderReports();
    });
  }

  if (bibliasInput && !bibliasInput.dataset.bound) {
    bibliasInput.dataset.bound = '1';
    bibliasInput.addEventListener('input', (event) => {
      const current = getCurrentCall();
      if (!current) return;
      current.biblias = Number(event.target.value || 0) || 0;
      persistDraft(current);
      markDirty();
      renderSummary();
      renderReports();
    });
  }

  if (revistasInput && !revistasInput.dataset.bound) {
    revistasInput.dataset.bound = '1';
    revistasInput.addEventListener('input', (event) => {
      const current = getCurrentCall();
      if (!current) return;
      current.revistas = Number(event.target.value || 0) || 0;
      persistDraft(current);
      markDirty();
      renderSummary();
      renderReports();
    });
  }

  /*
  if (visitantesTextoInput && !visitantesTextoInput.dataset.bound) {
    visitantesTextoInput.dataset.bound = '1';
    visitantesTextoInput.addEventListener('input', (event) => {
      const current = getCurrentCall();
      if (!current) return;
      current.visitantesTexto = event.target.value;
      persistDraft(current);
      markDirty();
      renderReports();
    });
  }
  */
  
}


async function refreshFromBackend(showMessage = false, { silent = false } = {}) {
  clearAutosaveTimer();
  state.loading = true;

  if (!silent) {
    showLoading('Carregando dados...');
  }

  try {
    // =========================================
    // DEBUG BOX
    // =========================================
    if (showDebugBox) {
      let debugBox = document.getElementById('debugBackendJson');

      if (!debugBox) {
        debugBox = document.createElement('pre');
        debugBox.id = 'debugBackendJson';

        debugBox.style.cssText = `
          position:fixed;
          left:10px;
          right:10px;
          bottom:10px;
          max-height:45vh;
          overflow:auto;
          z-index:999999999;
          background:#000;
          color:#00ff88;
          padding:14px;
          border-radius:12px;
          font-size:11px;
          line-height:1.4;
          border:2px solid #333;
          white-space:pre-wrap;
          word-break:break-word;
          box-shadow:0 0 30px rgba(0,0,0,.5);
        `;

        document.body.appendChild(debugBox);
      }

      debugBox.textContent = '⏳ Iniciando carregamento do backend...\n';
    }

    // =========================================
    // CHAMADA API
    // =========================================

    const urlFinal = apiUrl({
      action: 'init',
      date: state.dateKey,
    });

    if (showDebugBox) {
      const debugBox = document.getElementById('debugBackendJson');
      if (debugBox) {
        debugBox.textContent += '\n🌐 URL:\n' + urlFinal + '\n';
      }
    }

    const response = await fetch(urlFinal, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store',
    });

    if (showDebugBox) {
      const debugBox = document.getElementById('debugBackendJson');
      if (debugBox) {
        debugBox.textContent +=
          '\n📡 STATUS HTTP:\n' +
          response.status + ' ' + response.statusText + '\n';
      }
    }

    const rawText = await response.text();

    if (showDebugBox) {
      const debugBox = document.getElementById('debugBackendJson');
      if (debugBox) {
        debugBox.textContent +=
          '\n📦 RAW RESPONSE:\n' +
          rawText.slice(0, 15000) + '\n';
      }
    }

    let data = null;

    try {
      data = JSON.parse(rawText);

      if (showDebugBox) {
        const debugBox = document.getElementById('debugBackendJson');
        if (debugBox) {
          debugBox.textContent += '\n✅ JSON PARSEADO COM SUCESSO\n';
        }
      }
    } catch (jsonErr) {
      if (showDebugBox) {
        const debugBox = document.getElementById('debugBackendJson');
        if (debugBox) {
          debugBox.textContent +=
            '\n❌ ERRO AO PARSEAR JSON:\n' +
            jsonErr.message + '\n';
        }
      }

      throw jsonErr;
    }

    // =========================================
    // INSPEÇÃO DO JSON
    // =========================================

    if (showDebugBox) {
      const debugBox = document.getElementById('debugBackendJson');
      if (debugBox) {
        debugBox.textContent +=
          '\n============================\n' +
          '📊 ESTRUTURA DO JSON\n' +
          '============================\n';

        debugBox.textContent +=
          '\nTurmas: ' +
          (Array.isArray(data.turmas)
            ? data.turmas.length
            : 'NÃO É ARRAY');

        debugBox.textContent +=
          '\nAlunos: ' +
          (Array.isArray(data.alunos)
            ? data.alunos.length
            : 'NÃO É ARRAY');

        debugBox.textContent +=
          '\nCallsByTurma keys: ' +
          Object.keys(data.callsByTurma || {}).length;

        debugBox.textContent +=
          '\nResumo geral existe: ' +
          (!!data.resumoGeral);

        debugBox.textContent +=
          '\nBaseRowsCount: ' +
          data.baseRowsCount;
      }
    }

    // =========================================
    // PRIMEIRA CHAMADA
    // =========================================

    const firstCall =
      Object.values(data.callsByTurma || {})[0];

    if (showDebugBox) {
      const debugBox = document.getElementById('debugBackendJson');
      if (debugBox) {
        debugBox.textContent +=
          '\n\n============================\n' +
          '📞 PRIMEIRA CALL\n' +
          '============================\n';

        debugBox.textContent += JSON.stringify({
          chamadaId: firstCall?.chamadaId,
          turmaId: firstCall?.turmaId,
          turmaNome: firstCall?.turmaNome,
          oferta: firstCall?.oferta,
          visitantes: firstCall?.visitantes,
          biblias: firstCall?.biblias,
          revistas: firstCall?.revistas,
          //visitantesTexto: firstCall?.visitantesTexto,
          totalRows: firstCall?.rows?.length,
          firstRow: firstCall?.rows?.[0],
        }, null, 2);
      }
    }

    // =========================================
    // APLICAÇÃO NO STATE
    // =========================================

    state.turmas =
      Array.isArray(data.turmas)
        ? data.turmas
        : [];

    state.alunos =
      Array.isArray(data.alunos)
        ? data.alunos
        : [];

    state.chamadasByTurma =
      data.callsByTurma || {};

    state.resumoGeral =
      data.resumoGeral || null;

    state.baseRowsCount =
      Number(
        data.baseRowsCount ||
        state.baseRowsCount ||
        0
      );

    if (showDebugBox) {
      const debugBox = document.getElementById('debugBackendJson');
      if (debugBox) {
        debugBox.textContent += '\n\n✅ STATE ATUALIZADO';

        debugBox.textContent +=
          '\nstate.turmas: ' +
          state.turmas.length;

        debugBox.textContent +=
          '\nstate.alunos: ' +
          state.alunos.length;

        debugBox.textContent +=
          '\nstate.calls: ' +
          Object.keys(state.chamadasByTurma).length;
      }
    }

    // =========================================
    // TURMA SELECIONADA
    // =========================================

    if (
      !state.selectedTurmaId ||
      !state.turmas.some(
        (t) => t.TurmaID === state.selectedTurmaId
      )
    ) {
      state.selectedTurmaId =
        state.turmas[0]?.TurmaID || '';
    }

    if (showDebugBox) {
      const debugBox = document.getElementById('debugBackendJson');
      if (debugBox) {
        debugBox.textContent +=
          '\n\n🎯 selectedTurmaId:\n' +
          state.selectedTurmaId;
      }
    }

    // =========================================
    // TESTE getCurrentCall()
    // =========================================

    try {
      const testCall = getCurrentCall();

      if (showDebugBox) {
        const debugBox = document.getElementById('debugBackendJson');
        if (debugBox) {
          debugBox.textContent +=
            '\n\n============================\n' +
            '🧪 TESTE getCurrentCall()\n' +
            '============================\n';

          debugBox.textContent += JSON.stringify({
            exists: !!testCall,
            turmaId: testCall?.turmaId,
            chamadaId: testCall?.chamadaId,
            rows: testCall?.rows?.length,
            oferta: testCall?.oferta,
            visitantes: testCall?.visitantes,
            biblias: testCall?.biblias,
            revistas: testCall?.revistas,
          }, null, 2);
        }
      }
    } catch (err) {
      if (showDebugBox) {
        const debugBox = document.getElementById('debugBackendJson');
        if (debugBox) {
          debugBox.textContent +=
            '\n\n❌ ERRO getCurrentCall():\n' +
            err.message;
        }
      }
    }

    // =========================================
    // RENDER
    // =========================================

    try {
      renderAll();

      if (showDebugBox) {
        const debugBox = document.getElementById('debugBackendJson');
        if (debugBox) {
          debugBox.textContent +=
            '\n\n✅ renderAll() executado';
        }
      }
    } catch (renderErr) {
      if (showDebugBox) {
        const debugBox = document.getElementById('debugBackendJson');
        if (debugBox) {
          debugBox.textContent +=
            '\n\n❌ ERRO NO RENDER:\n' +
            renderErr.message +
            '\n\nSTACK:\n' +
            renderErr.stack;
        }
      }
    }

    if (showMessage) {
      showSuccess('Dados atualizados.');
    }
  } catch (err) {
    console.error(err);

    const showDebugBox = false;

    if (showDebugBox) {
      const debugBox =
        document.getElementById('debugBackendJson');

      if (debugBox) {
        debugBox.textContent +=
          '\n\n============================\n' +
          '❌ ERRO GERAL\n' +
          '============================\n' +
          err.message +
          '\n\nSTACK:\n' +
          (err.stack || '');
      }
    }

    showError(
      err?.message ||
      'Erro ao carregar dados.'
    );
  } finally {
    state.loading = false;

    if (!silent) {
      hideLoading();
    }
  }
}



function validateApiUrl() {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes('COLE_AQUI')) {
    showError('Cole a URL do Web App do Apps Script em APPS_SCRIPT_URL.');
    return false;
  }
  return true;
}

function normalizeCpfInput(event) {
  const digits = onlyDigits(event.target.value).slice(0, 11);
  event.target.value = formatCpf(digits);
}

async function bootstrap() {
  ensureLoadingOverlay();
  showLoading('Carregando dados...');

  try {
    state.accessCode = getAccessCodeFromUrl();
    state.accessMode = resolveAccessMode(state.accessCode);
    applyAccessMode();

    els.dateInput.value = state.dateKey;
    els.showInactive.checked = true;
    els.searchInput.value = '';

    const storage = storageState();
    state.selectedTurmaId = storage.selectedTurmaId || '';
    state.dateKey = storage.selectedDateKey || state.dateKey;
    els.dateInput.value = state.dateKey;

    if (!validateApiUrl()) return;

    await refreshFromBackend(false);

    if (!state.selectedTurmaId) {
      state.selectedTurmaId = state.turmas[0]?.TurmaID || '';
    }

    renderAll();
    clearFeedback();

    state.initialized = true;
    showSuccess('Sistema pronto para uso.');
  } finally {
    hideLoading();
  }
}

els.dateInput.addEventListener('change', async (event) => {
  const nextDate = event.target.value || todayKey();
  if (nextDate === state.dateKey) return;

  if (state.dirty && !window.confirm('Há alterações não salvas. Trocar a data vai descartar o que foi editado. Deseja continuar?')) {
  return;
}

  state.dateKey = nextDate;
  const storage = storageState();
  storage.selectedDateKey = state.dateKey;
  saveStorageState(storage);
  await refreshFromBackend(true);
  renderAll();
});

els.turmaSelect.addEventListener('change', (event) => {
  state.selectedTurmaId = event.target.value;
  const storage = storageState();
  storage.selectedTurmaId = state.selectedTurmaId;
  saveStorageState(storage);
  renderAll();
});

els.alunoTurma.addEventListener('change', (event) => {
  const storage = storageState();
  storage.lastAlunoTurma = event.target.value;
  saveStorageState(storage);
});

els.searchInput.addEventListener('input', (event) => {
  state.search = event.target.value;
  renderStudents();
});

els.showInactive.addEventListener('change', (event) => {
  state.showInactive = event.target.checked;
  renderStudents();
});

els.reloadBtn.addEventListener('click', async () => {
  if (state.dirty && !window.confirm('Existem alterações não salvas. Atualizar a página pode sobrescrever o rascunho local. Continuar?')) {
    return;
  }
  await refreshFromBackend(true);
  renderAll();
});

els.clearBtn.addEventListener('click', clearCurrentCall);
els.saveBtn.addEventListener('click', async () => {
  try {
    await saveCurrentCall();
  } catch (err) {
    showError(err.message || 'Falha ao salvar a chamada.');
  }
});
els.sendTurmaBtn.addEventListener('click', async () => {
  try {
    await sendReport('turma');
  } catch (err) {
    showError(err.message || 'Falha ao enviar relatório da turma.');
  }
});
els.sendGeralBtn.addEventListener('click', async () => {
  try {
    await sendReport('geral');
  } catch (err) {
    showError(err.message || 'Falha ao enviar relatório geral.');
  }
});
els.saveNextBtn.addEventListener('click', async () => {
  try {
    await saveAndAdvance();
  } catch (err) {
    showError(err.message || 'Falha ao salvar e avançar.');
  }
});
els.markAllPresentBtn.addEventListener('click', () => setAllPresence('sim'));
els.markAllAbsentBtn.addEventListener('click', () => setAllPresence('nao'));
els.copyTurmaBtn.addEventListener('click', () => copyText(buildTurmaReportText()));
els.copyGeralBtn.addEventListener('click', () => copyText(buildGeneralReportText()));
els.turmaForm.addEventListener('submit', (event) => {
  event.preventDefault();
  addTurma(event).catch((err) => showError(err.message || 'Falha ao cadastrar turma.'));
});
els.alunoForm.addEventListener('submit', (event) => {
  event.preventDefault();
  addAluno(event).catch((err) => showError(err.message || 'Falha ao cadastrar aluno.'));
});

els.alunoCpf.addEventListener('input', normalizeCpfInput);

document.addEventListener('DOMContentLoaded', bootstrap);
