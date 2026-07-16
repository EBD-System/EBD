function currentIsoNow() {
  return new Date().toISOString();
}


function normalizeCadastroIdValue(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) return raw;

  return String(Math.trunc(numeric));
}

function decodeJwtPayload(token) {
  const raw = String(token || '').trim();
  if (!raw) return null;

  const parts = raw.split('.');
  if (parts.length < 2) return null;

  try {
    const base64Url = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64Url.padEnd(Math.ceil(base64Url.length / 4) * 4, '=');
    const json = atob(padded);
    return JSON.parse(json);
  } catch (err) {
    return null;
  }
}

function extractCadastroIdFromToken(token) {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload !== 'object') return '';

  return normalizeCadastroIdValue(
    payload.id_cadastro ??
    payload.idCadastro ??
    payload.cadastro_id ??
    payload.cadastroId ??
    payload.tenant_id ??
    payload.tenantId ??
    payload.data?.id_cadastro ??
    payload.data?.idCadastro ??
    payload.user?.id_cadastro ??
    payload.user?.idCadastro ??
    ''
  );
}

function getSessionCadastroId(session = state?.session || null) {
  const storedSession = typeof getStoredAccessSession === 'function' ? getStoredAccessSession() : null;
  const candidates = [
    session?.idCadastro,
    session?.id_cadastro,
    session?.cadastroId,
    session?.cadastro_id,
    session?.tenantId,
    session?.tenant_id,
    session?.data?.id_cadastro,
    session?.data?.idCadastro,
    session?.user?.id_cadastro,
    session?.user?.idCadastro,
    session?.user?.tenant_id,
    session?.user?.tenantId,
    session?.userIdCadastro,
    session?.user?.userIdCadastro,
    storedSession?.idCadastro,
    storedSession?.id_cadastro,
    storedSession?.cadastroId,
    storedSession?.cadastro_id,
    storedSession?.tenantId,
    storedSession?.tenant_id,
    storedSession?.data?.id_cadastro,
    storedSession?.data?.idCadastro,
    storedSession?.user?.id_cadastro,
    storedSession?.user?.idCadastro,
    storedSession?.user?.tenant_id,
    storedSession?.user?.tenantId,
    storedSession?.token,
    storedSession?.accessToken,
    session?.accessToken,
    session?.token,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeCadastroIdValue(candidate);
    if (normalized && !/\./.test(normalized) && /^\d+$/.test(normalized)) {
      return normalized;
    }
  }

  for (const candidate of candidates) {
    const normalized = extractCadastroIdFromToken(candidate);
    if (normalized) return normalized;
  }

  return '';
}
function normalizeAccessText(value) {
  return String(value ?? '').trim();
}

function normalizeProfileName(value) {
  return normalizeAccessText(value).toLowerCase();
}

function normalizeProfileList(perfis) {
  if (!Array.isArray(perfis)) return [];
  const seen = new Set();
  const normalized = [];

  perfis.forEach((perfil) => {
    const name = normalizeAccessText(perfil);
    const key = normalizeProfileName(name);
    if (!key || seen.has(key)) return;
    seen.add(key);
    normalized.push(name);
  });

  return normalized;
}

function inferAccessModeFromProfiles(perfis = []) {
  const normalized = normalizeProfileList(perfis).map(normalizeProfileName);

  if (normalized.includes('administrador')) {
    return 'full';
  }

  if (normalized.length > 0) {
    return 'restricted';
  }

  return 'self';
}

function legacyCodeToMode(code) {
  const normalized = normalizeAccessText(code).toLowerCase();
  if (!normalized) return 'self';
  if (ACCESS_CODES.full.has(normalized)) return 'full';
  if (ACCESS_CODES.restricted.has(normalized)) return 'restricted';
  return 'restricted';
}

function buildLegacySession(code, accessMode = legacyCodeToMode(code)) {
  const normalizedCode = normalizeAccessText(code);
  const mode = String(accessMode || legacyCodeToMode(normalizedCode)).trim().toLowerCase();

  return {
    userId: null,
    login: normalizedCode,
    nome: normalizedCode || 'Acesso legado',
    perfis: mode === 'full' ? ['Administrador'] : [],
    profiles: mode === 'full' ? ['Administrador'] : [],
    accessMode: mode,
    accessCode: normalizedCode,
    legacyAccessCode: normalizedCode,
    idCadastro: '',
    id_cadastro: '',
    token: '',
    accessToken: '',
    createdAt: currentIsoNow(),
    updatedAt: currentIsoNow(),
  };
}

function normalizeAccessSession(sessionOrCode, accessModeHint = '') {
  if (!sessionOrCode) {
    return null;
  }

  if (typeof sessionOrCode === 'string') {
    return buildLegacySession(sessionOrCode, accessModeHint || legacyCodeToMode(sessionOrCode));
  }

  if (typeof sessionOrCode !== 'object') {
    return null;
  }

  const token = normalizeAccessText(
    sessionOrCode.token ??
    sessionOrCode.accessToken ??
    sessionOrCode.authToken ??
    sessionOrCode.jwt ??
    sessionOrCode.data?.token ??
    sessionOrCode.user?.token ??
    ''
  );

  const rawProfiles = sessionOrCode.perfis || sessionOrCode.perfil || sessionOrCode.profiles || sessionOrCode.profile || [];
  const perfis = normalizeProfileList(rawProfiles);
  const legacyAccessCode = normalizeAccessText(
    sessionOrCode.legacyAccessCode ??
    sessionOrCode.accessCode ??
    sessionOrCode.code ??
    ''
  );
  const explicitCadastroId = normalizeCadastroIdValue(
    sessionOrCode.id_cadastro ??
    sessionOrCode.idCadastro ??
    sessionOrCode.cadastroId ??
    sessionOrCode.cadastro_id ??
    sessionOrCode.tenant_id ??
    sessionOrCode.tenantId ??
    sessionOrCode.user?.id_cadastro ??
    sessionOrCode.user?.idCadastro ??
    sessionOrCode.user?.tenant_id ??
    sessionOrCode.user?.tenantId ??
    sessionOrCode.data?.id_cadastro ??
    sessionOrCode.data?.idCadastro ??
    ''
  );

  const inferredMode = sessionOrCode.accessMode
    ? String(sessionOrCode.accessMode).trim().toLowerCase()
    : inferAccessModeFromProfiles(perfis);

  const accessMode = inferredMode || legacyCodeToMode(legacyAccessCode) || normalizeAccessText(accessModeHint).toLowerCase() || 'self';

  const normalizedSession = {
    userId: sessionOrCode.userId ?? sessionOrCode.id_usuario ?? sessionOrCode.idUsuario ?? sessionOrCode.user?.id_usuario ?? sessionOrCode.user?.id ?? null,
    idCadastro: explicitCadastroId,
    id_cadastro: explicitCadastroId,
    login: normalizeAccessText(sessionOrCode.login || sessionOrCode.usuario || sessionOrCode.user?.login || legacyAccessCode),
    nome: normalizeAccessText(
      sessionOrCode.nome ||
      sessionOrCode.name ||
      sessionOrCode.pessoa_nome ||
      sessionOrCode.user?.pessoa_nome ||
      sessionOrCode.user?.nome ||
      sessionOrCode.login ||
      legacyAccessCode ||
      'Usuário'
    ),
    perfis,
    profiles: perfis,
    accessMode,
    accessCode: legacyAccessCode,
    legacyAccessCode,
    token,
    accessToken: token,
    createdAt: normalizeAccessText(sessionOrCode.createdAt || sessionOrCode.criadoEm || sessionOrCode.created_at) || currentIsoNow(),
    updatedAt: currentIsoNow(),
  };

  if (normalizedSession.userId !== null && normalizedSession.userId !== undefined && normalizedSession.userId !== '') {
    const numeric = Number(normalizedSession.userId);
    normalizedSession.userId = Number.isFinite(numeric) ? numeric : normalizedSession.userId;
  } else {
    normalizedSession.userId = null;
  }

  if (normalizedSession.accessMode !== 'full' && normalizedSession.accessMode !== 'restricted' && normalizedSession.accessMode !== 'self') {
    normalizedSession.accessMode = inferAccessModeFromProfiles(perfis);
  }

  if (!normalizedSession.idCadastro) {
    normalizedSession.idCadastro = extractCadastroIdFromToken(token);
    normalizedSession.id_cadastro = normalizedSession.idCadastro;
  }

  if (!normalizedSession.legacyAccessCode && normalizedSession.userId === null) {
    normalizedSession.legacyAccessCode = normalizedSession.login;
    normalizedSession.accessCode = normalizedSession.login;
  }

  return normalizedSession;
}

function getAccessCodeFromUrl() {
  try {
    return String(new URLSearchParams(window.location.search).get('code') || '').trim();
  } catch (err) {
    return '';
  }
}

function getLoginPreferences() {
  const store = storageState();
  const prefs = store.loginPreferences;
  return prefs && typeof prefs === 'object' ? prefs : {};
}

function saveLoginPreferences(nextPreferences = {}) {
  const store = ensureStorageStateShape();
  store.loginPreferences = {
    ...(store.loginPreferences && typeof store.loginPreferences === 'object' ? store.loginPreferences : {}),
    ...nextPreferences,
  };
  saveStorageState(store);
  return store.loginPreferences;
}

function setRememberedLogin(login, remember = true) {
  const normalizedLogin = normalizeAccessText(login);
  const preferences = getLoginPreferences();

  if (!remember || !normalizedLogin) {
    delete preferences.rememberedLogin;
    preferences.rememberUsername = false;
    saveLoginPreferences(preferences);
    return preferences;
  }

  preferences.rememberedLogin = normalizedLogin;
  preferences.rememberUsername = true;
  saveLoginPreferences(preferences);
  return preferences;
}

function getRememberedLogin() {
  return normalizeAccessText(getLoginPreferences().rememberedLogin || '');
}

function shouldRememberLogin() {
  const preferences = getLoginPreferences();
  return !!preferences.rememberUsername && !!normalizeAccessText(preferences.rememberedLogin || '');
}

function getStoredAccessSession() {
  const store = storageState();
  return store.accessSession || null;
}

function persistAccessSession(sessionOrCode, accessMode = '') {
  const nextSession = normalizeAccessSession(sessionOrCode, accessMode);
  if (!nextSession) return null;

  const store = ensureStorageStateShape();
  const previous = store.accessSession && typeof store.accessSession === 'object' ? store.accessSession : null;
  nextSession.createdAt = previous?.createdAt || nextSession.createdAt || currentIsoNow();
  nextSession.updatedAt = currentIsoNow();

  store.accessSession = nextSession;
  saveStorageState(store);

  state.session = nextSession;
  state.accessCode = String(nextSession.accessCode || nextSession.legacyAccessCode || nextSession.login || '').trim();
  state.accessMode = String(nextSession.accessMode || 'self').trim().toLowerCase();
  applyAccessMode();
  renderResponsavelLabel();
  return nextSession;
}

function clearAccessSession() {
  const store = ensureStorageStateShape();
  delete store.accessSession;
  saveStorageState(store);

  state.session = null;
  state.accessCode = '';
  state.accessMode = 'self';
  applyAccessMode();
  renderResponsavelLabel();
}

function loadAccessSession() {
  const session = normalizeAccessSession(getStoredAccessSession());
  state.session = session || null;

  if (session) {
    state.accessCode = String(session.accessCode || session.legacyAccessCode || session.login || '').trim();
    state.accessMode = String(session.accessMode || inferAccessModeFromProfiles(session.perfis)).trim().toLowerCase();
    applyAccessMode();
    renderResponsavelLabel();
  }

  return state.session;
}

function resolveAccessMode(value) {
  if (value && typeof value === 'object') {
    const session = normalizeAccessSession(value);
    return session?.accessMode || inferAccessModeFromProfiles(session?.perfis) || 'self';
  }

  const text = normalizeAccessText(value || state.accessCode || state.session?.legacyAccessCode || state.session?.login || '');
  const sessionMode = state.session
    ? (state.session.accessMode || inferAccessModeFromProfiles(state.session.perfis))
    : '';

  if (sessionMode) return String(sessionMode).trim().toLowerCase();
  return legacyCodeToMode(text);
}

function isRestrictedMode() {
  return state.accessMode === 'restricted';
}

function canShareRestrictedReports() {
  if (state.session?.accessMode === 'full') return true;
  if (Array.isArray(state.session?.perfis) && state.session.perfis.some((perfil) => normalizeProfileName(perfil) === 'administrador')) {
    return true;
  }
  return ACCESS_CODES.restricted.has(String(state.accessCode || '').trim().toLowerCase());
}

function isSelfAccessMode() {
  return state.accessMode === 'self';
}

function canEditStudentRecords() {
  return state.accessMode === 'full' || state.accessMode === 'restricted';
}

function applyAccessMode() {
  document.body.classList.toggle('access-restricted', isRestrictedMode());
  document.body.classList.toggle('access-full', state.accessMode === 'full');
  document.body.classList.toggle('access-self', isSelfAccessMode());
  document.body.classList.toggle('access-share-reports', canShareRestrictedReports());
}

function renderResponsavelLabel() {
  if (!els.responsavelLabel) return;

  const session = state.session || loadAccessSession();
  const label =
    session?.nome ||
    session?.login ||
    session?.legacyAccessCode ||
    state.accessCode ||
    '—';

  els.responsavelLabel.textContent = capitalizeFirstLetter(label) || '—';
}

function normalizeSelfCelularSuffix(value) {
  return onlyDigits(value).slice(0, 4);
}

function ensureSelfAccessGate() {
  let panel = document.getElementById('selfAccessPanel');
  if (panel) return panel;

  panel = document.createElement('section');
  panel.id = 'selfAccessPanel';
  panel.className = 'self-access-panel';
  panel.innerHTML = `
    <div class="self-access-card card">
      <span class="badge">Acesso do aluno</span>
      <h1>Digite os 4 últimos do celular</h1>
      <p>Use apenas os 4 últimos números do celular para registrar sua presença.</p>
      <label class="self-access-field">
        <span>Celular</span>
        <div class="self-access-phone">
          <span class="self-access-phone__prefix">(XX) X XXXX-</span>
          <input
            id="selfCelularSuffixInput"
            class="self-access-phone__input"
            type="text"
            inputmode="numeric"
            autocomplete="off"
            maxlength="4"
            placeholder="____"
          />
        </div>
      </label>
      <button id="selfCelularSubmitBtn" class="btn btn--primary" type="button">Confirmar presença</button>
      <div id="selfCelularMessage" class="feedback feedback--inline" aria-live="polite"></div>
    </div>
  `;

  document.body.prepend(panel);

  const input = panel.querySelector('#selfCelularSuffixInput');
  const btn = panel.querySelector('#selfCelularSubmitBtn');

  if (input && !input.dataset.bound) {
    input.dataset.bound = '1';
    input.addEventListener('input', (event) => {
      event.target.value = normalizeSelfCelularSuffix(event.target.value);
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        handleSelfCelularSubmit();
      }
    });
  }

  if (btn && !btn.dataset.bound) {
    btn.dataset.bound = '1';
    btn.addEventListener('click', handleSelfCelularSubmit);
  }

  return panel;
}

function setSelfAccessMessage(type, message) {
  const messageBox = document.getElementById('selfCelularMessage');
  if (!messageBox) return;
  messageBox.className = `feedback feedback--inline show ${type}`;
  messageBox.textContent = message;
}

async function handleSelfCelularSubmit() {
  const input = document.getElementById('selfCelularSuffixInput');
  const btn = document.getElementById('selfCelularSubmitBtn');
  const suffix = normalizeSelfCelularSuffix(input?.value || '');

  if (suffix.length !== 4) {
    setSelfAccessMessage('error', 'Digite os 4 últimos números do celular.');
    return null;
  }

  state.selfCelularSuffix = suffix;
  localStorage.setItem('prb_self_celular_suffix_v1', suffix);
  window.dispatchEvent(
    new CustomEvent('selfCelularSuffixReady', { detail: { celularSuffix: suffix } })
  );

  if (!BACKEND_API_URL || String(BACKEND_API_URL).includes('COLE_AQUI')) {
    setSelfAccessMessage('error', 'Configure a URL da API do backend antes de enviar a presença.');
    return null;
  }

  const originalBtnText = btn?.textContent || 'Confirmar presença';

  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Enviando...';
    }

    showLoading('Registrando presença...', 30000);
    setSelfAccessMessage('info', 'Registrando presença...');

    const result = await apiPost({
      action: 'selfPresence',
      celularSuffix: suffix,
      date: state.dateKey,
    });

    setSelfAccessMessage('success', result.message || 'Presença confirmada com sucesso.');
    return suffix;
  } catch (err) {
    setSelfAccessMessage('error', err.message || 'Não foi possível registrar a presença.');
    return null;
  } finally {
    hideLoading();

    if (btn) {
      btn.disabled = false;
      btn.textContent = originalBtnText;
    }
  }
}

function renderSelfAccessGate() {
  ensureSelfAccessGate();
  document.body.classList.add('access-self');
  document.body.classList.remove('access-full');
  document.body.classList.remove('access-restricted');
  document.body.classList.remove('access-share-reports');
  hideLoading(true);
  clearFeedback();
}
