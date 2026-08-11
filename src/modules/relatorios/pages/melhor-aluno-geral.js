const STORAGE_KEYS = window.APP_STORAGE_KEYS;
const AUTH_STORAGE = window.APP_AUTH_STORAGE;
const APP_ACCESS_DENIED_DIALOG = window.APP_ACCESS_DENIED_DIALOG;
const APP_SERVICE = window.APP_MELHOR_ALUNO_GERAL_SERVICE;

const statusBanner = document.getElementById('statusBanner');
const resultsMeta = document.getElementById('resultsMeta');
const emptyState = document.getElementById('emptyState');
const tableWrap = document.getElementById('tableWrap');
const rankingBody = document.getElementById('rankingBody');
const rankingCount = document.getElementById('rankingCount');

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
  loadRanking();
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
  setStatus('Carregando o ranking geral de alunos...', 'info');
  setResultsMeta('Ranking atualizado.');
  setVisible(emptyState, false);
  setVisible(tableWrap, false);
}

async function loadRanking() {
  if (state.loading) {
    return;
  }

  state.loading = true;

  try {
    const result = await APP_SERVICE.fetchStudentsRanking({ token: state.token });

    if (!result?.found) {
      renderEmpty(result?.reason || 'Nenhum aluno encontrado no ranking geral.');
      return;
    }

    renderRanking(result.ranking || []);
    const total = Array.isArray(result.ranking) ? result.ranking.length : 0;
    setStatus('Ranking geral carregado com sucesso.', 'success');
    setResultsMeta(`Top ${total || 0} alunos exibidos.`);
    rankingCount.textContent = `${total || 0} alunos`;
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

    setStatus(error?.message || 'Falha ao carregar o ranking geral.', 'warning');
    setResultsMeta('Não foi possível concluir a consulta.');
    renderEmpty('Não foi possível carregar os dados do ranking geral agora.');
  } finally {
    state.loading = false;
  }
}

function renderRanking(rows) {
  const normalizedRows = Array.isArray(rows) ? rows.slice(0, 10) : [];

  if (!normalizedRows.length) {
    renderEmpty('Nenhum aluno encontrado no ranking geral.');
    return;
  }

  rankingBody.innerHTML = normalizedRows
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.nome || 'Aluno sem nome')}</td>
          <td>${escapeHtml(row.classe || '—')}</td>
          <td>${escapeHtml(row.percentual_presenca || '—')}</td>
        </tr>
      `
    )
    .join('');

  setVisible(emptyState, false);
  setVisible(tableWrap, true);
}

function renderEmpty(message) {
  rankingBody.innerHTML = '';
  emptyState.querySelector('p').textContent = message;
  setVisible(tableWrap, false);
  setVisible(emptyState, true);
  rankingCount.textContent = '0 alunos';
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
