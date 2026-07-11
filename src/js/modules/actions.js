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
      if (window.ProjectMemory) {
        window.ProjectMemory.recordFromEvent('move-student', {
          alunoNome: String(alunoId || ''),
          turmaDestino: turmaDestino.Nome,
          turmaId: turmaDestino.TurmaID,
        });
      }
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
      if (window.ProjectMemory) {
        window.ProjectMemory.recordFromEvent('toggle-student-status', {
          alunoNome: aluno.Nome,
          status: novoAtivo === 'sim' ? 'ativo' : 'inativo',
        });
      }
      await refreshFromBackend(false);
      renderAll();
    })
    .catch((err) => showError(err.message || 'Falha ao atualizar status.'));
}

function renderStudentEditTurmaOptions(selectedTurmaId = '') {
  if (!els.studentEditTurma) return;

  const options = getTurmasSorted()
    .map((turma) => `<option value="${escapeHtml(turma.TurmaID)}">${escapeHtml(turma.Nome)}</option>`)
    .join('');

  els.studentEditTurma.innerHTML = options || '<option value="">Cadastre uma turma primeiro</option>';
  if (selectedTurmaId && getTurmasSorted().some((turma) => String(turma.TurmaID || '') === String(selectedTurmaId))) {
    els.studentEditTurma.value = selectedTurmaId;
  } else {
    els.studentEditTurma.value = state.selectedTurmaId || getTurmasSorted()[0]?.TurmaID || '';
  }
}

function setStudentEditModalOpen(isOpen) {
  if (!els.studentEditModal) return;
  els.studentEditModal.classList.toggle('is-open', !!isOpen);
  els.studentEditModal.setAttribute('aria-hidden', String(!isOpen));
}

function closeStudentEditModal() {
  state.editingAlunoId = '';
  setStudentEditModalOpen(false);
}

function buildStudentEditPageUrl(alunoId) {
  const route = 'aluno/editar-aluno/';
  const params = new URLSearchParams();

  if (alunoId) {
    params.set('alunoId', String(alunoId).trim());
  }

  const accessCode = String(state.accessCode || '').trim();
  if (accessCode) {
    params.set('code', accessCode);
  }

  const query = params.toString();
  return query ? `${route}?${query}` : route;
}

function openStudentEditModal(alunoId) {
  if (isRestrictedMode()) {
    showError('Ação indisponível neste modo.');
    return;
  }

  const aluno = state.alunos.find((item) => String(item.AlunoID || '') === String(alunoId || '')) || null;
  if (!aluno) {
    showError('Aluno não encontrado para edição.');
    return;
  }

  // A rota dedicada trabalha melhor quando recebe o nome atual do aluno como chave.
  window.location.href = buildStudentEditPageUrl(aluno.Nome || aluno.AlunoID);
}

async function submitStudentEditForm(event) {
  if (isRestrictedMode()) {
    showError('Ação indisponível neste modo.');
    return;
  }

  event.preventDefault();

  const alunoId = String(state.editingAlunoId || '').trim();
  if (!alunoId) {
    showError('Selecione um aluno para edição.');
    return;
  }

  const nome = String(els.studentEditName?.value || '').trim();
  const celular = formatToBrPhone(els.studentEditCelular?.value || '');
  const turmaId = String(els.studentEditTurma?.value || '').trim();
  const status = String(els.studentEditStatus?.value || 'ativo').trim().toLowerCase();

  if (!nome) {
    showError('Informe o nome do aluno.');
    return;
  }
  if (!turmaId) {
    showError('Selecione uma turma.');
    return;
  }

  showBusy('Salvando alterações...');
  const result = await apiPost({
    action: 'updatealuno',
    alunoId,
    nome,
    celular,
    turmaId,
    status,
  });

  showSuccess(result.message || 'Aluno atualizado com sucesso.');
  if (window.ProjectMemory) {
    window.ProjectMemory.recordFromEvent('update-aluno', {
      alunoId,
      nome,
      turmaId,
      turmaNome: getTurmasSorted().find((t) => String(t.TurmaID || '') === String(turmaId || ''))?.Nome || turmaId,
      status,
    });
  }

  closeStudentEditModal();
  await refreshFromBackend(false);
  renderAll();
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
  if (window.ProjectMemory) {
    window.ProjectMemory.recordFromEvent('add-turma', {
      nome,
      ordem,
    });
  }
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
  const celular = formatToBrPhone(els.alunoCelular.value);
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
    celular,
    turmaId,
  });

  showSuccess(result.message || 'Aluno cadastrado.');
  if (window.ProjectMemory) {
    window.ProjectMemory.recordFromEvent('add-aluno', {
      nome,
      turmaId,
      turmaNome: getTurmasSorted().find((t) => String(t.TurmaID || '') === String(turmaId || ''))?.Nome || turmaId,
    });
  }
  els.alunoNome.value = '';
  els.alunoCelular.value = '';
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
    row.salvo = 0;
    row.SALVO = 0;
    row.observacao = '';
  });
  call.oferta = '';
  call.visitantes = 0;
  call.biblias = 0;
  call.revistas = 0;
  //call.visitantesTexto = '';
  state.dirty = true;
  persistDraft(call);
  if (window.ProjectMemory) {
    window.ProjectMemory.recordFromEvent('clear-call', {
      dateKey: state.dateKey,
      turmaNome: getCurrentTurma()?.Nome || '',
      turmaId: getCurrentTurma()?.TurmaID || '',
    });
  }
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
  renderResponsavelLabel();
  updateSaveButtonVisibility();
  updateActionNotice();
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
    ofertaInput.value = formatCurrencyBR(call.oferta ?? 0);
  }

  if (visitantesInput) {
    visitantesInput.value = normalizeNumericInputValue_(call.visitantes ?? 0);
  }

  if (bibliasInput) {
    bibliasInput.value = normalizeNumericInputValue_(call.biblias ?? 0);
  }

  if (revistasInput) {
    revistasInput.value = normalizeNumericInputValue_(call.revistas ?? 0);
  }

  //if (visitantesTextoInput) visitantesTextoInput.value = call.visitantesTexto || '';

  if (ofertaInput && !ofertaInput.dataset.bound) {
    ofertaInput.dataset.bound = '1';
    ofertaInput.addEventListener('input', (event) => {
      formatTensToBRL(event);

      const current = getCurrentCall();
      if (!current) return;

      current.oferta = parseCurrencyBR(event.target.value);
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

      const sanitized = syncNumericInputField(event.target, {
        max: 50,
        alertOnClamp: true,
        alertLabel: 'O número máximo permitido para visitantes',
      });

      current.visitantes = sanitized;
      updateCallFromInputs();
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

      const presentes = getCurrentPresentCount();
      const visitantes = clampWholeNumber(document.getElementById('visitantesInput')?.value ?? current.visitantes ?? 0, 50);
      const maxAllowed = presentes + visitantes;

      const sanitized = syncNumericInputField(event.target, {
        max: maxAllowed,
        alertOnClamp: true,
      });

      current.visitantes = visitantes;
      current.biblias = sanitized;
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

      const presentes = getCurrentPresentCount();
      const visitantes = clampWholeNumber(document.getElementById('visitantesInput')?.value ?? current.visitantes ?? 0, 50);
      const maxAllowed = presentes + visitantes;

      const sanitized = syncNumericInputField(event.target, {
        max: maxAllowed,
        alertOnClamp: true,
      });

      current.visitantes = visitantes;
      current.revistas = sanitized;
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

    if (window.ProjectMemory && data.memory) {
      try {
        window.ProjectMemory.ingestSeed(data.memory);
      } catch (memErr) {
        console.warn('Falha ao consolidar memória do projeto:', memErr);
      }
    }

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



