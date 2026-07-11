function getAccessCodeFromUrl() {
  try {
    return String(new URLSearchParams(window.location.search).get('code') || '').trim();
  } catch (err) {
    return '';
  }
}

function resolveAccessMode(code) {
  const normalized = String(code || '').trim().toLowerCase();

  if (!normalized) return 'self';
  if (ACCESS_CODES.full.has(normalized)) return 'full';
  if (ACCESS_CODES.restricted.has(normalized)) return 'restricted';

  return 'restricted';
}

function isRestrictedMode() {
  return state.accessMode === 'restricted';
}

function canShareRestrictedReports() {
  return ACCESS_CODES.restricted.has(String(state.accessCode || '').trim().toLowerCase());
}

function isSelfAccessMode() {
  return state.accessMode === 'self';
}

function applyAccessMode() {
  document.body.classList.toggle('access-restricted', isRestrictedMode());
  document.body.classList.toggle('access-full', state.accessMode === 'full');
  document.body.classList.toggle('access-self', isSelfAccessMode());
  document.body.classList.toggle('access-share-reports', canShareRestrictedReports());
}


function renderResponsavelLabel() {
  if (!els.responsavelLabel) return;
  els.responsavelLabel.textContent = capitalizeFirstLetter(state.accessCode) || '—';
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

  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes('COLE_AQUI')) {
    setSelfAccessMessage('error', 'Configure a URL do backend antes de enviar a presença.');
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

