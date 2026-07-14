(function () {
  const params = new URLSearchParams(window.location.search);
  const alunoKey = String(params.get('alunoId') || '').trim();
  const session = typeof loadAccessSession === 'function'
    ? loadAccessSession()
    : (typeof getStoredAccessSession === 'function' ? getStoredAccessSession() : null);
  const accessCode = String(
    session?.legacyAccessCode ||
    session?.accessCode ||
    params.get('code') ||
    state.accessCode ||
    ''
  ).trim();

  state.session = session || state.session || null;
  state.accessCode = accessCode;
  state.accessMode = String(session?.accessMode || resolveAccessMode(session || accessCode)).trim().toLowerCase();
  if (typeof applyAccessMode === 'function') applyAccessMode();
  if (typeof renderResponsavelLabel === 'function') renderResponsavelLabel();
  syncDebugConsoleVisibility();

  const els = {
    title: document.getElementById('studentEditTitle'),
    codeValue: document.getElementById('studentEditCodeValue'),
    form: document.getElementById('studentEditForm'),
    loading: document.getElementById('studentEditLoading'),
    name: document.getElementById('studentEditName'),
    celular: document.getElementById('studentEditCelular'),
    turma: document.getElementById('studentEditTurma'),
    status: document.getElementById('studentEditStatus'),
    back: document.getElementById('studentEditBack'),
    deleteBtn: document.getElementById('studentEditDelete'),
    cancel: document.getElementById('studentEditCancel'),
    feedback: document.getElementById('feedback'),
  };

  let turmas = [];
  let alunoAtual = null;
  let alunoOriginalKey = alunoKey;

  function resolveAccessMode(code) {
    const normalized = String(code || '').trim().toLowerCase();
    if (!normalized) return 'self';
    if (ACCESS_CODES?.full?.has(normalized)) return 'full';
    if (ACCESS_CODES?.restricted?.has(normalized)) return 'restricted';
    return 'restricted';
  }

  function buildBackUrl() {
    return '../../index.html';
  }

  function applyBackUrl() {
    const backUrl = buildBackUrl();
    if (els.back) els.back.href = backUrl;
    if (els.cancel) els.cancel.href = backUrl;
  }

  function formatCellPhoneInput(event) {
    const input = event?.target;
    if (!input) return;
    input.value = formatToBrPhone(input.value);
  }

  function setFeedback(type, message) {
    if (!els.feedback) return;
    const text = String(message || '');
    els.feedback.className = `feedback show ${type}`;
    els.feedback.textContent = text;

    if (type === 'error' && text) {
      const debugText = /^\[(BACKEND|FRONTEND)\]/i.test(text) ? text : `[FRONTEND] ${text}`;
      appendDebugConsoleLine(debugText);
      if (isDebugConsoleEnabled()) {
        console.log(debugText);
      }
    }
  }

  function setLoadingVisible(isVisible) {
    if (els.loading) {
      els.loading.classList.toggle('hidden', !isVisible);
    }
    if (els.form) {
      els.form.classList.toggle('hidden', isVisible);
    }
  }

  function renderTurmaOptions(selectedTurmaId = '') {
    if (!els.turma) return;

    els.turma.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = turmas.length ? 'Selecione uma turma' : 'Cadastre uma turma primeiro';
    els.turma.appendChild(placeholder);

    (turmas || []).forEach((turma) => {
      const option = document.createElement('option');
      option.value = String(turma.TurmaID || '');
      option.textContent = String(turma.Nome || '');
      els.turma.appendChild(option);
    });

    els.turma.value = selectedTurmaId || '';
  }

  function populateForm(aluno, data) {
    const turma = (turmas || []).find((item) => String(item.TurmaID || '') === String(aluno.TurmaID || '')) || null;
    const turmaNome = turma?.Nome || aluno.TurmaNome || aluno.CLASSE || '—';
    const codeValue = String(aluno.OrdemCadastro || aluno.codigo || '—').trim() || '—';

    if (els.title) {
      els.title.textContent = `Editar ${aluno.Nome || 'aluno'}`;
    }
    if (els.codeValue) {
      els.codeValue.textContent = codeValue;
    }

    if (els.name) {
      els.name.value = aluno.Nome || '';
    }
    if (els.celular) {
      els.celular.value = formatToBrPhone(aluno.CELULAR || '');
    }
    if (els.status) {
      els.status.value = String(aluno.Status || 'ativo').trim().toLowerCase() === 'inativo' ? 'inativo' : 'ativo';
      els.status.disabled = true;
      els.status.title = 'Campo temporariamente bloqueado';
    }

    renderTurmaOptions(aluno.TurmaID);

    applyBackUrl();

    if (els.deleteBtn) {
      els.deleteBtn.disabled = false;
      els.deleteBtn.title = '';
    }

    setLoadingVisible(false);
    if (els.name) {
      requestAnimationFrame(() => els.name?.focus?.());
    }

    if (window.ProjectMemory && data?.memory) {
      try {
        window.ProjectMemory.ingestSeed(data.memory);
      } catch (err) {
        if (isDebugConsoleEnabled()) console.warn('Falha ao consolidar memória no editor de aluno:', err);
      }
    }
  }

  async function loadAluno() {
    if (!alunoKey) {
      setFeedback('error', 'Informe o alunoId na URL para abrir a edição.');
      if (els.loading) {
        els.loading.textContent = 'Aluno não informado na URL.';
      }
      setLoadingVisible(true);
      return;
    }

    const mode = resolveAccessMode(accessCode);
    if (mode === 'self') {
      setFeedback('warning', 'Abra esta página a partir da lista de alunos para manter o acesso correto.');
    }

    showLoading('Carregando aluno...', 25000);

    try {
      const data = await apiGet({ action: 'init', date: todayKey() });
      turmas = Array.isArray(data.turmas) ? data.turmas : [];
      const alunos = Array.isArray(data.alunos) ? data.alunos : [];
      const found = alunos.find((item) => String(item.AlunoID || '') === String(alunoKey) || String(item.Nome || '') === String(alunoKey));

      if (!found) {
        throw new Error('Aluno não encontrado no Cadastro.');
      }

      alunoAtual = found;
      alunoOriginalKey = alunoKey || found.Nome || found.AlunoID;
      populateForm(found, data);
      if (els.feedback) {
        els.feedback.className = 'feedback';
        els.feedback.textContent = '';
      }
    } catch (err) {
      const errorText = formatAppError(err, 'Carregar aluno');
      if (els.loading) {
        els.loading.textContent = errorText;
      }
      setFeedback('error', errorText);
      setLoadingVisible(true);
    } finally {
      hideLoading();
    }
  }

  async function submitForm(event) {
    event.preventDefault();

    if (!alunoAtual) {
      setFeedback('error', 'Carregue um aluno antes de salvar.');
      return;
    }

    const nome = String(els.name?.value || '').trim();
    const celular = formatToBrPhone(els.celular?.value || '');
    const turmaId = String(els.turma?.value || alunoAtual.TurmaID || '').trim();
    const status = String(els.status?.value || alunoAtual.Status || 'ativo').trim().toLowerCase();

    if (!nome) {
      setFeedback('error', 'Informe o nome do aluno.');
      return;
    }

    if (!turmaId) {
      setFeedback('error', 'Selecione uma turma.');
      return;
    }

    showLoading('Salvando...', 25000);
    setFeedback('info', 'Salvando...');

    try {
      const result = await apiPost({
        action: 'updatealuno',
        alunoId: alunoOriginalKey || alunoKey || alunoAtual.Nome || alunoAtual.AlunoID,
        nome,
        celular,
        turmaId,
        status,
      });

      showSuccess(result.message || 'Aluno atualizado com sucesso.');

      if (window.ProjectMemory) {
        window.ProjectMemory.recordFromEvent('update-aluno-page', {
          alunoId: alunoOriginalKey || alunoKey || alunoAtual.Nome || alunoAtual.AlunoID,
          nome,
          turmaId,
          status,
        });
      }

      const backUrl = buildBackUrl();
      setTimeout(() => {
        window.location.href = backUrl;
      }, 900);
    } catch (err) {
      const errorText = formatAppError(err, 'Salvar aluno');
      showError(errorText);
      setFeedback('error', errorText);
    } finally {
      hideLoading();
    }
  }

  async function deleteAluno() {
    if (!alunoAtual) {
      setFeedback('error', 'Carregue um aluno antes de excluir.');
      return;
    }

    const confirmed = window.confirm('Excluir este aluno? Esta ação não pode ser desfeita.');
    if (!confirmed) return;

    showLoading('Excluindo...', 25000);

    try {
      const result = await apiPost({
        action: 'deletealuno',
        alunoId: alunoOriginalKey || alunoKey || alunoAtual.Nome || alunoAtual.AlunoID,
        nome: alunoAtual.Nome || '',
      });

      showSuccess(result.message || 'Aluno excluído com sucesso.');

      const backUrl = buildBackUrl();
      setTimeout(() => {
        window.location.href = backUrl;
      }, 900);
    } catch (err) {
      const errorText = formatAppError(err, 'Excluir aluno');
      showError(errorText);
      setFeedback('error', errorText);
    } finally {
      hideLoading();
    }
  }

  applyBackUrl();

  if (els.celular) {
    els.celular.addEventListener('input', formatCellPhoneInput);
    els.celular.addEventListener('blur', formatCellPhoneInput);
  }

  if (els.deleteBtn) {
    els.deleteBtn.addEventListener('click', () => {
      deleteAluno().catch((err) => showError(formatAppError(err, 'Excluir aluno')));
    });
  }

  if (els.form) {
    els.form.addEventListener('submit', (event) => {
      submitForm(event).catch((err) => showError(formatAppError(err, 'Salvar aluno')));
    });
  }

  loadAluno().catch((err) => {
    setFeedback('error', err.message || 'Falha ao carregar aluno.');
    showError(formatAppError(err, 'Carregar aluno'));
  });
})();
