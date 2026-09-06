(function initAppErrorDialog(root) {
  const globalObject = root || (typeof globalThis !== 'undefined' ? globalThis : window);
  const SUPPORT_PHONE = '71981768164';
  const DIALOG_ID = 'app-error-dialog';

  const state = {
    dialog: null,
    title: null,
    message: null,
    trace: null
  };

  function ensureDialog() {
    if (state.dialog && document.body.contains(state.dialog)) {
      return state.dialog;
    }

    injectStyles();

    const dialog = document.createElement('dialog');
    dialog.id = DIALOG_ID;
    dialog.className = 'app-error-dialog';
    dialog.setAttribute('aria-labelledby', 'appErrorDialogTitle');
    dialog.setAttribute('aria-describedby', 'appErrorDialogMessage');

    dialog.innerHTML = `
      <div class="app-error-dialog__card">
        <div class="app-error-dialog__header">
          <div>
            <p class="app-error-dialog__eyebrow">Atenção</p>
            <h3 id="appErrorDialogTitle" class="app-error-dialog__title">Erro ao processar a solicitação</h3>
          </div>
          <button type="button" class="app-error-dialog__close" aria-label="Fechar diálogo">×</button>
        </div>

        <p id="appErrorDialogMessage" class="app-error-dialog__message">
          Houve um erro. Fale com o suporte para corrigir.
        </p>

        <details class="app-error-dialog__details">
          <summary>Ver trace do erro</summary>
          <pre class="app-error-dialog__trace" id="appErrorDialogTrace"></pre>
        </details>

        <div class="app-error-dialog__actions">
          <button type="button" class="app-error-dialog__button is-secondary" data-action="cancel">Cancelar</button>
          <button type="button" class="app-error-dialog__button" data-action="support">Suporte</button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    const closeButton = dialog.querySelector('.app-error-dialog__close');
    const cancelButton = dialog.querySelector('[data-action="cancel"]');
    const supportButton = dialog.querySelector('[data-action="support"]');
    const title = dialog.querySelector('#appErrorDialogTitle');
    const message = dialog.querySelector('#appErrorDialogMessage');
    const trace = dialog.querySelector('#appErrorDialogTrace');

    closeButton?.addEventListener('click', closeDialog);
    cancelButton?.addEventListener('click', closeDialog);
    supportButton?.addEventListener('click', handleSupportClick);
    dialog.addEventListener('click', handleBackdropClick);

    state.dialog = dialog;
    state.title = title;
    state.message = message;
    state.trace = trace;

    return dialog;
  }

  function injectStyles() {
    if (document.getElementById('app-error-dialog-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'app-error-dialog-styles';
    style.textContent = `
      .app-error-dialog {
        padding: 0;
        border: 0;
        background: transparent;
        width: min(92vw, 560px);
        color: #12304f;
      }

      .app-error-dialog::backdrop {
        background: rgba(5, 15, 31, 0.55);
        backdrop-filter: blur(4px);
      }

      .app-error-dialog__card {
        display: flex;
        flex-direction: column;
        gap: 18px;
        padding: 22px;
        border-radius: 24px;
        background: #ffffff;
        box-shadow: 0 26px 72px rgba(7, 20, 43, 0.3);
        border: 1px solid rgba(18, 42, 79, 0.08);
      }

      .app-error-dialog__header {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: flex-start;
      }

      .app-error-dialog__eyebrow {
        margin: 0 0 6px;
        font-size: 0.74rem;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #1557c0;
      }

      .app-error-dialog__title {
        margin: 0;
        font-size: 1.35rem;
        line-height: 1.2;
      }

      .app-error-dialog__close {
        flex: none;
        width: 42px;
        height: 42px;
        border: 0;
        border-radius: 999px;
        background: rgba(21, 87, 192, 0.08);
        color: #1557c0;
        font-size: 1.4rem;
        font-weight: 700;
        cursor: pointer;
      }

      .app-error-dialog__message {
        margin: 0;
        line-height: 1.6;
        color: #324a67;
      }

      .app-error-dialog__details {
        border-radius: 16px;
        padding: 12px 14px;
        background: rgba(243, 247, 252, 0.96);
        border: 1px solid rgba(21, 87, 192, 0.1);
      }

      .app-error-dialog__details summary {
        cursor: pointer;
        font-weight: 700;
        color: #12304f;
      }

      .app-error-dialog__trace {
        margin: 12px 0 0;
        white-space: pre-wrap;
        word-break: break-word;
        color: #5b6470;
        font: inherit;
        line-height: 1.55;
      }

      .app-error-dialog__actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        flex-wrap: wrap;
      }

      .app-error-dialog__button {
        min-width: 130px;
        padding: 12px 18px;
        border: 0;
        border-radius: 999px;
        background: #1557c0;
        color: #ffffff;
        font-weight: 800;
        cursor: pointer;
      }

      .app-error-dialog__button.is-secondary {
        background: rgba(21, 87, 192, 0.1);
        color: #1557c0;
      }

      @media (max-width: 520px) {
        .app-error-dialog__card {
          padding: 18px;
          border-radius: 20px;
        }

        .app-error-dialog__actions {
          justify-content: stretch;
        }

        .app-error-dialog__button {
          min-width: 0;
          flex: 1 1 140px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function buildWhatsAppLink(phone, message) {
    const normalizedPhone = String(phone || '').replace(/\D/g, '');
    const encodedMessage = encodeURIComponent(String(message || ''));
    return `https://wa.me/${normalizedPhone}?text=${encodedMessage}`;
  }

  function open(options = {}) {
    const dialog = ensureDialog();
    const title = String(options.title || 'Erro ao processar a solicitação').trim();
    const message = String(options.message || 'Houve um erro. Fale com o suporte para corrigir.').trim();
    const trace = String(options.trace || '').trim();

    if (state.title) state.title.textContent = title;
    if (state.message) state.message.textContent = message;
    if (state.trace) state.trace.textContent = trace || 'Trace não disponível.';
    dialog.dataset.trace = trace;
    dialog.dataset.phone = String(options.supportPhone || SUPPORT_PHONE);

    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      dialog.setAttribute('open', '');
    }

    return dialog;
  }

  function closeDialog() {
    if (!state.dialog) return;

    if (typeof state.dialog.close === 'function') {
      state.dialog.close();
    } else {
      state.dialog.removeAttribute('open');
    }
  }

  function handleBackdropClick(event) {
    if (event.target === state.dialog) {
      closeDialog();
    }
  }

  function handleSupportClick() {
    const trace = state.dialog?.dataset.trace || state.trace?.textContent || '';
    const phone = state.dialog?.dataset.phone || SUPPORT_PHONE;
    const message = `Houve um erro. Fale com o suporte para corrigir.\n\nTrace do erro:\n${trace || 'Trace não disponível.'}`;
    const link = buildWhatsAppLink(phone, message);
    window.open(link, '_blank', 'noopener,noreferrer');
  }

  globalObject.APP_ERROR_DIALOG = Object.freeze({
    open,
    close: closeDialog,
    ensure: ensureDialog
  });
})(typeof globalThis !== 'undefined' ? globalThis : window);
