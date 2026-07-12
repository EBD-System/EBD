function ensureLoadingOverlay() {
  if (document.getElementById('loadingOverlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'loadingOverlay';
  overlay.className = 'loading-overlay';
  overlay.innerHTML = `
    <div class="loading-card">
      <div class="loading-spinner"></div>
      <div class="loading-text">Carregando...</div>
    </div>
  `;

  document.body.appendChild(overlay);
}

function scheduleLoadingWatchdog(timeoutMs = 35000, message = loadingWatchdogMessage) {
  if (loadingWatchdog) clearTimeout(loadingWatchdog);
  loadingWatchdogMessage = message || loadingWatchdogMessage;
  loadingWatchdog = setTimeout(() => {
    loadingWatchdog = null;
    loadingCount = 0;
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.remove('show');
    showError(loadingWatchdogMessage);
  }, Math.max(5000, Number(timeoutMs) || 35000));
}

function clearLoadingWatchdog() {
  if (loadingWatchdog) {
    clearTimeout(loadingWatchdog);
    loadingWatchdog = null;
  }
}

function clearAutosaveTimer() {
  if (state.autosaveTimer) {
    clearTimeout(state.autosaveTimer);
    state.autosaveTimer = null;
  }
}


function showLoading(message = 'Carregando...', timeoutMs = 35000) {
  ensureLoadingOverlay();

  const overlay = document.getElementById('loadingOverlay');
  const text = overlay.querySelector('.loading-text');

  if (text) text.textContent = message;

  loadingCount += 1;
  overlay.classList.add('show');
  scheduleLoadingWatchdog(timeoutMs, 'A operação demorou demais e foi cancelada. Tente novamente.');
}

function hideLoading(force = false) {
  if (force) {
    loadingCount = 0;
    clearLoadingWatchdog();
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.remove('show');
    return;
  }

  loadingCount = Math.max(0, loadingCount - 1);

  if (loadingCount === 0) {
    clearLoadingWatchdog();
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.remove('show');
  }
}

function forceHideLoading() {
  hideLoading(true);
}



function isSelectedDateToday() {
  return String(state.dateKey || '') === todayKey();
}

function updateSaveButtonVisibility() {
  if (!els.saveBtn) return;
  const isToday = isSelectedDateToday();
  els.saveBtn.style.display = '';
  els.saveBtn.disabled = !isToday;
  els.saveBtn.classList.toggle('btn--date-locked', !isToday);
  els.saveBtn.setAttribute('aria-disabled', String(!isToday));
  els.saveBtn.setAttribute('aria-hidden', 'false');
}
function updateActionNotice() {
  if (!els.feedback) return;

  if (isSelectedDateToday()) {
    showSuccess('Sistema pronto para uso.');
    return;
  }

  setFeedback(
    'warning',
    `DATA SELECIONADA: ${formatDateBR(state.dateKey)}\n\nOBS:: Selecione a data de hoje para salvar a chamada do dia atual`
  );
}


function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function stripLeadingZeros_(value) {
  const digits = onlyDigits(value);
  if (!digits) return '';
  const normalized = digits.replace(/^0+(?=\d)/, '');
  return normalized || '0';
}

function formatToBrPhone(phone = '') {
  const digits = String(phone || '').replace(/\D/g, '').slice(0, 11);

  if (!digits) return '';

  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);

  if (digits.length <= 2) {
    return `(${ddd}`;
  }

  if (digits.length <= 3) {
    return `(${ddd}) ${rest}`;
  }

  if (digits.length <= 7) {
    return `(${ddd}) ${rest.slice(0, 1)}${rest.slice(1)}`;
  }

  return `(${ddd}) ${rest.slice(0, 1)}${rest.slice(1, 5)}-${rest.slice(5, 9)}`;
}

function formatBrazilCellPhone(value) {
  return formatToBrPhone(value);
}

function formatCelular(value) {
  return formatToBrPhone(value);
}

function isModifierKey(event) {
  return !!(event?.ctrlKey || event?.metaKey || event?.altKey);
}

function getDigitsBeforeCaret_(value, caretIndex) {
  return String(value || '')
    .slice(0, Math.max(0, caretIndex || 0))
    .replace(/\D/g, '').length;
}

function caretFromDigitIndex_(formattedValue, digitIndex) {
  if (digitIndex <= 0) return 0;
  let digitsSeen = 0;
  const text = String(formattedValue || '');
  for (let i = 0; i < text.length; i += 1) {
    if (/\d/.test(text[i])) {
      digitsSeen += 1;
      if (digitsSeen >= digitIndex) {
        return i + 1;
      }
    }
  }
  return text.length;
}

function normalizeWholeNumberText(value) {
  return stripLeadingZeros_(value);
}

function getCurrentPresentCount() {
  const call = getCurrentCall();
  if (!call) return 0;
  return (call.rows || []).reduce((count, row) => {
    if (isInactiveStudent(row)) return count;
    return count + (isPresentLikeValue(row.presenca) ? 1 : 0);
  }, 0);
}

function clampWholeNumber(value, max = null) {
  let normalized = normalizeWholeNumberText(value);
  let numeric = normalized === '' ? 0 : Number(normalized);
  if (!Number.isFinite(numeric) || numeric < 0) numeric = 0;

  if (Number.isFinite(max)) {
    const maxInt = Math.max(0, Math.floor(max));
    if (numeric > maxInt) {
      numeric = maxInt;
    }
  }

  return numeric;
}

function normalizeNumericInputValue_(value) {
  const normalized = normalizeWholeNumberText(value);
  return normalized === '' ? '' : String(Number(normalized));
}

function showNumericLimitAlert_(limit, presentes, visitantes, label = 'O número máximo permitido') {
  if (Number(limit) === 50 && String(label || '').toLowerCase().includes('visitantes')) {
    window.alert('O número máximo permitido para visitantes é 50.');
    return;
  }

  window.alert(`${label} é ${limit}, pois existem ${presentes} presentes e ${visitantes} visitantes.`);
}

function syncNumericInputField(input, { max = null, alertOnClamp = false, alertLabel = 'O número máximo permitido' } = {}) {
  if (!input) return 0;

  const raw = String(input.value ?? '');
  const normalizedText = normalizeWholeNumberText(raw);
  const numericBeforeClamp = normalizedText === '' ? 0 : Number(normalizedText);
  let numeric = Number.isFinite(numericBeforeClamp) && numericBeforeClamp >= 0 ? numericBeforeClamp : 0;
  let clamped = false;

  if (Number.isFinite(max)) {
    const maxInt = Math.max(0, Math.floor(max));
    if (numeric > maxInt) {
      numeric = maxInt;
      clamped = true;
    }
  }

  input.value = normalizedText === '' && raw === '' ? '' : String(numeric);

  if (clamped && alertOnClamp) {
    const presentes = getCurrentPresentCount();
    const visitantes = clampWholeNumber(document.getElementById('visitantesInput')?.value ?? 0, 50);
    showNumericLimitAlert_(Number.isFinite(max) ? Math.floor(max) : numeric, presentes, visitantes, alertLabel);
  }

  return numeric;
}

function formatTensToBRL(event) {
  if (!event?.target) return;
  if (isModifierKey(event)) return;

  const digits = String(event.target.value || '').replace(/\D/g, '');
  const cents = digits.padStart(3, '0');
  const number = Number(cents) / 100;

  event.target.value = number.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function parseCurrencyBR(value) {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  let str = String(value).trim();

  if (!str) {
    return 0;
  }

  // Remove tudo que não for número, vírgula, ponto ou sinal de menos
  str = str.replace(/[^\d.,-]/g, '');

  if (!str) {
    return 0;
  }

  const hasComma = str.includes(',');
  const hasDot = str.includes('.');

  if (hasComma && hasDot) {
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');

    if (lastComma > lastDot) {
      str = str.replace(/\./g, '');
      str = str.replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (hasComma) {
    str = str.replace(/\./g, '');
    str = str.replace(',', '.');
  } else if (hasDot) {
    const parts = str.split('.');
    if (parts.length > 2) {
      str = parts.join('');
    }
  }

  const num = Number(str);
  return Number.isFinite(num) ? num : 0;
}

function formatCurrencyBR(value) {

  const number = parseCurrencyBR(value);

  return number.toLocaleString(
    'pt-BR',
    {
      style: 'currency',
      currency: 'BRL',
    }
  );
}

function formatMoney(value) {

  const n =
    value === null ||
    value === undefined ||
    value === ''
      ? 0
      : Number(value);

  try {

    return n.toLocaleString(
      'pt-BR',
      {
        style: 'currency',
        currency: 'BRL',
      }
    );

  } catch (err) {

    return `R$ ${n.toFixed(2)}`;
  }
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1).replace('.', ',')}%`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function capitalizeFirstLetter(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}
