
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
  return [...state.alunos].filter(
    (a) => String(a.TurmaID || '') === String(turmaId || '')
  );
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
  call.visitantes = clampWholeNumber(visitantesInput?.value ?? 0, 50);
  if (visitantesInput) visitantesInput.value = normalizeNumericInputValue_(call.visitantes);

  const presentes = getCurrentPresentCount();
  const bibliasMax = presentes + call.visitantes;

  // BÍBLIAS
  call.biblias = clampWholeNumber(bibliasInput?.value ?? 0, bibliasMax);
  if (bibliasInput) bibliasInput.value = normalizeNumericInputValue_(call.biblias);

  // REVISTAS
  call.revistas = clampWholeNumber(revistasInput?.value ?? 0, bibliasMax);
  if (revistasInput) revistasInput.value = normalizeNumericInputValue_(call.revistas);

  // TEXTO VISITANTES
  // ANTIGO // call.visitantesTexto = visitantesTextoInput?.value?.trim?.() ?? '';

  if (isDebugConsoleEnabled()) console.log('[updateCallFromInputs]', {
    ofertaInput: ofertaInput?.value,
    ofertaFinal: call.oferta,
    visitantes: call.visitantes,
    biblias: call.biblias,
    revistas: call.revistas,
    presentes,
    bibliasMax,
  });
}

function isInactiveStudent(row, rosterMap = null) {
  return studentStatusFromRow(row, rosterMap) === 'inativo';
}

function getAllActiveRows(call) {
  const rosterMap = currentStudentsMap();
  return (call?.rows || []).filter((row) => !isInactiveStudent(row, rosterMap));
}

function getMarkedRows(call) {
  return getAllActiveRows(call).filter((row) => isSavedRow(row));
}

function getActiveRows(call) {
  return getMarkedRows(call);
}

function computeLocalStats(call) {
  const allActiveRows = getAllActiveRows(call);
  const markedRows = getMarkedRows(call);

  const total = allActiveRows.length;
  const presentes = markedRows.filter((r) => isPresentLikeValue(r.presenca)).length;
  const atrasos = markedRows.filter((r) => isDelayedValue(r.presenca)).length;
  const ausentes = markedRows.filter((r) => normalizePresenceValue(r.presenca) === 'nao').length;
  const neutros = total - markedRows.length;
  const percentual = total ? (presentes / total) * 100 : 0;

  return { total, presentes, atrasos, ausentes, neutros, percentual };
}

function bestStudentForCurrentTurma() {
  const turmaId = state.selectedTurmaId;
  const turmaStudents = state.alunos
    .filter((a) => String(a.TurmaID || '') === String(turmaId || ''))
    .filter((a) => String(a.Status || 'ativo').trim().toLowerCase() !== 'inativo')
    .filter((a) => Number(a.Percentual || 0) > 0)
    .sort((a, b) => Number(b.Percentual || 0) - Number(a.Percentual || 0) || String(a.Nome || '').localeCompare(String(b.Nome || '')));
  return turmaStudents[0] || null;
}

function getCurrentStats() {
  const call = getCurrentCall();
  if (!call) return { total: 0, presentes: 0, ausentes: 0, percentual: 0 };
  return computeLocalStats(call);
}

function renderTotalAlunosStat(call) {
  const el = els.summary.total;
  if (!el) return;

  const { total, saved, complete } = getSavedTotalLabelData(call);
  const savedClass = complete ? 'stat-total__saved--ok' : 'stat-total__saved--warn';
  el.innerHTML = `
    <span class="stat-total__value">${escapeHtml(String(total))}</span>
    <span class="stat-total__separator">/</span>
    <span class="stat-total__saved ${savedClass}">${escapeHtml(String(saved))}</span>
  `;
  el.setAttribute('aria-label', `Total de alunos: ${total}/${saved}`);
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
  const markedRows = getMarkedRows(call);
  const presentNames = markedRows.filter((r) => isPresentLikeValue(r.presenca)).map((r) => r.nome).join(', ') || 'nenhum';
  const delayedNames = markedRows.filter((r) => isDelayedValue(r.presenca)).map((r) => r.nome).join(', ') || 'nenhum';
  const absentNames = markedRows.filter((r) => normalizePresenceValue(r.presenca) === 'nao').map((r) => r.nome).join(', ') || 'nenhum';
  const neutralNames = getAllActiveRows(call).filter((r) => !isSavedRow(r)).map((r) => r.nome).join(', ') || 'nenhum';
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
    `Neutros: ${stats.neutros || 0}`,
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
    `Neutros: ${neutralNames}`,
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
    `Neutros: ${geral.neutros || 0}`,
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

  const alunoOptions = getTurmasSorted().length
    ? [
        '<option value="" selected disabled>&lt; SELECIONE &gt;</option>',
        ...getTurmasSorted().map((turma) => `<option value="${escapeHtml(turma.TurmaID)}">${escapeHtml(turma.Nome)}</option>`),
      ].join('')
    : '<option value="">Cadastre uma turma primeiro</option>';

  els.alunoTurma.innerHTML = alunoOptions;

  const exists = getTurmasSorted().some((t) => String(t.TurmaID || '') === String(state.selectedTurmaId || ''));
  if (!exists && getTurmasSorted().length) {
    state.selectedTurmaId = getTurmasSorted()[0]?.TurmaID || '';
  }

  els.turmaSelect.value = state.selectedTurmaId || '';
  els.alunoTurma.value = '';
}

function renderSummary() {
  const call = getCurrentCall();
  const turma = getCurrentTurma();
  const turmaNome = turma ? String(turma.Nome || '').trim() : '';

  if (!els.turmaMeta) return;

  els.turmaMeta.classList.remove('turma-meta--ok', 'turma-meta--warn');

  if (!call) {
    renderTotalAlunosStat(null);
    els.summary.presentes.textContent = '0';
    els.summary.ausentes.textContent = '0';
    els.summary.percentual.textContent = '0%';
    els.summary.oferta.textContent = 'R$ 0,00';
    els.summary.visitantes.textContent = '0';
    els.summary.biblias.textContent = '0';
    els.summary.revistas.textContent = '0';
    els.turmaMeta.textContent = turmaNome || 'Selecione uma turma para carregar a chamada.';
    return;
  }

  const stats = computeLocalStats(call);
  renderTotalAlunosStat(call);
  els.summary.presentes.textContent = String(stats.presentes);
  els.summary.ausentes.textContent = String(stats.ausentes);
  els.summary.percentual.textContent = formatPercent(stats.percentual);
  els.summary.oferta.textContent = formatMoney(call.oferta);
  els.summary.visitantes.textContent = String(Number(call.visitantes || 0));
  els.summary.biblias.textContent = String(Number(call.biblias || 0));
  els.summary.revistas.textContent = String(Number(call.revistas || 0));

  els.turmaMeta.textContent = turmaNome || 'Selecione uma turma para carregar a chamada.';
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
      const codeEl = fragment.querySelector('.student-code');
      const presentBtn = fragment.querySelector('[data-action="present"]');
      const absentBtn = fragment.querySelector('[data-action="absent"]');
      const delayBtn = fragment.querySelector('[data-action="delay"]');
      const editBtn = fragment.querySelector('[data-action="edit"]');
      const toggleBtn = fragment.querySelector('[data-action="toggle"]');
      const noteInput = fragment.querySelector('.student-observacao');

      if (!article || !nameEl || !badgesEl || !percentEl || !absenceEl || !runEl || !codeEl || !presentBtn || !absentBtn || !delayBtn || !editBtn || !toggleBtn || !noteInput) {
        if (isDebugConsoleEnabled()) console.warn('Template do aluno incompleto:', row);
        return;
      }

      const isInactive = String(aluno.Status || row.statusAluno || '').trim().toLowerCase() === 'inativo';
      const isFaltandoMuito = String(aluno.FaltandoMuito || '').trim().toLowerCase() === 'sim';
      const isReativado = String(aluno.Reativado || '').trim().toLowerCase() === 'sim';
      const isSaved = isSavedRow(row);
      const presence = isSaved ? normalizePresenceValue(row.presenca) : 'nao';
      const isDelayed = isSaved && presence === 'atrasado';

      article.dataset.alunoId = row.alunoId;
      article.dataset.salvo = String(row.salvo ?? 0);
      article.classList.toggle('is-inactive', isInactive);

      const statusLabel = isInactive ? 'Inativo' : 'Ativo';
      nameEl.innerHTML = `<span class="student-status ${isInactive ? 'student-status--inactive' : 'student-status--active'}">${statusLabel}</span> - ${escapeHtml(row.nome || '')}`;
      codeEl.textContent = `#${String(aluno.OrdemCadastro || row.codigo || '').trim() || '—'}`;

const isAuto = (v) => {
  if (v === true || v === 1) return true;
  const s = String(v ?? '').trim().toLowerCase();
  return s === 'sim' || s === 'true' || s === '1';
};

const isAutoAtraso =
  isAuto(row.autoAtraso) ||
  isAuto(row.AUTO_ATRASO);

const isAutoPresenca =
  isAuto(row.autoPresenca) ||
  isAuto(row.AUTO_PRESENÇA) ||
  isAuto(row.AUTO_PRESENCA);

const autoBadge = isAutoAtraso
  ? '<span class="badge-pill badge-pill--warn">Auto-Atraso</span>'
  : isAutoPresenca
    ? '<span class="badge-pill badge-pill--info">Auto-Presença</span>'
    : '';

badgesEl.innerHTML = [
  isDelayed ? '<span class="badge-pill badge-pill--warn">Atrasado(a)</span>' : '',
  isFaltandoMuito ? '<span class="badge-pill badge-pill--warn">Faltando muito</span>' : '',
  isReativado ? '<span class="badge-pill badge-pill--info">Reativado</span>' : '',
  autoBadge,
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

      presentBtn.classList.toggle('is-selected-present', isSaved && presence === 'sim');
      absentBtn.classList.toggle('is-selected-absent', isSaved && presence === 'nao');
      delayBtn.classList.toggle('is-selected-delay', isSaved && presence === 'atrasado');
      toggleBtn.textContent = isInactive ? 'Ativar' : 'Inativar';

      presentBtn.addEventListener('click', () => setStudentPresence(row.alunoId, 'sim'));
      absentBtn.addEventListener('click', () => setStudentPresence(row.alunoId, 'nao'));
      delayBtn.addEventListener('click', () => setStudentPresence(row.alunoId, 'atrasado'));
      editBtn.addEventListener('click', () => openStudentEditModal(row.alunoId));
      toggleBtn.addEventListener('click', () => toggleStudentStatus(row.alunoId));

      noteInput.value = row.observacao || '';
      noteInput.addEventListener('input', (event) => {
        row.observacao = event.target.value;
        markDirty();
      });

      container.appendChild(fragment);
    } catch (err) {
      if (isDebugConsoleEnabled()) console.error('Falha ao renderizar aluno:', row, err);
    }
  });
}

