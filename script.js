const APPS_SCRIPT_URL =
'https://script.google.com/macros/s/AKfycbxqqMq1jnkQ3c_5KjEW7i6a0EZgXiy-hqduShtvpeRl-4olRKc6cEKFPAH1C42HZQ2kUw/exec';
const STORAGE_KEY = 'prb_presenca_turmas_v2';
const ROSTER_CACHE_KEY = 'prb_roster_cache_v1';
const ROSTER_CACHE_VERSION = 1;

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
  },
  studentsList: document.getElementById('studentsList'),
  emptyState: document.getElementById('emptyState'),
  studentTemplate: document.getElementById('studentTemplate'),
  turmaReport: document.getElementById('turmaReport'),
  geralReport: document.getElementById('geralReport'),
};

let loadingCount = 0;

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

function showLoading(message = 'Carregando...') {
  ensureLoadingOverlay();

  const overlay = document.getElementById('loadingOverlay');
  const text = overlay.querySelector('.loading-text');

  if (text) text.textContent = message;

  loadingCount += 1;
  overlay.classList.add('show');
}

function hideLoading() {
  loadingCount = Math.max(0, loadingCount - 1);

  if (loadingCount === 0) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.remove('show');
  }
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

function formatMoney(value) {
  const n = Number(value || 0);
  try {
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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

async function apiGet(params = {}) {
  const response = await fetch(apiUrl(params), {
    method: 'GET',
    mode: 'cors',
    cache: 'no-store',
  });
  const data = await response.json();
  if (!response.ok || data.ok === false) {
    throw new Error(data.message || `HTTP ${response.status}`);
  }
  return data;
}

async function apiPost(params = {}) {
  const formData = new FormData();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) formData.append(key, value);
  });

  const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    mode: 'cors',
    cache: 'no-store',
    body: formData,
  });
  const data = await response.json();
  if (!response.ok || data.ok === false) {
    throw new Error(data.message || `HTTP ${response.status}`);
  }
  return data;
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
  return {
    alunoId: aluno.AlunoID,
    nome: aluno.Nome,
    presenca: 'nao',
    observacao: '',
    statusAluno: aluno.Status || 'ativo',
  };
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

    const merged = {
      ...base,
      ...(serverRow || {}),
      ...(draftRow || {}),
    };

    merged.alunoId = base.alunoId;
    merged.nome = draftRow?.nome ?? serverRow?.nome ?? base.nome;
    merged.statusAluno = draftRow?.statusAluno ?? serverRow?.statusAluno ?? base.statusAluno;

    return merged;
  });

  return {
    chamadaId: serverCall?.chamadaId || callKey(state.dateKey, turma.TurmaID),
    data: serverCall?.data || state.dateKey,
    turmaId: turma.TurmaID,
    turmaNome: turma.Nome,
    oferta: draft?.oferta ?? serverCall?.oferta ?? '',
    visitantes: Number(draft?.visitantes ?? serverCall?.visitantes ?? 0) || 0,
    visitantesTexto: draft?.visitantesTexto ?? serverCall?.visitantesTexto ?? '',
    totalAlunos: rows.length,
    presentes: serverCall?.presentes ?? 0,
    ausentes: serverCall?.ausentes ?? rows.length,
    percentual: serverCall?.percentual ?? 0,
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
    visitantesTexto: '',
    totalAlunos: activeRoster.length,
    presentes: 0,
    ausentes: activeRoster.length,
    percentual: 0,
    enviadoTelegram: false,
    telegramEnviadoEm: '',
    rows: roster.map((aluno) => ({
      alunoId: aluno.AlunoID,
      nome: aluno.Nome,
      presenca: 'nao',
      observacao: '',
      statusAluno: aluno.Status || 'ativo',
    })),
    isSaved: false,
  };
}
function restoreDraft(call) {
  const drafts = storageState().drafts || {};
  const draft = drafts[call.chamadaId];
  if (!draft) return call;
  return {
    ...call,
    oferta: draft.oferta ?? call.oferta,
    visitantes: draft.visitantes ?? call.visitantes,
    visitantesTexto: draft.visitantesTexto ?? call.visitantesTexto,
    rows: Array.isArray(draft.rows) ? draft.rows : call.rows,
    isSaved: !!draft.isSaved ? call.isSaved : call.isSaved,
  };
}

function persistDraft(call) {
  const data = storageState();
  data.drafts = data.drafts || {};
  data.drafts[call.chamadaId] = {
    oferta: call.oferta,
    visitantes: call.visitantes,
    visitantesTexto: call.visitantesTexto || '',
    rows: call.rows.map((row) => ({
      alunoId: row.alunoId,
      nome: row.nome,
      presenca: row.presenca,
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
  call.oferta = document.getElementById('ofertaInput')?.value?.trim?.() ?? call.oferta;
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
  const presentes = activeRows.filter((r) => r.presenca === 'sim').length;
  const ausentes = total - presentes;
  const percentual = total ? (presentes / total) * 100 : 0;

  return { total, presentes, ausentes, percentual };
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
  const call = getCurrentCall();
  const turma = getCurrentTurma();
  if (!call || !turma) return 'Nenhuma turma selecionada.';
  const stats = computeLocalStats(call);
  const best = bestStudentForCurrentTurma();
  const presentNames = getActiveRows(call).filter((r) => r.presenca === 'sim').map((r) => r.nome).join(', ') || 'nenhum';
  const absentNames = getActiveRows(call).filter((r) => r.presenca !== 'sim').map((r) => r.nome).join(', ') || 'nenhum';
  const inactiveNames = getAlunosForTurma(turma.TurmaID).filter((a) => String(a.Status || '') === 'inativo').map((a) => a.Nome).join(', ') || 'nenhum';
  const faltandoMuito = getAlunosForTurma(turma.TurmaID).filter((a) => String(a.FaltandoMuito || '') === 'sim').map((a) => a.Nome).join(', ') || 'nenhum';

  return [
    '📋 RELATÓRIO DA TURMA',
    `Turma: ${turma.Nome}`,
    `Data: ${formatDateBR(state.dateKey)}`,
    '',
    `Total de alunos: ${stats.total}`,
    `Presentes: ${stats.presentes}`,
    `Ausentes: ${stats.ausentes}`,
    `Presença: ${formatPercent(stats.percentual)}`,
    `Oferta da classe: ${call.oferta || '-'}`,
    `Visitantes: ${Number(call.visitantes || 0) > 0 ? call.visitantes : 'não informado'}`,
    call.visitantesTexto ? `Detalhe visitantes: ${call.visitantesTexto}` : '',
    '',
    `Melhor aluno: ${best ? `${best.Nome} (${formatPercent(best.Percentual)})` : '—'}`,
    `Inativos: ${inactiveNames}`,
    `Faltando muito: ${faltandoMuito}`,
    '',
    `Presentes: ${presentNames}`,
    `Ausentes: ${absentNames}`,
  ].filter(Boolean).join('\n');
}

function buildGeneralReportText() {
  const geral = state.resumoGeral;
  if (!geral) return 'Sem dados gerais carregados.';
  const lines = [
    '📊 RELATÓRIO GERAL',
    `Data: ${formatDateBR(state.dateKey)}`,
    '',
    `Turmas salvas: ${geral.turmasSalvas}/${geral.totalTurmas}`,
    `Total de alunos: ${geral.totalAlunos}`,
    `Presentes: ${geral.presentes}`,
    `Ausentes: ${geral.ausentes}`,
    `Presença geral: ${formatPercent(geral.percentual)}`,
    `Oferta total: ${formatMoney(geral.ofertaTotal)}`,
    `Visitantes: ${geral.visitantesTotal}`,
    '',
    'Resumo por turma:',
  ];

  geral.turmaSummaries.forEach((item) => {
    lines.push(`- ${item.nome}: ${item.presentes}/${item.totalAlunos} (${formatPercent(item.percentual)}) | Oferta ${item.oferta || '-'} | Visitantes ${item.visitantes || 0}`);
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
  if (!call) {
    els.summary.total.textContent = '0';
    els.summary.presentes.textContent = '0';
    els.summary.ausentes.textContent = '0';
    els.summary.percentual.textContent = '0%';
    els.summary.oferta.textContent = 'R$ 0,00';
    els.summary.visitantes.textContent = '0';
    els.turmaMeta.textContent = 'Selecione uma turma para carregar a chamada.';
    return;
  }

  const stats = computeLocalStats(call);
  els.summary.total.textContent = String(stats.total);
  els.summary.presentes.textContent = String(stats.presentes);
  els.summary.ausentes.textContent = String(stats.ausentes);
  els.summary.percentual.textContent = formatPercent(stats.percentual);
  els.summary.oferta.textContent = formatMoney(call.oferta);
  els.summary.visitantes.textContent = String(Number(call.visitantes || 0));

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
  els.studentsList.innerHTML = '';

  if (!call || !call.rows.length) {
    els.emptyState.style.display = 'block';
    els.studentsList.classList.add('hidden');
    return;
  }

  const query = String(state.search || '').trim().toLowerCase();
  const rosterMap = currentStudentsMap();
  const filtered = call.rows.filter((row) => {
    const aluno = rosterMap[row.alunoId];
    const matchSearch = !query || String(row.nome || '').toLowerCase().includes(query);
    const isInactive = String(aluno?.Status || row.statusAluno || '') === 'inativo';
    const matchInactive = state.showInactive || !isInactive;
    return matchSearch && matchInactive;
  });

  els.emptyState.style.display = filtered.length ? 'none' : 'block';
  els.emptyState.textContent = query ? 'Nenhum aluno encontrado com este filtro.' : 'Nenhum aluno nesta turma.';
  els.studentsList.classList.toggle('hidden', !filtered.length);

  filtered.forEach((row) => {
    const aluno = rosterMap[row.alunoId] || {};
    const clone = els.studentTemplate.content.cloneNode(true);
    const article = clone.querySelector('.student');

    const isInactive = String(aluno.Status || row.statusAluno || '') === 'inativo';
    const isFaltandoMuito = String(aluno.FaltandoMuito || '') === 'sim';
    const isReativado = String(aluno.Reativado || '') === 'sim';

    article.dataset.alunoId = row.alunoId;
    article.classList.toggle('is-inactive', isInactive);

    clone.querySelector('.student-name').textContent = row.nome;
    const badges = clone.querySelector('.student-badges');
    badges.innerHTML = [
      `<span class="badge-pill ${isInactive ? 'badge-pill--inactive' : 'badge-pill--active'}">${isInactive ? 'Inativo' : 'Ativo'}</span>`,
      isFaltandoMuito ? '<span class="badge-pill badge-pill--warn">Faltando muito</span>' : '',
      isReativado ? '<span class="badge-pill badge-pill--info">Reativado</span>' : '',
      aluno.RealocadoDe ? `<span class="badge-pill badge-pill--info">Veio de ${escapeHtml(aluno.RealocadoDe)}</span>` : '',
    ].filter(Boolean).join('');

    const percent = Number(aluno.Percentual || 0);
    const faltas = Number(aluno.TotalFaltas || 0);
    const run = Number(aluno.FaltasConsecutivas || 0);

    clone.querySelector('.student-percent').textContent = `Presença individual: ${formatPercent(percent)}`;
    clone.querySelector('.student-absence').textContent = `Faltas: ${faltas}`;
    clone.querySelector('.student-run').textContent = `Faltas seguidas: ${run}`;

    const presentBtn = clone.querySelector('[data-action="present"]');
    const absentBtn = clone.querySelector('[data-action="absent"]');
    const moveBtn = clone.querySelector('[data-action="move"]');
    const toggleBtn = clone.querySelector('[data-action="toggle"]');
    const noteInput = clone.querySelector('.student-observacao');

    presentBtn.classList.toggle('is-selected-present', row.presenca === 'sim');
    absentBtn.classList.toggle('is-selected-absent', row.presenca !== 'sim');

    presentBtn.addEventListener('click', () => setStudentPresence(row.alunoId, 'sim'));
    absentBtn.addEventListener('click', () => setStudentPresence(row.alunoId, 'nao'));
    moveBtn.addEventListener('click', () => moveStudent(row.alunoId));
    toggleBtn.addEventListener('click', () => toggleStudentStatus(row.alunoId));

    noteInput.value = row.observacao || '';
    noteInput.addEventListener('input', (event) => {
      row.observacao = event.target.value;
      markDirty();
    });

    els.studentsList.appendChild(clone);
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
  row.presenca = presence === 'sim' ? 'sim' : 'nao';
  state.dirty = true;
  persistDraft(call);
  renderAll();
}

function setAllPresence(presence) {
  const call = getCurrentCall();
  if (!call) return;
  call.rows.forEach((row) => {
    if (isInactiveStudent(row)) return;
    row.presenca = presence === 'sim' ? 'sim' : 'nao';
  });
  state.dirty = true;
  persistDraft(call);
  renderAll();
}

async function saveCurrentCall({ silent = false } = {}) {
  const turma = getCurrentTurma();
  const call = getCurrentCall();
  if (!turma || !call) {
    throw new Error('Selecione uma turma antes de salvar.');
  }

  const payload = {
    action: 'saveCall',
    date: state.dateKey,
    turmaId: turma.TurmaID,
    chamadaId: call.chamadaId,
    oferta: call.oferta || '',
    visitantes: String(call.visitantes || 0),
    visitantesTexto: call.visitantesTexto || '',
    rowsJson: JSON.stringify(call.rows),
  };

  if (!silent) showLoading('Salvando chamada...');
  try {
    const result = await apiPost(payload);

    state.resumoGeral = result.resumoGeral || state.resumoGeral;
    state.chamadasByTurma[turma.TurmaID] = result.turmaCall || call;
    state.dirty = false;
    clearDraft(call.chamadaId);

    await refreshFromBackend(false);
    state.selectedTurmaId = turma.TurmaID;
    renderAll();
    showSuccess(result.message || 'Chamada salva com sucesso.');
    return result;
  } finally {
    if (!silent) hideLoading();
  }
}

async function sendReport(scope) {
  const turma = getCurrentTurma();
  if (scope === 'turma' && !turma) throw new Error('Selecione uma turma.');
  if (state.dirty) {
    await saveCurrentCall({ silent: true });
  }

  showBusy(scope === 'geral' ? 'Enviando relatório geral...' : 'Enviando relatório da turma...');
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
}

function moveStudent(alunoId) {
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

async function addTurma(event) {
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
  const call = getCurrentCall();
  if (!call) return;
  const ok = window.confirm('Limpar a chamada desta turma nesta data? Isso só altera a tela atual até salvar novamente.');
  if (!ok) return;
  call.rows.forEach((row) => {
    row.presenca = 'nao';
    row.observacao = '';
  });
  call.oferta = '';
  call.visitantes = 0;
  call.visitantesTexto = '';
  state.dirty = true;
  persistDraft(call);
  renderAll();
}

async function saveAndAdvance() {
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
  const visitantesTextoInput = document.getElementById('visitantesTextoInput');

  if (ofertaInput) ofertaInput.value = call.oferta || '';
  if (visitantesInput) visitantesInput.value = String(call.visitantes || 0);
  if (visitantesTextoInput) visitantesTextoInput.value = call.visitantesTexto || '';

  if (ofertaInput && !ofertaInput.dataset.bound) {
    ofertaInput.dataset.bound = '1';
    ofertaInput.addEventListener('input', (event) => {
      const current = getCurrentCall();
      if (!current) return;
      current.oferta = event.target.value;
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
      markDirty();
      renderSummary();
      renderReports();
    });
  }

  if (visitantesTextoInput && !visitantesTextoInput.dataset.bound) {
    visitantesTextoInput.dataset.bound = '1';
    visitantesTextoInput.addEventListener('input', (event) => {
      const current = getCurrentCall();
      if (!current) return;
      current.visitantesTexto = event.target.value;
      markDirty();
      renderReports();
    });
  }
}

async function refreshFromBackend(showMessage = false) {
  state.loading = true;
  showLoading('Carregando dados...');

  try {
    const data = await apiGet({
      action: 'init',
      date: state.dateKey,
    });

    state.turmas = data.turmas || [];
    state.alunos = data.alunos || [];
    state.chamadasByTurma = data.callsByTurma || {};
    state.resumoGeral = data.resumoGeral || null;

    const storage = storageState();
    const drafts = storage.drafts || {};
    Object.values(state.chamadasByTurma).forEach((call) => {
      if (!call) return;
      if (!call.isSaved && drafts[call.chamadaId]) {
        state.chamadasByTurma[call.turmaId] = restoreDraft(call);
      }
    });

    if (!state.selectedTurmaId || !state.turmas.some((t) => t.TurmaID === state.selectedTurmaId)) {
      state.selectedTurmaId = state.turmas[0]?.TurmaID || '';
    }

    if (showMessage) showSuccess('Dados atualizados.');
  } finally {
    state.loading = false;
    hideLoading();
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
    els.dateInput.value = state.dateKey;
    els.showInactive.checked = true;
    els.searchInput.value = '';

    const storage = storageState();
    state.selectedTurmaId = storage.selectedTurmaId || '';

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
  state.dateKey = event.target.value || todayKey();
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
