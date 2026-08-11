const STORAGE_KEYS = window.APP_STORAGE_KEYS;
const AUTH_STORAGE = window.APP_AUTH_STORAGE;
const APP_ACCESS_DENIED_DIALOG = window.APP_ACCESS_DENIED_DIALOG;
const APP_SERVICE = window.APP_REPORTS_SERVICE;

const statusBanner = document.getElementById('statusBanner');
const resultsMeta = document.getElementById('resultsMeta');
const emptyState = document.getElementById('emptyState');
const tableWrap = document.getElementById('tableWrap');
const rankingBody = document.getElementById('rankingBody');
const rankingCount = document.getElementById('rankingCount');
const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');
const searchButton = document.getElementById('searchButton');

const state = {
  token: '',
  loading: false
};

const session = readSession();
if (!session.token) {
  goToLogin();
} else {
  state.token = session.token;
  wirePage();
  void loadRanking();
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
  setDefaultDates();
  wireEvents();
  setStatus('Informe um período e clique em Buscar para consultar o ranking de classes.', 'info');
  setResultsMeta(`Período padrão: ${formatDate(startDateInput.value)} até ${formatDate(endDateInput.value)}.`);
  setVisible(emptyState, false);
  setVisible(tableWrap, false);
}

function wireEvents() {
  if (searchButton) {
    searchButton.addEventListener('click', () => {
      void loadRanking();
    });
  }
}

function setDefaultDates() {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 7);

  if (startDateInput) {
    startDateInput.value = toInputDate(start);
  }

  if (endDateInput) {
    endDateInput.value = toInputDate(today);
  }
}

async function loadRanking() {
  if (state.loading) {
    return;
  }

  const startDate = startDateInput?.value || '';
  const endDate = endDateInput?.value || '';

  if (!isIsoDate(startDate) || !isIsoDate(endDate)) {
    setStatus('Preencha uma data inicial e uma data final válidas.', 'warning');
    renderEmpty(
      'Informe um período para continuar',
      'Escolha uma data inicial, uma data final e clique em Buscar para carregar o ranking de classes.'
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

  state.loading = true;
  if (searchButton) {
    searchButton.disabled = true;
  }

  try {
    setStatus('Consultando o ranking de classes...', 'info');
    renderEmpty(
      'Consultando o período selecionado',
      'Aguarde enquanto carregamos o ranking do período.'
    );

    const result = await APP_SERVICE.fetchClassesRanking({
      startDate,
      endDate,
      token: state.token
    });

    if (!result?.found) {
      renderEmpty(result?.reason || 'Nenhuma classe encontrada no ranking.');
      return;
    }

    renderRanking(result.ranking || []);
    const total = Array.isArray(result.ranking) ? result.ranking.length : 0;
    setStatus('Ranking de classes carregado com sucesso.', 'success');
    setResultsMeta(`Período ${formatDate(startDate)} até ${formatDate(endDate)}.`);
    rankingCount.textContent = `${total || 0} classes`;
  } catch (error) {
    if (Number(error?.status) === 403) {
      openAccessDeniedDialog(error);
      setResultsMeta('Acesso restrito ao subdiretório Financeiro.');
      renderEmpty('Usuário sem permissão', 'Seu perfil só pode acessar o submódulo Financeiro.');
      return;
    }

    if (error?.requiresRelogin) {
      setStatus(error.message, 'warning');
      setResultsMeta('Sessão expirada.');
      renderEmpty('Sua sessão expirou. Faça login novamente.');
      window.setTimeout(goToLogin, 350);
      return;
    }

    setStatus(error?.message || 'Falha ao carregar o ranking de classes.', 'warning');
    renderEmpty('Não foi possível carregar os dados do ranking de classes agora.');
  } finally {
    state.loading = false;
    if (searchButton) {
      searchButton.disabled = false;
    }
  }
}

function renderRanking(rows) {
  const normalizedRows = calculatePresenceShares(
    Array.isArray(rows) ? rows.slice(0, 10) : []
  );

  if (!normalizedRows.length) {
    renderEmpty('Nenhuma classe encontrada no ranking.');
    return;
  }

  rankingBody.innerHTML = normalizedRows
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.classe || 'Classe sem nome')}</td>
          <td>${escapeHtml(row.percentual_presenca_compartilhada)}</td>
        </tr>
      `
    )
    .join('');

  setVisible(emptyState, false);
  setVisible(tableWrap, true);
}

function calculatePresenceShares(rows) {
  const source = Array.isArray(rows) ? rows : [];
  if (!source.length) {
    return [];
  }

  const enriched = source.map((row, index) => ({
    ...row,
    _index: index,
    _presentes: toFiniteNumber(row?.presentes ?? row?.alunos_presentes)
  }));

  const totalPresentes = enriched.reduce(
    (total, row) => total + Math.max(0, row._presentes || 0),
    0
  );

  if (totalPresentes <= 0) {
    return enriched
      .sort(comparePresenceRows)
      .map((row) => ({
        ...row,
        percentual_presenca_compartilhada: '0%'
      }));
  }

  const scale = 10000;
  const shares = enriched.map((row) => {
    const exact = (Math.max(0, row._presentes || 0) / totalPresentes) * scale;
    const base = Math.floor(exact);
    return {
      row,
      base,
      remainder: exact - base
    };
  });

  let distributed = shares.reduce((total, item) => total + item.base, 0);
  let remaining = scale - distributed;

  shares
    .slice()
    .sort((a, b) => {
      if (b.remainder !== a.remainder) {
        return b.remainder - a.remainder;
      }

      return comparePresenceRows(a.row, b.row);
    })
    .forEach((item) => {
      if (remaining <= 0) return;
      item.base += 1;
      remaining -= 1;
    });

  return shares
    .sort((a, b) => comparePresenceRows(a.row, b.row))
    .map(({ row, base }) => ({
      ...row,
      percentual_presenca_compartilhada: `${(base / 100).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}%`
    }));
}

function comparePresenceRows(a, b) {
  const presentesA = Math.max(0, a?._presentes || 0);
  const presentesB = Math.max(0, b?._presentes || 0);

  if (presentesB !== presentesA) {
    return presentesB - presentesA;
  }

  const positionA = Number(a?.position);
  const positionB = Number(b?.position);

  if (Number.isFinite(positionA) && Number.isFinite(positionB) && positionA !== positionB) {
    return positionA - positionB;
  }

  return String(a?.classe || '').localeCompare(String(b?.classe || ''), 'pt-BR');
}

function toFiniteNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const normalized = String(value ?? '')
    .trim()
    .replace('%', '')
    .replace(',', '.');

  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : 0;
}

function renderEmpty(title, message) {
  rankingBody.innerHTML = '';
  const titleNode = emptyState?.querySelector('strong');
  const description = emptyState?.querySelector('p');

  if (titleNode) {
    titleNode.textContent = title;
  }

  if (description) {
    description.textContent = message;
  }

  setVisible(tableWrap, false);
  setVisible(emptyState, true);
  rankingCount.textContent = '0 classes';
  setResultsMeta(message);
  setStatus(message, 'warning');
}

function setStatus(message, tone = 'info') {
  if (!statusBanner) return;
  statusBanner.textContent = message;
  statusBanner.dataset.tone = tone;
}

function setResultsMeta(message) {
  if (!resultsMeta) return;
  resultsMeta.textContent = message;
}

function setVisible(node, visible) {
  if (!node) return;
  node.hidden = !visible;
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function toInputDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  if (!value) {
    return '';
  }

  const [year, month, day] = String(value).split('-');
  if (!year || !month || !day) {
    return String(value);
  }

  return `${day}/${month}/${year}`;
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
  window.location.replace('../../../../../index.html');
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
