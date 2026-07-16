function validateApiUrl() {
  if (!BACKEND_API_URL || String(BACKEND_API_URL).includes('COLE_AQUI')) {
    showError('Configure a URL da API do backend em BACKEND_API_URL.');
    return false;
  }
  return true;
}

function buildAddAlunoPageUrl() {
  return typeof buildRoutePath === 'function' ? buildRoutePath('/aluno/adicionar-aluno/') : 'aluno/adicionar-aluno/';
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
    syncDebugConsoleVisibility();

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

    if (els.addAlunoPageBtn) {
      els.addAlunoPageBtn.setAttribute('href', buildAddAlunoPageUrl());
    }

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
    showError(formatAppError(err, 'Salvar chamada'));
  }
});
els.sendTurmaBtn.addEventListener('click', async () => {
  try {
    await sendReport('turma');
  } catch (err) {
    showError(formatAppError(err, 'Relatório da turma'));
  }
});
els.sendGeralBtn.addEventListener('click', async () => {
  try {
    await sendReport('geral');
  } catch (err) {
    showError(formatAppError(err, 'Relatório geral'));
  }
});
els.saveNextBtn.addEventListener('click', async () => {
  try {
    await saveAndAdvance();
  } catch (err) {
    showError(formatAppError(err, 'Salvar e avançar'));
  }
});

if (els.studentEditForm) {
  els.studentEditForm.addEventListener('submit', (event) => {
    submitStudentEditForm(event).catch((err) => showError(formatAppError(err, 'Atualizar aluno')));
  });
}

if (els.studentEditModal) {
  els.studentEditModal.addEventListener('click', (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.dataset.action === 'close') {
      closeStudentEditModal();
    }
  });
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && els.studentEditModal?.classList.contains('is-open')) {
    closeStudentEditModal();
  }
});
els.markAllPresentBtn.addEventListener('click', () => setAllPresence('sim'));
els.markAllAbsentBtn.addEventListener('click', () => setAllPresence('nao'));
els.copyTurmaBtn.addEventListener('click', () => copyText(buildTurmaReportText()));
els.copyGeralBtn.addEventListener('click', () => copyText(buildGeneralReportText()));
if (els.addAlunoPageBtn) {
  els.addAlunoPageBtn.addEventListener('click', () => {
    window.location.href = buildAddAlunoPageUrl();
  });
}
els.turmaForm.addEventListener('submit', (event) => {
  event.preventDefault();
  addTurma(event).catch((err) => showError(formatAppError(err, 'Cadastrar turma')));
});
els.alunoForm.addEventListener('submit', (event) => {
  event.preventDefault();
  addAluno(event).catch((err) => showError(formatAppError(err, 'Cadastrar aluno')));
});

els.alunoCelular.addEventListener('input', normalizeCelularInput);
els.alunoCelular.addEventListener('blur', normalizeCelularInput);

document.addEventListener('DOMContentLoaded', () => {
  if (window.AppRouter && typeof window.AppRouter.start === 'function') {
    window.AppRouter.start();
    return;
  }
  bootstrap();
});
