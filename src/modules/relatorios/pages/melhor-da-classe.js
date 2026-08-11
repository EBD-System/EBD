(function initMelhorDaClassePage(root) {
  const globalObject = root || (typeof globalThis !== 'undefined' ? globalThis : {});
  const STORAGE_KEYS = globalObject.APP_STORAGE_KEYS;
  const AUTH_STORAGE = globalObject.APP_AUTH_STORAGE;
  const APP_ACCESS_DENIED_DIALOG = window.APP_ACCESS_DENIED_DIALOG;
const APP_API_CLIENT = globalObject.APP_API_CLIENT;
  const APP_REPORTS_SERVICE = globalObject.APP_REPORTS_SERVICE;
  const APP_CONFIG = globalObject.APP_CONFIG || {};

  const API_BASE_URL =
    typeof APP_CONFIG.resolveApiBaseUrl === 'function'
      ? APP_CONFIG.resolveApiBaseUrl()
      : `${globalObject.location?.protocol || 'http:'}//${globalObject.location?.hostname || 'localhost'}${globalObject.location?.port ? `:${globalObject.location.port}` : ''}/api/v1`;

  const classSelect = document.getElementById('classSelect');
  const startDateInput = document.getElementById('startDate');
  const endDateInput = document.getElementById('endDate');
  const searchButton = document.getElementById('searchButton');
  const studentsBody = document.getElementById('studentsBody');
  const emptyState = document.getElementById('emptyState');
  const tableWrap = document.getElementById('tableWrap');
  const loadedCount = document.getElementById('loadedCount');
  const studentsCount = document.getElementById('studentsCount');
  const classDescription = document.getElementById('classDescription');
  const emptyTitle = document.getElementById('emptyTitle');
  const emptyMessage = document.getElementById('emptyMessage');
  const summaryStrip = document.getElementById('summaryStrip');
  const periodRange = document.getElementById('periodRange');
  const summaryStudentsCount = document.getElementById('summaryStudentsCount');
  const summaryClassLabel = document.getElementById('summaryClassLabel');

  const state = {
    token: '',
    loadingClasses: false,
    loadingRanking: false,
    classes: [],
    selectedClassId: '',
    lastReport: null
  };

  const session = readSession();
  if (!session.token) {
    goToLogin();
  } else {
    state.token = session.token;
    setDefaultDates();
    wirePage();
    void loadClasses();
  }

  function readSession() {
    try {
      return {
        token: AUTH_STORAGE.readToken(STORAGE_KEYS.token)
      };
    } catch {
      return { token: '' };
    }
  }

  function wirePage() {
    if (classSelect) {
      classSelect.addEventListener('change', (event) => {
        state.selectedClassId = String(event.target.value || '').trim();
        summaryClassLabel.textContent = getSelectedClassName(state.selectedClassId) || '< SELECIONE >';
        if (!state.selectedClassId) {
          renderEmpty(
            'Nenhuma turma selecionada',
            'Escolha uma turma para consultar o ranking.'
          );
          setStatus('Selecione uma turma e informe o período para continuar.', 'info');
        }
      });
    }

    searchButton?.addEventListener('click', () => void loadRanking());

    setStatus('Carregando turmas...', 'info');
    renderEmpty(
      'Informe um período e uma turma',
      'Escolha as duas datas, selecione a turma e clique em Buscar.'
    );
  }

  async function loadClasses() {
    if (state.loadingClasses) {
      return;
    }

    state.loadingClasses = true;

    try {
      const response = await fetch(`${API_BASE_URL}/classes`, {
        headers: {
          Authorization: `Bearer ${state.token}`
        }
      });

      const payload = await APP_API_CLIENT.safeJson(response);

      if (!response.ok || APP_API_CLIENT.isFailurePayload?.(payload) || payload?.ok === false) {
        throw APP_API_CLIENT.createApiError(response, payload, {
          fallbackMessage: 'Não foi possível carregar as turmas.'
        });
      }

      const classes = normalizeClasses(payload);
      state.classes = classes;
      renderClassOptions(classes);

      if (!classes.length) {
        setStatus('Nenhuma turma disponível.', 'warning');
        renderEmpty(
          'Nenhuma turma disponível',
          'Não foi possível carregar as turmas.'
        );
        return;
      }

      loadedCount.textContent = `${classes.length} turmas carregadas`;
      setStatus('Turmas carregadas. Selecione uma para ver o ranking.', 'success');
      renderEmpty(
        'Nenhuma turma selecionada',
        'Selecione uma turma para ver o ranking.'
      );
    } catch (error) {
      if (Number(error?.status) === 403) {
        openAccessDeniedDialog(error);
        renderEmpty(
          'Usuário sem permissão',
          'Seu perfil atual não tem acesso para carregar turmas ou rankings fora do financeiro.'
        );
        return;
      }

      if (error?.requiresRelogin) {
        setStatus(error.message, 'warning');
        renderEmpty(
          'Sessão expirada',
          'Sua sessão expirou. Faça login novamente para consultar o ranking.'
        );
        window.setTimeout(goToLogin, 350);
        return;
      }

      setStatus(error?.message || 'Falha ao carregar as turmas.', 'warning');
      renderEmpty(
        'Falha ao carregar turmas',
        error?.message || 'Não foi possível carregar as turmas.'
      );
    } finally {
      state.loadingClasses = false;
    }
  }

  async function loadRanking() {
    if (state.loadingRanking) {
      return;
    }

    const classId = state.selectedClassId || String(classSelect?.value || '').trim();
    const startDate = String(startDateInput?.value || '').trim();
    const endDate = String(endDateInput?.value || '').trim();

    if (!classId) {
      setStatus('Selecione uma turma para continuar.', 'warning');
      renderEmpty(
        'Nenhuma turma selecionada',
        'Selecione uma turma antes de buscar o ranking.'
      );
      return;
    }

    if (!isIsoDate(startDate) || !isIsoDate(endDate)) {
      setStatus('Preencha uma data inicial e uma data final válidas.', 'warning');
      renderEmpty(
        'Informe um período para continuar',
        'Escolha uma data inicial, uma data final e clique em Buscar.'
      );
      return;
    }

    if (startDate > endDate) {
      setStatus('A data inicial não pode ser maior que a data final.', 'warning');
      renderEmpty(
        'Período inválido',
        'A data inicial precisa ser anterior ou igual à data final.'
      );
      return;
    }

    state.loadingRanking = true;
    if (searchButton) searchButton.disabled = true;
    setStatus('Consultando o ranking da turma selecionada...', 'info');
    renderEmpty(
      'Consultando ranking',
      'Aguarde enquanto calculamos o ranking no período informado.'
    );

    try {
      const result = await APP_REPORTS_SERVICE.fetchClassStudentsRanking({
        classId,
        startDate,
        endDate,
        token: state.token
      });

      if (!result?.found) {
        state.lastReport = null;
        setStatus(result?.reason || 'Nenhum aluno encontrado na turma selecionada para o período informado.', 'warning');
        renderEmpty(
          'Sem dados para exibir',
          result?.reason || 'Não foi possível encontrar alunos para esta turma no período informado.'
        );
        return;
      }

      state.lastReport = result;
      renderRanking(result.ranking || [], result.classLabel || getSelectedClassName(classId), result.periodo || { startDate, endDate });
      setStatus('Ranking carregado com sucesso.', 'success');
    } catch (error) {
      if (Number(error?.status) === 403) {
        openAccessDeniedDialog(error);
        renderEmpty(
          'Usuário sem permissão',
          'Seu perfil atual não tem acesso para consultar este relatório.'
        );
        return;
      }

      if (error?.requiresRelogin) {
        setStatus(error.message, 'warning');
        renderEmpty(
          'Sessão expirada',
          'Sua sessão expirou. Faça login novamente para consultar o ranking.'
        );
        window.setTimeout(goToLogin, 350);
        return;
      }

      setStatus(error?.message || 'Falha ao consultar o ranking da turma.', 'warning');
      renderEmpty(
        'Falha na consulta',
        error?.message || 'Não foi possível carregar o ranking desta turma.'
      );
    } finally {
      state.loadingRanking = false;
      if (searchButton) searchButton.disabled = false;
    }
  }


  function renderClassOptions(classes) {
    if (!classSelect) {
      return;
    }

    classSelect.innerHTML = '<option value="" selected>&lt; SELECIONE &gt;</option>';

    classes.forEach((item) => {
      const option = document.createElement('option');
      option.value = String(item.id || '');
      option.textContent = item.name || 'Turma sem nome';
      classSelect.appendChild(option);
    });
  }

  function renderRanking(rows, classLabel, period) {
    const normalizedRows = Array.isArray(rows) ? rows : [];

    if (!normalizedRows.length) {
      renderEmpty(
        'Sem alunos para exibir',
        'Nenhum aluno foi encontrado para o ranking desta turma no período informado.'
      );
      return;
    }

    studentsBody.innerHTML = normalizedRows
      .map((row) => {
        const position = row.position || row.posicao || 0;
        const nome = escapeHtml(row.nome || row.name || 'Aluno sem nome');
        const percentual = escapeHtml(row.percentual_presenca || row.percentualPresenca || '—');

        return `
          <tr>
            <td>${position ? `${position}. ` : ''}${nome}</td>
            <td>${percentual}</td>
          </tr>
        `;
      })
      .join('');

    tableWrap.hidden = false;
    emptyState.hidden = true;
    if (summaryStrip) summaryStrip.hidden = false;
    studentsCount.textContent = `${normalizedRows.length} aluno${normalizedRows.length === 1 ? '' : 's'} exibido${normalizedRows.length === 1 ? '' : 's'}`;
    summaryStudentsCount.textContent = String(normalizedRows.length);
    summaryClassLabel.textContent = classLabel || '< SELECIONE >';
    classDescription.textContent = classLabel
      ? `Ranking de presença da turma ${classLabel} no período selecionado.`
      : 'Ranking de presença da turma selecionada no período.';
    periodRange.textContent = `${formatDate(period?.startDate)} até ${formatDate(period?.endDate)}`;
  }

  function isIsoDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
  }

  function formatDate(value) {
    if (!value) return '';
    const [year, month, day] = String(value).split('-');
    if (!year || !month || !day) return String(value);
    return `${day}/${month}/${year}`;
  }

  function toInputDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function setDefaultDates() {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - 7);
    if (startDateInput) startDateInput.value = toInputDate(start);
    if (endDateInput) endDateInput.value = toInputDate(today);
  }


  function normalizeClasses(payload) {
    const source = payload?.data ?? payload;
    const candidates = Array.isArray(source?.classes)
      ? source.classes
      : Array.isArray(source?.items)
        ? source.items
        : Array.isArray(source?.itens)
          ? source.itens
          : Array.isArray(source)
            ? source
            : [];

    return candidates
      .map((item) => ({
        id: item?.id_classe ?? item?.id ?? item?.classId ?? item?.class_id,
        name: String(item?.nome ?? item?.name ?? item?.classe ?? item?.class_label ?? '').trim()
      }))
      .filter((item) => item.id !== undefined && item.id !== null && item.name);
  }

  function getSelectedClassName(classId) {
    const normalizedId = String(classId || '').trim();
    if (!normalizedId) return '';
    const selected = state.classes.find((item) => String(item.id) === normalizedId);
    return selected?.name || '';
  }

  function renderEmpty(title, message) {
    studentsBody.innerHTML = '';
    tableWrap.hidden = true;
    emptyState.hidden = false;
    if (summaryStrip) summaryStrip.hidden = true;
    if (emptyTitle) emptyTitle.textContent = title;
    if (emptyMessage) emptyMessage.textContent = message;
    studentsCount.textContent = '0 alunos exibidos';
  }

  function setStatus(message, tone = 'info') {
    const toneMessages = {
      info: message,
      success: message,
      warning: message,
      danger: message
    };
    const resolvedMessage = toneMessages[tone] || message;
    if (emptyTitle && emptyState && !emptyState.hidden && resolvedMessage) {
      // Preserve the state title while keeping status feedback in the same card.
      emptyState.dataset.tone = tone;
    }
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function openAccessDeniedDialog(error) {
  const message = String(error?.backendMessage || error?.primaryMessage || error?.message || 'Usuário sem permissão').trim() || 'Usuário sem permissão';

  if (APP_ACCESS_DENIED_DIALOG?.open) {
    APP_ACCESS_DENIED_DIALOG.open({
      title: 'Usuário sem permissão',
      message,
      backHref: '../pages/index.html'
    });
    return;
  }

  window.alert(message);
}

function goToLogin() {
    globalObject.location.replace('../../../../../index.html');
  }
})(typeof window !== 'undefined' ? window : globalThis);
