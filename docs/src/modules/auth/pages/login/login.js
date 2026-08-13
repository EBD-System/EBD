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

const LOGIN_LOADING_STEPS = [
  { message: 'Verificando seus dados de acesso...', duration: 3200 },
  { message: 'Estabelecendo conexão com o sistema...', duration: 3800 },
  { message: 'Consultando o servidor...', duration: 4400 },
  { message: 'Aguardando a resposta do sistema...', duration: 5000 },
  { message: 'Preparando seu acesso...', duration: 4200 },
  { message: 'Finalizando a autenticação...', duration: 3600 },
];
let loginLoadingMessageTimer = null;
let loginLoadingMessageIndex = 0;

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
    const message = getLoginFailureMessage(error);
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
  clearLoginLoadingMessageTimer();

  loginLoading.classList.add('is-visible');
  loginLoading.setAttribute('aria-hidden', 'false');
  document.body.classList.add('login-loading-active');
  form.inert = true;
  forgotPasswordLink.inert = true;
  loginLoadingMark.className = 'login-loading__mark';
  loginLoadingMark.innerHTML = '';

  if (state === 'success') {
    loginLoadingMark.classList.add('login-loading__mark--success');
    loginLoadingText.textContent = 'Credenciais confirmadas. Entrando...';
    return;
  }

  if (state === 'error') {
    loginLoadingMark.classList.add('login-loading__mark--error');
    loginLoadingText.textContent = message || 'Não foi possível entrar.';
    return;
  }

  loginLoadingMark.classList.add('login-loading__mark--loading');
  loginLoadingMark.innerHTML = '<span class="login-loading__spinner"></span>';
  loginLoadingMessageIndex = 0;
  showNextLoginLoadingMessage();
}

function showNextLoginLoadingMessage() {
  if (!loginLoading.classList.contains('is-visible')) return;

  const step = LOGIN_LOADING_STEPS[loginLoadingMessageIndex];
  if (!step) return;

  loginLoadingText.textContent = step.message;
  loginLoadingMessageTimer = window.setTimeout(() => {
    loginLoadingMessageTimer = null;
    if (!loginLoading.classList.contains('is-visible')) return;

    loginLoadingMessageIndex += 1;
    if (loginLoadingMessageIndex >= LOGIN_LOADING_STEPS.length) {
      loginLoadingMessageIndex = LOGIN_LOADING_STEPS.length - 1;
      showNextLoginLoadingMessage();
      return;
    }

    showNextLoginLoadingMessage();
  }, step.duration);
}

function clearLoginLoadingMessageTimer() {
  if (loginLoadingMessageTimer === null) return;
  window.clearTimeout(loginLoadingMessageTimer);
  loginLoadingMessageTimer = null;
}

function getLoginFailureMessage(error) {
  const status = Number(error?.status || 0);
  const backendMessage = String(error?.backendMessage || error?.primaryMessage || '').trim();

  if (status === 401 || /(?:usu[aá]rio|login|senha|credencial).{0,40}(?:inv[aá]lid|incorret|errad)|(?:inv[aá]lid|incorret|errad).{0,40}(?:usu[aá]rio|login|senha|credencial)/i.test(backendMessage)) {
    return 'Usuário ou senha inválidos.';
  }

  if (error instanceof TypeError && !backendMessage) {
    return 'Não foi possível conectar ao sistema. Tente novamente.';
  }

  return error?.message || 'Não foi possível autenticar agora. Tente novamente.';
}

function hideLoginLoading() {
  clearLoginLoadingMessageTimer();
  loginLoading.classList.remove('is-visible');
  loginLoading.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('login-loading-active');
  form.inert = false;
  forgotPasswordLink.inert = false;
}
