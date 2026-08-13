const API_CONFIG = window.APP_CONFIG;
const API_BASE_URL = API_CONFIG.resolveApiBaseUrl();
const AUTH_STORAGE = window.APP_AUTH_STORAGE;
const APP_API_CLIENT = window.APP_API_CLIENT;
const STORAGE_KEYS = window.APP_STORAGE_KEYS;

const form = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const rememberUser = document.getElementById('rememberUser');
const forgotPasswordLink = document.getElementById('forgotPasswordLink');
const loginButton = document.getElementById('loginButton');
const feedback = document.getElementById('feedback');
const postLogin = document.getElementById('postLogin');
const logoutButton = document.getElementById('logoutButton');
const loginLoading = document.getElementById('loginLoading');
const loginLoadingMark = loginLoading.querySelector('.login-loading__mark');
const loginLoadingText = document.getElementById('loginLoadingText');

const rememberedUsername = window.localStorage.getItem(STORAGE_KEYS.username);
if (rememberedUsername) {
  usernameInput.value = rememberedUsername;
  rememberUser.checked = true;
}

forgotPasswordLink.href = buildWhatsAppLink(
  '71981768164',
  'Esqueci minha senha, pode me ajudar?'
);

const existingToken = getStoredToken();
if (existingToken) {
  goToDashboard();
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  feedback.textContent = '';
  feedback.classList.remove('is-success');

  const login = usernameInput.value.trim();
  const senha = passwordInput.value;

  if (!login || !senha) {
    feedback.textContent = 'Informe usuário e senha para continuar.';
    return;
  }

  setLoading(true);
  showLoginLoading('loading');

  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, senha }),
    });

    const payload = await APP_API_CLIENT.safeJson(response);

    if (!response.ok || APP_API_CLIENT.isFailurePayload?.(payload) || payload?.ok === false) {
      throw APP_API_CLIENT.createApiError(response, payload, {
        fallbackMessage: 'Não foi possível autenticar agora.'
      });
    }

    const token = extractToken(payload);
    if (!token) {
      throw new Error('A resposta do servidor não retornou um token válido.');
    }

    storeToken(token);
    syncRememberedUsername(login, rememberUser.checked);
    passwordInput.value = '';
    showLoginLoading('success');
    window.setTimeout(goToDashboard, 420);
  } catch (error) {
    const message = error.message || 'Falha ao efetuar login.';
    feedback.textContent = message;
    showLoginLoading('error', message);
    window.setTimeout(() => hideLoginLoading(), 800);
  } finally {
    setLoading(false);
  }
});

logoutButton.addEventListener('click', () => {
  clearToken();
  postLogin.hidden = true;
  form.hidden = false;
  feedback.textContent = 'Sessão encerrada.';
  feedback.classList.remove('is-success');
});

function setLoading(isLoading) {
  loginButton.disabled = isLoading;
  loginButton.textContent = isLoading ? 'Entrando...' : 'Entrar';
}

function goToDashboard() {
  window.location.assign(getDashboardUrl());
}

function getDashboardUrl() {
  return './src/modules/dashboard/pages/home/index.html';
}

function buildWhatsAppLink(phone, message) {
  const normalizedPhone = String(phone).replace(/\D/g, '');
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${normalizedPhone}?text=${encodedMessage}`;
}

function extractToken(payload) {
  if (!payload || typeof payload !== 'object') return '';

  return (
    payload.token ||
    payload.accessToken ||
    payload.data?.token ||
    payload.data?.accessToken ||
    payload.result?.token ||
    payload.result?.accessToken ||
    payload.auth?.token ||
    ''
  );
}

function storeToken(token) {
  AUTH_STORAGE.writeToken(token, STORAGE_KEYS.token);
}

function getStoredToken() {
  return AUTH_STORAGE.readToken(STORAGE_KEYS.token) || null;
}

function clearToken() {
  AUTH_STORAGE.clearToken(STORAGE_KEYS.token);
}

function syncRememberedUsername(login, shouldRemember) {
  if (shouldRemember) {
    window.localStorage.setItem(STORAGE_KEYS.username, login);
    return;
  }

  window.localStorage.removeItem(STORAGE_KEYS.username);
}


function showLoginLoading(state, message = '') {
  loginLoading.classList.add('is-visible');
  loginLoading.setAttribute('aria-hidden', 'false');
  document.body.classList.add('login-loading-active');
  form.inert = true;
  forgotPasswordLink.inert = true;
  loginLoadingMark.className = 'login-loading__mark';
  loginLoadingMark.innerHTML = '';

  if (state === 'success') {
    loginLoadingMark.classList.add('login-loading__mark--success');
    loginLoadingText.textContent = 'Tudo certo. Entrando...';
    return;
  }

  if (state === 'error') {
    loginLoadingMark.classList.add('login-loading__mark--error');
    loginLoadingText.textContent = message || 'Não foi possível entrar.';
    return;
  }

  loginLoadingMark.classList.add('login-loading__mark--loading');
  loginLoadingMark.innerHTML = '<span class="login-loading__spinner"></span>';
  loginLoadingText.textContent = 'Aguarde...';
}

function hideLoginLoading() {
  loginLoading.classList.remove('is-visible');
  loginLoading.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('login-loading-active');
  form.inert = false;
  forgotPasswordLink.inert = false;
}
