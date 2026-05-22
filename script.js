
const APPS_SCRIPT_URL =
  window.APPS_SCRIPT_URL ||
  'https://script.google.com/macros/s/AKfycbxqqMq1jnkQ3c_5KjEW7i6a0EZgXiy-hqduShtvpeRl-4olRKc6cEKFPAH1C42HZQ2kUw/exec';

const state = {
  dateKey: todayKey(),
  turmas: [],
  alunos: [],
  callsByTurma: {},
  resumoGeral: null,
  selectedTurmaId: '',
  search: '',
  showInactive: true,
  dirty: false,
  loading: false,
};

const els = {
  dateInput: document.getElementById('dateInput'),
  turmaSelect: document.getElementById('turmaSelect'),
  searchInput: document.getElementById('searchInput'),
  showInactive: document.getElementById('showInactive'),
  ofertaInput: document.getElementById('ofertaInput'),
  visitantesInput: document.getElementById('visitantesInput'),
  bibliasInput: document.getElementById('bibliasInput'),
  revistasInput: document.getElementById('revistasInput'),
  reloadBtn: document.getElementById('reloadBtn'),
  clearBtn: document.getElementById('clearBtn'),
  markAllPresentBtn: document.getElementById('markAllPresentBtn'),
  markAllAbsentBtn: document.getElementById('markAllAbsentBtn'),
  saveBtn: document.getElementById('saveBtn'),
  saveNextBtn: document.getElementById('saveNextBtn'),
  sendTurmaBtn: document.getElementById('sendTurmaBtn'),
  sendGeralBtn: document.getElementById('sendGeralBtn'),
  copyTurmaBtn: document.getElementById('copyTurmaBtn'),
  copyGeralBtn: document.getElementById('copyGeralBtn'),
  turmaMeta: document.getElementById('turmaMeta'),
  emptyState: document.getElementById('emptyState'),
  studentsList: document.getElementById('studentsList'),
  turmaReport: document.getElementById('turmaReport'),
  geralReport: document.getElementById('geralReport'),
  feedback: document.getElementById('feedback'),
  statTotalAlunos: document.getElementById('statTotalAlunos'),
  statPresentes: document.getElementById('statPresentes'),
  statAusentes: document.getElementById('statAusentes'),
  statPercentual: document.getElementById('statPercentual'),
  statOferta: document.getElementById('statOferta'),
  statVisitantes: document.getElementById('statVisitantes'),
  statBiblias: document.getElementById('statBiblias'),
  statRevistas: document.getElementById('statRevistas'),
  turmaForm: document.getElementById('turmaForm'),
  alunoForm: document.getElementById('alunoForm'),
  turmaNome: document.getElementById('turmaNome'),
  turmaOrdem: document.getElementById('turmaOrdem'),
  alunoNome: document.getElementById('alunoNome'),
  alunoCpf: document.getElementById('alunoCpf'),
  alunoTurma: document.getElementById('alunoTurma'),
  studentTemplate: document.getElementById('studentTemplate'),
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeDateKey(value) {
  const text = String(value || '').trim();
  if (!text) return todayKey();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const d = new Date(text);
  if (!Number.isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return todayKey();
}

function onlyDigits(value) {
  return String(value || '').replace(/\D+/g, '');
}

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function toInt(value) {
  const n = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function toNumber(value) {
  const n = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function toBool(value) {
  if (value === true || value === 1) return true;
  if (typeof value === 'string') {
    return ['1', 'true', 'sim', 'yes', 'y', 'on'].includes(value.trim().toLowerCase());
  }
  return false;
}

function isPresentLikeValue(value) {
  const v = String(value || '').trim().toLowerCase();
  return v === 'sim' || v === 'presente' || v === 'presenca' || v === 'presença';
}

function isDelayedValue(value) {
  const v = String(value || '').trim().toLowerCase();
  return v === 'atrasado' || v === 'atrasada';
}

function formatDateBR(value) {
  const key = normalizeDateKey(value);
  const [y, m, d] = key.split('-');
  return `${d}/${m}/${y}`;
}

function formatMoneyBR(value) {
  const n = Number(value || 0);
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseMoneyBR(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const text = String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');
  const n = Number(text);
  return Number.isFinite(n) ? n : 0;
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1).replace('.0', '')}%`;
}

function safeText(value) {
  return String(value ?? '').trim();
}

function setFeedback(message, type = 'info') {
  if (!els.feedback) return;
  els.feedback.textContent = message || '';
  els.feedback.dataset.type = type;
}

function showBusy(isBusy) {
  state.loading = !!isBusy;
  const controls = [
    els.reloadBtn,
    els.clearBtn,
    els.markAllPresentBtn,
    els.markAllAbsentBtn,
    els.saveBtn,
    els.saveNextBtn,
    els.sendTurmaBtn,
    els.sendGeralBtn,
    els.copyTurmaBtn,
    els.copyGeralBtn,
    els.turmaForm,
    els.alunoForm,
    els.turmaSelect,
    els.dateInput,
  ];
  controls.forEach((el) => {
    if (!el) return;
    if ('disabled' in el) el.disabled = !!isBusy;
  });
}

function apiUrl(params = {}) {
  const url = new URL(APPS_SCRIPT_URL);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

async function parseJsonResponse(response) {
  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (err) {
      throw new Error(text || `HTTP ${response.status}`);
    }
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
      throw new Error('A requisição demorou demais. Verifique a conexão e tente novamente.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function apiPost(payload = {}, { timeoutMs = 30000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(5000, Number(timeoutMs) || 30000));
  try {
    const body = new URLSearchParams();
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        body.set(key, String(value));
      }
    });

    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body,
      signal: controller.signal,
    });
    return await parseJsonResponse(response);
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error('A requisição demorou demais. Verifique a conexão e tente novamente.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeTurmaFromBackend(turma, index = 0) {
  return {
    TurmaID: safeText(turma?.TurmaID || turma?.turmaId || turma?.id || turma?.Nome || turma?.nome),
    Nome: safeText(turma?.Nome || turma?.nome || turma?.TurmaID || turma?.turmaId),
    Ordem: Number(turma?.Ordem ?? turma?.ordem ?? index + 1) || index + 1,
  };
}

function normalizeAlunoFromBackend(aluno) {
  return {
    AlunoID: safeText(aluno?.AlunoID || aluno?.alunoId || aluno?.id || `${aluno?.TurmaID || aluno?.turmaId}__${aluno?.Nome || aluno?.nome}`),
    Nome: safeText(aluno?.Nome || aluno?.nome),
    TurmaID: safeText(aluno?.TurmaID || aluno?.turmaId || aluno?.TurmaNome || aluno?.turmaNome),
    TurmaNome: safeText(aluno?.TurmaNome || aluno?.turmaNome || aluno?.TurmaID || aluno?.turmaId),
    CPF: onlyDigits(aluno?.CPF || aluno?.cpf || ''),
    Ativo: safeText(aluno?.Ativo || aluno?.ativo || 'sim') || 'sim',
    Status: safeText(aluno?.Status || aluno?.status || 'ativo') || 'ativo',
    FaltasConsecutivas: toInt(aluno?.FaltasConsecutivas ?? aluno?.faltasConsecutivas),
    TotalPresencas: toInt(aluno?.TotalPresencas ?? aluno?.totalPresencas),
    TotalFaltas: toInt(aluno?.TotalFaltas ?? aluno?.totalFaltas),
    Percentual: toNumber(aluno?.Percentual ?? aluno?.percentual),
    FaltandoMuito: safeText(aluno?.FaltandoMuito || aluno?.faltandoMuito || ''),
    UltimaPresenca: safeText(aluno?.UltimaPresenca || aluno?.ultimaPresenca || ''),
    UltimaAusencia: safeText(aluno?.UltimaAusencia || aluno?.ultimaAusencia || ''),
    RealocadoDe: safeText(aluno?.RealocadoDe || aluno?.realocadoDe || ''),
    CriadoEm: safeText(aluno?.CriadoEm || aluno?.criadoEm || ''),
    AtualizadoEm: safeText(aluno?.AtualizadoEm || aluno?.atualizadoEm || ''),
  };
}

function normalizeRowFromBackend(row, turmaId, turmaNome) {
  const presencaRaw =
    row?.presenca ??
    row?.PRESENCA ??
    row?.PRESENÇA ??
    row?.presencaStatus ??
    row?.status ??
    '';
  let presenca = String(presencaRaw || '').trim().toLowerCase();
  if (['p', 'presente', 'sim', 'presenca', 'presença'].includes(presenca)) presenca = 'sim';
  if (['f', 'ausente', 'nao', 'não', 'ausência', 'ausencia'].includes(presenca)) presenca = 'nao';
  if (['atrasado', 'atrasada', 'delay', 'late'].includes(presenca)) presenca = 'atrasado';
  if (!['sim', 'nao', 'atrasado'].includes(presenca)) presenca = 'nao';

  const nome = safeText(row?.nome || row?.ALUNO);
  return {
    alunoId: safeText(row?.alunoId || row?.ALUNO_ID || row?.id || `${turmaId}__${nome}`),
    nome,
    turmaId: safeText(row?.turmaId || row?.CLASSE || turmaId),
    turmaNome: safeText(row?.turmaNome || row?.CLASSE || turmaNome),
    presenca,
    atraso: isDelayedValue(presenca),
    observacao: safeText(row?.observacao || row?.OBSERVACAO || ''),
    statusAluno: safeText(row?.statusAluno || row?.Status || row?.statusAlunoTexto || 'ativo') || 'ativo',
    autoPresenca: toBool(row?.autoPresenca ?? row?.AUTO_PRESENÇA),
    autoAtraso: toBool(row?.autoAtraso ?? row?.AUTO_ATRASO),
    salvo: toBool(row?.salvo ?? row?.SALVO),
    ausSeguidas: toInt(row?.ausSeguidas ?? row?.AUS_SEGUIDA),
  };
}

function normalizeCallFromBackend(call, turma) {
  const turmaId = safeText(call?.turmaId || turma?.TurmaID || '');
  const turmaNome = safeText(call?.turmaNome || turma?.Nome || turmaId);
  const rows = Array.isArray(call?.rows) ? call.rows.map((row) => normalizeRowFromBackend(row, turmaId, turmaNome)) : [];
  return {
    chamadaId: safeText(call?.chamadaId || `${turmaId}_${state.dateKey}`),
    data: normalizeDateKey(call?.data || call?.date || state.dateKey),
    turmaId,
    turmaNome,
    oferta: toNumber(call?.oferta ?? 0),
    visitantes: toInt(call?.visitantes ?? 0),
    biblias: toInt(call?.biblias ?? 0),
    revistas: toInt(call?.revistas ?? 0),
    totalAlunos: toInt(call?.totalAlunos ?? rows.length),
    presentes: toInt(call?.presentes ?? rows.filter((r) => r.presenca === 'sim').length),
    atrasos: toInt(call?.atrasos ?? rows.filter((r) => r.presenca === 'atrasado').length),
    ausentes: toInt(call?.ausentes ?? rows.filter((r) => r.presenca === 'nao').length),
    percentual: toNumber(call?.percentual ?? 0),
    enviadoTelegram: toBool(call?.enviadoTelegram),
    telegramEnviadoEm: safeText(call?.telegramEnviadoEm || ''),
    rows,
    isSaved: toBool(call?.isSaved),
  };
}

function getTurmasSorted() {
  return [...state.turmas].sort((a, b) => {
    const oa = Number(a.Ordem || 0) || 0;
    const ob = Number(b.Ordem || 0) || 0;
    if (oa !== ob) return oa - ob;
    return String(a.Nome || '').localeCompare(String(b.Nome || ''));
  });
}

function getCurrentTurma() {
  return getTurmasSorted().find((turma) => String(turma.TurmaID) === String(state.selectedTurmaId)) || null;
}

function getCurrentCall() {
  const turma = getCurrentTurma();
  if (!turma) return null;
  if (!state.callsByTurma[turma.TurmaID]) {
    state.callsByTurma[turma.TurmaID] = blankCallForTurma(turma);
  }
  return state.callsByTurma[turma.TurmaID];
}

function getStudentsForTurma(turmaId) {
  return state.alunos
    .filter((aluno) => String(aluno.TurmaID) === String(turmaId))
    .sort((a, b) => {
      const aInactive = isInactiveStudent(a) ? 1 : 0;
      const bInactive = isInactiveStudent(b) ? 1 : 0;
      if (aInactive !== bInactive) return aInactive - bInactive;
      return String(a.Nome || '').localeCompare(String(b.Nome || ''));
    });
}

function isInactiveStudent(student) {
  const status = String(student?.Status || student?.statusAluno || student?.Ativo || 'ativo').trim().toLowerCase();
  return status === 'inativo' || status === 'nao' || status === 'não' || status === 'off';
}

function blankCallForTurma(turma) {
  const turmaId = turma?.TurmaID || '';
  const turmaNome = turma?.Nome || turmaId;
  const roster = getStudentsForTurma(turmaId);
  const rows = roster.map((student) => ({
    alunoId: student.AlunoID,
    nome: student.Nome,
    turmaId,
    turmaNome,
    presenca: 'nao',
    atraso: false,
    observacao: '',
    statusAluno: student.Status || 'ativo',
    autoPresenca: false,
    autoAtraso: false,
    salvo: false,
    ausSeguidas: student.FaltasConsecutivas || 0,
  }));

  return {
    chamadaId: `${turmaId}_${state.dateKey}`,
    data: state.dateKey,
    turmaId,
    turmaNome,
    oferta: 0,
    visitantes: 0,
    biblias: 0,
    revistas: 0,
    totalAlunos: rows.length,
    presentes: 0,
    atrasos: 0,
    ausentes: rows.length,
    percentual: 0,
    enviadoTelegram: false,
    telegramEnviadoEm: '',
    rows,
    isSaved: false,
  };
}

function syncRowPresenceFields(row) {
  const next = { ...row };
  if (next.presenca === 'atrasado') next.atraso = true;
  if (next.presenca === 'sim') next.atraso = false;
  if (next.presenca === 'nao') next.atraso = false;
  next.autoPresenca = !!next.autoPresenca && next.presenca === 'sim';
  next.autoAtraso = !!next.autoAtraso && next.presenca === 'atrasado';
  return next;
}

function applyCurrentFilters(rows) {
  const term = normalizeKey(state.search);
  return rows.filter((row) => {
    if (!state.showInactive && isInactiveStudent(row)) return false;
    if (!term) return true;
    return normalizeKey(row.nome).includes(term);
  });
}

function markDirty() {
  state.dirty = true;
  const call = getCurrentCall();
  if (call) call.isSaved = false;
}

function updateCallFromInputs() {
  const call = getCurrentCall();
  if (!call) return;

  call.data = normalizeDateKey(els.dateInput?.value || state.dateKey);
  call.oferta = parseMoneyBR(els.ofertaInput?.value ?? call.oferta ?? 0);
  call.visitantes = toInt(els.visitantesInput?.value ?? call.visitantes ?? 0);
  call.biblias = toInt(els.bibliasInput?.value ?? call.biblias ?? 0);
  call.revistas = toInt(els.revistasInput?.value ?? call.revistas ?? 0);
}

function setStudentPresence(alunoId, presenca, { auto = false } = {}) {
  const call = getCurrentCall();
  if (!call) return;

  const row = call.rows.find((item) => String(item.alunoId) === String(alunoId));
  if (!row) return;

  row.presenca = presenca;
  row.atraso = presenca === 'atrasado';
  row.autoPresenca = auto && presenca === 'sim';
  row.autoAtraso = auto && presenca === 'atrasado';
  row.salvo = false;
  markDirty();
  renderAll();
}

function setAllPresence(presenca) {
  const call = getCurrentCall();
  if (!call) return;

  call.rows.forEach((row) => {
    if (isInactiveStudent(row)) return;
    row.presenca = presenca;
    row.atraso = presenca === 'atrasado';
    row.autoPresenca = false;
    row.autoAtraso = false;
    row.salvo = false;
  });
  markDirty();
  renderAll();
}

function clearCurrentCall() {
  const turma = getCurrentTurma();
  if (!turma) return;
  if (!window.confirm('Limpar a chamada desta turma agora?')) return;
  state.callsByTurma[turma.TurmaID] = blankCallForTurma(turma);
  state.dirty = true;
  renderAll();
}

function buildTurmaReportText(call) {
  const turma = getCurrentTurma();
  if (!call || !turma) return 'Nenhuma turma selecionada.';
  const dateText = formatDateBR(state.dateKey);
  const lines = [
    'RELATÓRIO DA TURMA',
    `Data: ${dateText}`,
    `Turma: ${call.turmaNome}`,
    '',
    `Presentes: ${call.presentes}`,
    `Atrasados: ${call.atrasos}`,
    `Ausentes: ${call.ausentes}`,
    `Presença da turma: ${formatPercent(call.percentual || 0)}`,
    `Oferta: ${formatMoneyBR(call.oferta || 0)}`,
    `Visitantes: ${call.visitantes || 0}`,
    `Bíblias: ${call.biblias || 0}`,
    `Revistas: ${call.revistas || 0}`,
    '',
    'Alunos:',
    ...call.rows.map((row) => {
      const label = row.presenca === 'sim'
        ? 'P'
        : row.presenca === 'atrasado'
          ? 'A'
          : 'F';
      return `- ${row.nome} — ${label}`;
    }),
  ];
  return lines.join('\n');
}

function buildGeneralReportText() {
  const dateText = formatDateBR(state.dateKey);
  const calls = Object.values(state.callsByTurma || {});
  const totalTurmas = state.turmas.length;
  const turmasSalvas = calls.filter((call) => call?.isSaved).length;
  const totalAlunos = calls.reduce((acc, call) => acc + Number(call?.totalAlunos || 0), 0);
  const presentes = calls.reduce((acc, call) => acc + Number(call?.presentes || 0), 0);
  const atrasos = calls.reduce((acc, call) => acc + Number(call?.atrasos || 0), 0);
  const ausentes = calls.reduce((acc, call) => acc + Number(call?.ausentes || 0), 0);
  const oferta = calls.reduce((acc, call) => acc + parseMoneyBR(call?.oferta || 0), 0);
  const visitantes = calls.reduce((acc, call) => acc + toInt(call?.visitantes || 0), 0);
  const biblias = calls.reduce((acc, call) => acc + toInt(call?.biblias || 0), 0);
  const revistas = calls.reduce((acc, call) => acc + toInt(call?.revistas || 0), 0);
  const percentual = totalAlunos ? ((presentes + atrasos) / totalAlunos) * 100 : 0;

  const lines = [
    'RELATÓRIO GERAL',
    `Data: ${dateText}`,
    '',
    `Turmas salvas: ${turmasSalvas}/${totalTurmas}`,
    `Total de alunos: ${totalAlunos}`,
    `Presentes: ${presentes}`,
    `Atrasados: ${atrasos}`,
    `Ausentes: ${ausentes}`,
    `Presença geral: ${formatPercent(percentual)}`,
    `Oferta total: ${formatMoneyBR(oferta)}`,
    `Visitantes: ${visitantes}`,
    `Bíblias: ${biblias}`,
    `Revistas: ${revistas}`,
    '',
    'Resumo por turma:',
    ...getTurmasSorted().map((turma) => {
      const call = state.callsByTurma[turma.TurmaID];
      if (!call) return `- ${turma.Nome}: sem chamada`;
      return `- ${turma.Nome}: ${call.presentes}P, ${call.atrasos}A, ${call.ausentes}F`;
    }),
  ];
  return lines.join('\n');
}


function bindCallFieldValues() {
  const call = getCurrentCall();
  if (!call) return;

  if (els.ofertaInput) {
    els.ofertaInput.value = call.oferta ? formatMoneyBR(call.oferta) : '';
    if (!els.ofertaInput.dataset.bound) {
      els.ofertaInput.dataset.bound = '1';
      els.ofertaInput.addEventListener('input', (event) => {
        const current = getCurrentCall();
        if (!current) return;
        current.oferta = parseMoneyBR(event.target.value);
        markDirty();
        renderSummary();
        renderReports();
      });
    }
  }

  if (els.visitantesInput) {
    els.visitantesInput.value = String(call.visitantes ?? 0);
    if (!els.visitantesInput.dataset.bound) {
      els.visitantesInput.dataset.bound = '1';
      els.visitantesInput.addEventListener('input', (event) => {
        const current = getCurrentCall();
        if (!current) return;
        current.visitantes = toInt(event.target.value);
        markDirty();
        renderSummary();
        renderReports();
      });
    }
  }

  if (els.bibliasInput) {
    els.bibliasInput.value = String(call.biblias ?? 0);
    if (!els.bibliasInput.dataset.bound) {
      els.bibliasInput.dataset.bound = '1';
      els.bibliasInput.addEventListener('input', (event) => {
        const current = getCurrentCall();
        if (!current) return;
        current.biblias = toInt(event.target.value);
        markDirty();
        renderSummary();
        renderReports();
      });
    }
  }

  if (els.revistasInput) {
    els.revistasInput.value = String(call.revistas ?? 0);
    if (!els.revistasInput.dataset.bound) {
      els.revistasInput.dataset.bound = '1';
      els.revistasInput.addEventListener('input', (event) => {
        const current = getCurrentCall();
        if (!current) return;
        current.revistas = toInt(event.target.value);
        markDirty();
        renderSummary();
        renderReports();
      });
    }
  }
}

function renderSummary() {
  const call = getCurrentCall();
  const turma = getCurrentTurma();

  if (!call) {
    els.statTotalAlunos.textContent = '0';
    els.statPresentes.textContent = '0';
    els.statAusentes.textContent = '0';
    els.statPercentual.textContent = '0%';
    els.statOferta.textContent = formatMoneyBR(0);
    els.statVisitantes.textContent = '0';
    els.statBiblias.textContent = '0';
    els.statRevistas.textContent = '0';
    els.turmaMeta.textContent = 'Selecione uma turma para carregar a chamada.';
    return;
  }

  els.statTotalAlunos.textContent = String(call.totalAlunos || 0);
  els.statPresentes.textContent = String((call.presentes || 0) + (call.atrasos || 0));
  els.statAusentes.textContent = String(call.ausentes || 0);
  els.statPercentual.textContent = formatPercent(call.percentual || 0);
  els.statOferta.textContent = formatMoneyBR(call.oferta || 0);
  els.statVisitantes.textContent = String(call.visitantes || 0);
  els.statBiblias.textContent = String(call.biblias || 0);
  els.statRevistas.textContent = String(call.revistas || 0);

  els.turmaMeta.textContent = turma
    ? `${turma.Nome} • ${call.totalAlunos || 0} alunos • ${call.isSaved ? 'salva' : (state.dirty ? 'com alterações' : 'em aberto')}`
    : 'Selecione uma turma para carregar a chamada.';
}

function renderTurmaSelects() {
  const turmas = getTurmasSorted();
  const previous = state.selectedTurmaId;
  const selectedValid = turmas.some((turma) => String(turma.TurmaID) === String(previous));
  if (!selectedValid && turmas[0]) {
    state.selectedTurmaId = turmas[0].TurmaID;
  }

  const selectHtml = turmas
    .map((turma) => `<option value="${escapeHtml(turma.TurmaID)}"${String(turma.TurmaID) === String(state.selectedTurmaId) ? ' selected' : ''}>${escapeHtml(turma.Nome)}</option>`)
    .join('');

  if (els.turmaSelect) els.turmaSelect.innerHTML = selectHtml;
  if (els.alunoTurma) els.alunoTurma.innerHTML = selectHtml || '<option value="">Nenhuma turma</option>';
}

function renderStudents() {
  if (!els.studentsList || !els.studentTemplate) return;
  const call = getCurrentCall();

  if (!call || !call.rows.length) {
    els.emptyState.style.display = 'block';
    els.studentsList.innerHTML = '';
    return;
  }

  els.emptyState.style.display = 'none';
  const rows = applyCurrentFilters(call.rows);

  els.studentsList.innerHTML = '';
  const fragment = document.createDocumentFragment();

  rows.forEach((row) => {
    const node = els.studentTemplate.content.firstElementChild.cloneNode(true);
    const nameEl = node.querySelector('.student-name');
    const badgesEl = node.querySelector('.student-badges');
    const percentEl = node.querySelector('.student-percent');
    const absenceEl = node.querySelector('.student-absence');
    const runEl = node.querySelector('.student-run');
    const obsInput = node.querySelector('.student-observacao');

    nameEl.textContent = row.nome || 'Aluno sem nome';
    obsInput.value = row.observacao || '';

    const isInactive = isInactiveStudent(row);
    const presenceText = row.presenca === 'sim' ? 'Presente' : row.presenca === 'atrasado' ? 'Atrasado' : 'Ausente';
    const badges = [];
    if (row.autoPresenca) badges.push('Auto presença');
    if (row.autoAtraso) badges.push('Auto atraso');
    if (row.salvo) badges.push('Salvo');
    if (isInactive) badges.push('Inativo');
    badgesEl.innerHTML = badges.map((item) => `<span class="badge">${escapeHtml(item)}</span>`).join('');

    percentEl.textContent = presenceText;
    absenceEl.textContent = `Faltas seguidas: ${row.ausSeguidas || 0}`;
    runEl.textContent = row.atraso ? 'Conta como presença' : 'Linha atual pronta';

    node.dataset.alunoId = row.alunoId;
    node.dataset.presenca = row.presenca;
    if (isInactive) node.classList.add('student--inactive');
    if (row.presenca === 'sim') node.classList.add('student--present');
    if (row.presenca === 'atrasado') node.classList.add('student--delay');
    if (row.presenca === 'nao') node.classList.add('student--absent');

    node.querySelector('[data-action="present"]').addEventListener('click', () => setStudentPresence(row.alunoId, 'sim'));
    node.querySelector('[data-action="absent"]').addEventListener('click', () => setStudentPresence(row.alunoId, 'nao'));
    node.querySelector('[data-action="delay"]').addEventListener('click', () => setStudentPresence(row.alunoId, 'atrasado'));

    node.querySelector('[data-action="edit"]').addEventListener('click', () => moveStudent(row.alunoId));
    node.querySelector('[data-action="toggle"]').addEventListener('click', () => toggleStudentStatus(row.alunoId));

    obsInput.addEventListener('input', (event) => {
      row.observacao = event.target.value;
      markDirty();
    });

    fragment.appendChild(node);
  });

  els.studentsList.appendChild(fragment);
}

function renderReports() {
  const call = getCurrentCall();
  if (els.turmaReport) els.turmaReport.value = call ? buildTurmaReportText(call) : '';
  if (els.geralReport) els.geralReport.value = buildGeneralReportText();
}

function renderAll() {
  renderTurmaSelects();
  bindCallFieldValues();
  renderSummary();
  renderStudents();
  renderReports();
  if (els.dateInput) els.dateInput.value = state.dateKey;
  if (els.searchInput) els.searchInput.value = state.search;
  if (els.showInactive) els.showInactive.checked = state.showInactive;
}

async function refreshFromBackend({ preserveSelection = true } = {}) {
  showBusy(true);
  try {
    const data = await apiGet({ action: 'init', date: state.dateKey }, { timeoutMs: 60000 });

    state.dateKey = normalizeDateKey(data.dateKey || state.dateKey);
    state.turmas = Array.isArray(data.turmas) ? data.turmas.map(normalizeTurmaFromBackend) : [];
    state.alunos = Array.isArray(data.alunos) ? data.alunos.map(normalizeAlunoFromBackend) : [];
    state.callsByTurma = {};
    Object.entries(data.callsByTurma || {}).forEach(([turmaId, call]) => {
      const turma = state.turmas.find((item) => String(item.TurmaID) === String(turmaId)) || null;
      const normalized = normalizeCallFromBackend(call, turma);
      state.callsByTurma[normalized.turmaId || turmaId] = normalized;
    });
    state.resumoGeral = data.resumoGeral || null;

    const turmas = getTurmasSorted();
    if (preserveSelection && state.selectedTurmaId && turmas.some((turma) => String(turma.TurmaID) === String(state.selectedTurmaId))) {
      // mantém seleção
    } else {
      state.selectedTurmaId = turmas[0]?.TurmaID || '';
    }

    if (!state.selectedTurmaId && turmas[0]) state.selectedTurmaId = turmas[0].TurmaID;
    if (!state.callsByTurma[state.selectedTurmaId] && turmas[0]) {
      state.selectedTurmaId = turmas[0].TurmaID;
    }

    state.dirty = false;
    if (els.dateInput) els.dateInput.value = state.dateKey;
    renderAll();
    setFeedback('Dados carregados com sucesso.', 'success');
  } finally {
    showBusy(false);
  }
}

async function saveCurrentCall() {
  const turma = getCurrentTurma();
  const call = getCurrentCall();
  if (!turma || !call) {
    throw new Error('Selecione uma turma antes de salvar.');
  }

  updateCallFromInputs();

  const payload = {
    action: 'saveCall',
    date: state.dateKey,
    turmaId: turma.TurmaID,
    chamadaId: call.chamadaId,
    oferta: call.oferta ?? 0,
    visitantes: call.visitantes ?? 0,
    biblias: call.biblias ?? 0,
    revistas: call.revistas ?? 0,
    rowsJson: JSON.stringify(call.rows.map(syncRowPresenceFields)),
  };

  showBusy(true);
  try {
    const result = await apiPost(payload, { timeoutMs: 60000 });
    if (result?.turmaCall) {
      state.callsByTurma[turma.TurmaID] = normalizeCallFromBackend(result.turmaCall, turma);
    } else {
      state.callsByTurma[turma.TurmaID] = {
        ...call,
        isSaved: true,
      };
    }
    state.resumoGeral = result.resumoGeral || state.resumoGeral;
    state.dirty = false;
    renderAll();
    setFeedback(result.message || 'Chamada salva com sucesso.', 'success');
    return result;
  } finally {
    showBusy(false);
  }
}

async function saveAndAdvance() {
  const turmas = getTurmasSorted();
  if (!turmas.length) return;
  await saveCurrentCall();
  const index = turmas.findIndex((turma) => String(turma.TurmaID) === String(state.selectedTurmaId));
  const next = turmas[(index + 1) % turmas.length];
  if (next) {
    state.selectedTurmaId = next.TurmaID;
    renderAll();
  }
}

async function sendReport(scope) {
  const turma = getCurrentTurma();
  if (scope === 'turma' && !turma) {
    throw new Error('Selecione uma turma.');
  }

  if (state.dirty) {
    await saveCurrentCall();
  }

  showBusy(true);
  try {
    const result = await apiPost({
      action: 'sendReport',
      scope,
      date: state.dateKey,
      turmaId: turma?.TurmaID || '',
    }, { timeoutMs: 60000 });

    if (result?.text) {
      if (scope === 'turma' && els.turmaReport) els.turmaReport.value = result.text;
      if (scope === 'geral' && els.geralReport) els.geralReport.value = result.text;
    }

    setFeedback(result.message || 'Relatório gerado.', 'success');
    return result;
  } finally {
    showBusy(false);
  }
}

async function copyText(text) {
  const value = String(text || '');
  if (!value) {
    setFeedback('Nada para copiar.', 'info');
    return;
  }

  try {
    await navigator.clipboard.writeText(value);
    setFeedback('Texto copiado.', 'success');
  } catch (err) {
    const area = document.createElement('textarea');
    area.value = value;
    area.style.position = 'fixed';
    area.style.left = '-9999px';
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    document.body.removeChild(area);
    setFeedback('Texto copiado.', 'success');
  }
}

async function addTurma(event) {
  event.preventDefault();
  const nome = safeText(els.turmaNome?.value);
  const ordem = safeText(els.turmaOrdem?.value);

  if (!nome) {
    setFeedback('Informe o nome da turma.', 'error');
    return;
  }

  showBusy(true);
  try {
    const result = await apiPost({ action: 'addTurma', nome, ordem }, { timeoutMs: 60000 });
    setFeedback(result.message || 'Turma cadastrada.', 'success');
    els.turmaNome.value = '';
    els.turmaOrdem.value = '';
    await refreshFromBackend({ preserveSelection: false });
    const matched = getTurmasSorted().find((turma) => normalizeKey(turma.Nome) === normalizeKey(nome));
    if (matched) {
      state.selectedTurmaId = matched.TurmaID;
      renderAll();
    }
  } finally {
    showBusy(false);
  }
}

async function addAluno(event) {
  event.preventDefault();
  const nome = safeText(els.alunoNome?.value);
  const cpf = onlyDigits(els.alunoCpf?.value).slice(0, 11);
  const turmaId = safeText(els.alunoTurma?.value);

  if (!nome) {
    setFeedback('Informe o nome do aluno.', 'error');
    return;
  }
  if (!turmaId) {
    setFeedback('Selecione uma turma.', 'error');
    return;
  }

  showBusy(true);
  try {
    const result = await apiPost({ action: 'addAluno', nome, cpf, turmaId }, { timeoutMs: 60000 });
    setFeedback(result.message || 'Aluno cadastrado.', 'success');
    els.alunoNome.value = '';
    els.alunoCpf.value = '';
    await refreshFromBackend({ preserveSelection: true });
    state.selectedTurmaId = turmaId;
    renderAll();
  } finally {
    showBusy(false);
  }
}

function moveStudent(alunoId) {
  const turmaAtual = getCurrentTurma();
  const destinos = getTurmasSorted().filter((turma) => !turmaAtual || String(turma.TurmaID) !== String(turmaAtual.TurmaID));
  if (!destinos.length) {
    setFeedback('Cadastre outra turma antes de mover alunos.', 'error');
    return;
  }

  const resposta = window.prompt(
    `Digite a turma de destino:\n\n${destinos.map((turma) => `• ${turma.Nome}`).join('\n')}`,
    destinos[0].TurmaID
  );
  const destino = safeText(resposta);
  if (!destino) return;

  const turmaDestino = destinos.find((turma) =>
    normalizeKey(turma.TurmaID) === normalizeKey(destino) ||
    normalizeKey(turma.Nome) === normalizeKey(destino)
  );

  if (!turmaDestino) {
    setFeedback('Turma de destino inválida.', 'error');
    return;
  }

  showBusy(true);
  apiPost({ action: 'moveAluno', alunoId, turmaId: turmaDestino.TurmaID }, { timeoutMs: 60000 })
    .then(async (result) => {
      setFeedback(result.message || 'Aluno movido com sucesso.', 'success');
      await refreshFromBackend({ preserveSelection: true });
      state.selectedTurmaId = turmaDestino.TurmaID;
      renderAll();
    })
    .catch((err) => {
      setFeedback(err.message || 'Falha ao mover aluno.', 'error');
    })
    .finally(() => {
      showBusy(false);
    });
}

function toggleStudentStatus(alunoId) {
  showBusy(true);
  apiPost({ action: 'toggleAluno', alunoId }, { timeoutMs: 30000 })
    .then((result) => {
      setFeedback(result.message || 'Status atualizado.', result.ok ? 'success' : 'info');
    })
    .catch((err) => {
      setFeedback(err.message || 'Falha ao atualizar status.', 'error');
    })
    .finally(() => {
      showBusy(false);
    });
}

async function handleSelfCpfSubmit() {
  const cpfPrefix = window.prompt('Digite os 5 primeiros números do CPF:');
  const prefix = onlyDigits(cpfPrefix).slice(0, 5);
  if (prefix.length !== 5) {
    setFeedback('Digite exatamente os 5 primeiros números do CPF.', 'error');
    return;
  }

  showBusy(true);
  try {
    const result = await apiPost({ action: 'selfPresence', date: state.dateKey, cpfPrefix: prefix }, { timeoutMs: 60000 });
    setFeedback(result.message || 'Auto presença registrada.', 'success');
    await refreshFromBackend({ preserveSelection: true });
    if (result?.turmaCall?.turmaId) {
      state.selectedTurmaId = result.turmaCall.turmaId;
      renderAll();
    }
  } finally {
    showBusy(false);
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function bindEvents() {
  els.dateInput?.addEventListener('change', async (event) => {
    const nextDate = normalizeDateKey(event.target.value);
    if (nextDate === state.dateKey) return;
    if (state.dirty && !window.confirm('Há alterações não salvas. Trocar a data vai descartar o que foi editado. Deseja continuar?')) {
      els.dateInput.value = state.dateKey;
      return;
    }
    state.dateKey = nextDate;
    state.dirty = false;
    await refreshFromBackend({ preserveSelection: true });
  });

  els.turmaSelect?.addEventListener('change', (event) => {
    state.selectedTurmaId = event.target.value;
    renderAll();
  });

  els.searchInput?.addEventListener('input', (event) => {
    state.search = event.target.value || '';
    renderStudents();
  });

  els.showInactive?.addEventListener('change', (event) => {
    state.showInactive = !!event.target.checked;
    renderStudents();
  });

  els.reloadBtn?.addEventListener('click', async () => {
    if (state.dirty && !window.confirm('Existem alterações não salvas. Atualizar agora vai descartar a chamada atual. Continuar?')) {
      return;
    }
    state.dirty = false;
    await refreshFromBackend({ preserveSelection: true });
  });

  els.clearBtn?.addEventListener('click', () => {
    clearCurrentCall();
  });

  els.markAllPresentBtn?.addEventListener('click', () => setAllPresence('sim'));
  els.markAllAbsentBtn?.addEventListener('click', () => setAllPresence('nao'));

  els.saveBtn?.addEventListener('click', async () => {
    try {
      await saveCurrentCall();
    } catch (err) {
      setFeedback(err.message || 'Falha ao salvar a chamada.', 'error');
    }
  });

  els.saveNextBtn?.addEventListener('click', async () => {
    try {
      await saveAndAdvance();
    } catch (err) {
      setFeedback(err.message || 'Falha ao salvar e avançar.', 'error');
    }
  });

  els.sendTurmaBtn?.addEventListener('click', async () => {
    try {
      const result = await sendReport('turma');
      if (result?.text && els.turmaReport) els.turmaReport.value = result.text;
    } catch (err) {
      setFeedback(err.message || 'Falha ao gerar relatório da turma.', 'error');
    }
  });

  els.sendGeralBtn?.addEventListener('click', async () => {
    try {
      const result = await sendReport('geral');
      if (result?.text && els.geralReport) els.geralReport.value = result.text;
    } catch (err) {
      setFeedback(err.message || 'Falha ao gerar relatório geral.', 'error');
    }
  });

  els.copyTurmaBtn?.addEventListener('click', async () => {
    await copyText(els.turmaReport?.value || '');
  });

  els.copyGeralBtn?.addEventListener('click', async () => {
    await copyText(els.geralReport?.value || '');
  });

  els.turmaForm?.addEventListener('submit', addTurma);
  els.alunoForm?.addEventListener('submit', addAluno);

  window.addEventListener('keydown', (event) => {
    if (event.key === 'F9') {
      event.preventDefault();
      handleSelfCpfSubmit();
    }
  });
}

async function bootstrap() {
  if (els.dateInput) els.dateInput.value = state.dateKey;
  if (els.showInactive) els.showInactive.checked = true;
  bindEvents();
  setFeedback('Carregando dados...', 'info');

  try {
    await refreshFromBackend({ preserveSelection: true });
    setFeedback('Sistema pronto para uso.', 'success');
  } catch (err) {
    console.error(err);
    setFeedback(err.message || 'Falha ao carregar os dados.', 'error');
    renderAll();
  }
}

window.addEventListener('DOMContentLoaded', bootstrap);

window.EBD = {
  refresh: () => refreshFromBackend({ preserveSelection: true }),
  saveCurrentCall,
  sendReport,
  selfPresence: handleSelfCpfSubmit,
};
