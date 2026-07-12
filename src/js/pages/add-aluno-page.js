(function () {
  const params = new URLSearchParams(window.location.search);
  const accessCode = String(params.get('code') || '').trim();

  const els = {
    title: document.getElementById('studentAddTitle'),
    subtitle: document.getElementById('studentAddSubtitle'),
    turmaCount: document.getElementById('studentAddTurmaCount'),
    back: document.getElementById('addAlunoBackBtn'),
    form: document.getElementById('studentAddForm'),
    loading: document.getElementById('studentAddLoading'),
    name: document.getElementById('studentAddName'),
    celular: document.getElementById('studentAddCelular'),
    nascimento: document.getElementById('studentAddNascimento'),
    turma: document.getElementById('studentAddTurma'),
    feedback: document.getElementById('feedback'),
  };

  let turmas = [];

  function buildBackUrl() {
    const backParams = new URLSearchParams();
    if (accessCode) backParams.set('code', accessCode);
    const query = backParams.toString();
    return query ? `../../index.html?${query}` : '../../index.html';
  }

  function setFeedback(type, message) {
    if (!els.feedback) return;
    els.feedback.className = `feedback show ${type}`;
    els.feedback.textContent = message;
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

  function syncHero() {
    if (els.turmaCount) {
      els.turmaCount.textContent = String(turmas.length || 0);
    }
    if (els.subtitle) {
      els.subtitle.textContent = turmas.length
        ? 'Cadastre um novo aluno com celular e data de nascimento opcionais.'
        : 'Cadastre uma turma primeiro para liberar o cadastro de alunos.';
    }
  }

  async function loadData() {
    showLoading('Carregando turmas...', 25000);
    setLoadingVisible(true);

    try {
      const data = await apiGet({ action: 'init', date: todayKey() });
      turmas = Array.isArray(data.turmas) ? data.turmas : [];
      renderTurmaOptions(turmas[0]?.TurmaID || '');
      syncHero();

      if (window.ProjectMemory && data?.memory) {
        try {
          window.ProjectMemory.ingestSeed(data.memory);
        } catch (err) {
          console.warn('Falha ao consolidar memória no cadastro de aluno:', err);
        }
      }

      if (!turmas.length) {
        setFeedback('warning', 'Nenhuma turma cadastrada. Crie uma turma antes de adicionar alunos.');
      } else {
        setFeedback('info', 'Preencha os dados do aluno e confirme o cadastro.');
      }
    } catch (err) {
      if (els.loading) {
        els.loading.textContent = err.message || 'Não foi possível carregar as turmas.';
      }
      setFeedback('error', err.message || 'Não foi possível carregar as turmas.');
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

      els.name.value = '';
      els.celular.value = '';
      els.nascimento.value = '';
      if (els.name) els.name.focus();
    } catch (err) {
      showError(err.message || 'Falha ao cadastrar aluno.');
      setFeedback('error', err.message || 'Falha ao cadastrar aluno.');
    } finally {
      hideLoading();
    }
  }

  if (els.back) {
    els.back.setAttribute('href', buildBackUrl());
  }

  if (els.form) {
    els.form.addEventListener('submit', submitForm);
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadData().catch((err) => setFeedback('error', err.message || 'Falha ao carregar a página.'));
  });
})();
