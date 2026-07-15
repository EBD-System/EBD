(function () {
  const params = new URLSearchParams(window.location.search);
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
    back: document.getElementById('addAlunoBackBtn'),
    cancel: document.getElementById('studentAddCancel'),
    form: document.getElementById('studentAddForm'),
    loading: document.getElementById('studentAddLoading'),
    name: document.getElementById('studentAddName'),
    celular: document.getElementById('studentAddCelular'),
    nascimento: document.getElementById('studentAddNascimento'),
    turma: document.getElementById('studentAddTurma'),
    feedback: document.getElementById('feedback'),
    submit: document.querySelector('#studentAddForm button[type="submit"]'),
  };

  let turmas = [];

  function buildBackUrl() {
    return '../../index.html';
  }

  function applyReturnUrl() {
    const returnUrl = buildBackUrl();
    if (els.back) els.back.setAttribute('href', returnUrl);
    if (els.cancel) els.cancel.setAttribute('href', returnUrl);
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
    if (els.loading) els.loading.classList.toggle('hidden', !isVisible);
    if (els.form) els.form.classList.toggle('hidden', isVisible);
  }

  function renderTurmaOptions(selectedTurmaId = '') {
    if (!els.turma) return;

    els.turma.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = turmas.length ? '< SELECIONE >' : 'Cadastre uma turma primeiro';
    placeholder.disabled = true;
    placeholder.selected = true;
    placeholder.hidden = false;
    els.turma.appendChild(placeholder);

    (turmas || []).forEach((turma) => {
      const option = document.createElement('option');
      option.value = String(turma.TurmaID || '');
      option.textContent = String(turma.Nome || '');
      els.turma.appendChild(option);
    });

    if (turmas.length) {
      const fallback = selectedTurmaId && turmas.some((turma) => String(turma.TurmaID || '') === String(selectedTurmaId || ''))
        ? selectedTurmaId
        : '';
      els.turma.value = fallback;
      els.turma.disabled = false;
      if (els.submit) els.submit.disabled = false;
    } else {
      els.turma.value = '';
      els.turma.disabled = true;
      if (els.submit) els.submit.disabled = true;
    }
  }

  async function loadData() {
    showLoading('Carregando turmas...', 25000);
    setLoadingVisible(true);

    try {
      const data = await apiGet({ action: 'init', date: todayKey() });
      turmas = normalizeTurmasList(data);
      if (!turmas.length && Array.isArray(data.turmas)) turmas = data.turmas.map((row, index) => normalizeTurmaRow(row, index)).filter(Boolean);
      if (!turmas.length && Array.isArray(data.classes)) turmas = data.classes.map((row, index) => normalizeTurmaRow(row, index)).filter(Boolean);
      if (!turmas.length && Array.isArray(data.data)) turmas = data.data.map((row, index) => normalizeTurmaRow(row, index)).filter(Boolean);
      renderTurmaOptions('');

      if (window.ProjectMemory && data?.memory) {
        try {
          window.ProjectMemory.ingestSeed(data.memory);
        } catch (err) {
          if (isDebugConsoleEnabled()) console.warn('Falha ao consolidar memória no cadastro de aluno:', err);
        }
      }

      if (!turmas.length) {
        setFeedback('warning', 'Nenhuma turma cadastrada. Crie uma turma antes de adicionar alunos.');
      } else if (els.feedback) {
        els.feedback.className = 'feedback';
        els.feedback.textContent = '';
      }
    } catch (err) {
      const errorText = formatAppError(err, 'Carregar turmas');
      if (els.loading) {
        els.loading.textContent = errorText;
      }
      setFeedback('error', errorText);
    } finally {
      hideLoading();
      setLoadingVisible(false);
    }
  }

  async function submitForm(event) {
    event.preventDefault();

    const nome = String(els.name?.value || '').trim();
    const celular = formatToBrPhone(els.celular?.value || '');
    const dataNascimento = String(els.nascimento?.value || '').trim();
    const turmaId = String(els.turma?.value || '').trim();

    if (!nome) {
      setFeedback('error', 'Informe o nome do aluno.');
      return;
    }
    if (!turmaId) {
      setFeedback('error', 'Selecione uma turma.');
      return;
    }

    showLoading('Adicionando aluno...', 25000);
    setFeedback('info', 'Salvando...');

    try {
      const result = await apiPost({
        action: 'addaluno',
        nome,
        celular,
        turmaId,
        dataNascimento,
      });

      showSuccess(result.message || 'Aluno cadastrado com sucesso.');
      if (window.ProjectMemory) {
        window.ProjectMemory.recordFromEvent('add-aluno', {
          nome,
          turmaId,
          turmaNome: (turmas || []).find((t) => String(t.TurmaID || '') === String(turmaId || ''))?.Nome || turmaId,
          dataNascimento,
        });
      }

      if (els.name) els.name.value = '';
      if (els.celular) els.celular.value = '';
      if (els.nascimento) els.nascimento.value = '';
      if (els.turma) {
        els.turma.value = '';
      }
      if (els.name) els.name.focus();
    } catch (err) {
      const errorText = formatAppError(err, 'Cadastrar aluno');
      showError(errorText);
      setFeedback('error', errorText);
    } finally {
      hideLoading();
    }
  }

  applyReturnUrl();

  if (els.celular) {
    els.celular.addEventListener('input', formatCellPhoneInput);
    els.celular.addEventListener('blur', formatCellPhoneInput);
  }

  if (els.form) {
    els.form.addEventListener('submit', submitForm);
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadData().catch((err) => {
      const errorText = formatAppError(err, 'Carregar página');
      setFeedback('error', errorText);
    });
  });
})();
