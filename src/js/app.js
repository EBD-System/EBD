function validateApiUrl() {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes('COLE_AQUI')) {
    showError('Cole a URL do Web App do Apps Script em APPS_SCRIPT_URL.');
    return false;
  }
  return true;
}

function normalizeCelularInput(event) {
  const input = event?.target;
  if (!input) return;

  const rawValue = String(input.value || '');
  const caret = typeof input.selectionStart === 'number' ? input.selectionStart : rawValue.length;
  const digitsBeforeCaret = getDigitsBeforeCaret_(rawValue, caret);
  const formatted = formatToBrPhone(rawValue);

  input.value = formatted;

  const nextCaret = caretFromDigitIndex_(formatted, digitsBeforeCaret);
  requestAnimationFrame(() => {
    try {
      input.setSelectionRange(nextCaret, nextCaret);
    } catch (err) {
      // Ignore selection errors on mobile/browser edge cases.
    }
  });
}

async function bootstrap() {
  ensureLoadingOverlay();

  try {
    state.accessCode = getAccessCodeFromUrl();
    state.accessMode = resolveAccessMode(state.accessCode);
    applyAccessMode();

    state.dateKey = todayKey();
    els.dateInput.value = state.dateKey;
    els.showInactive.checked = true;
    els.searchInput.value = '';

    const storage = storageState();
    state.selectedTurmaId = storage.selectedTurmaId || '';
    if (storage.selectedDateKey) {
      delete storage.selectedDateKey;
      saveStorageState(storage);
    }

    if (isSelfAccessMode()) {
      renderSelfAccessGate();
      state.initialized = true;
      return;
    }

    showLoading('Carregando dados...');

    if (!validateApiUrl()) return;

    await refreshFromBackend(false);

    if (!state.selectedTurmaId) {
      state.selectedTurmaId = state.turmas[0]?.TurmaID || '';
    }

    renderAll();

    if (window.ProjectMemory) {
      window.ProjectMemory.recordFromEvent('bootstrap', {
        dateKey: state.dateKey,
        turmas: state.turmas.length,
        alunos: state.alunos.length,
        currentTurma: getCurrentTurma()?.Nome || '—',
        counts: getCurrentCall()
          ? {
              presentes: computeLocalStats(getCurrentCall()).presentes,
              ausentes: computeLocalStats(getCurrentCall()).ausentes,
              atrasos: computeLocalStats(getCurrentCall()).atrasos,
            }
          : {},
      });
    }

    state.initialized = true;
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
  updateSaveButtonVisibility();
  updateActionNotice();
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
els.registrationAddTabBtn?.addEventListener('click', () => setRegistrationTab('add'));
els.registrationManageTabBtn?.addEventListener('click', () => setRegistrationTab('manage'));

els.alunoForm.addEventListener('submit', (event) => {
  event.preventDefault();
  addAluno(event).catch((err) => showError(err.message || 'Falha ao cadastrar aluno.'));
});

els.alunoEditForm?.addEventListener('submit', (event) => {
  saveStudentEdit(event).catch((err) => showError(err.message || 'Falha ao salvar edição do aluno.'));
});
els.alunoManualEditBtn?.addEventListener('click', () => {
  manualEditStudentOnWhatsApp();
});
els.alunoDeleteBtn?.addEventListener('click', () => {
  deleteSelectedStudent().catch((err) => showError(err.message || 'Falha ao excluir aluno.'));
});
els.alunoEditCancelBtn?.addEventListener('click', () => {
  clearStudentEditor();
  setRegistrationTab('add');
});
els.alunoEditNome?.addEventListener('input', updateEditorPreview);
els.alunoEditComplemento?.addEventListener('input', updateEditorPreview);
els.alunoEditNumero?.addEventListener('input', updateEditorPreview);
els.alunoCelular.addEventListener('input', normalizeCelularInput);
els.alunoCelular.addEventListener('blur', normalizeCelularInput);

document.addEventListener('DOMContentLoaded', bootstrap);
