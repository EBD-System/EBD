(function initAccessDeniedDialog(root) {
  const globalObject = root || (typeof globalThis !== 'undefined' ? globalThis : window);
  const DIALOG_ID = 'app-access-denied-dialog';

  const state = {
    dialog: null,
    title: null,
    message: null,
    backButton: null,
    onBack: null,
    scrollY: 0,
    bodyStyleSnapshot: null,
    htmlStyleSnapshot: null,
    scrollLocked: false
  };

  function ensureDialog() {
    if (state.dialog && document.body.contains(state.dialog)) {
      return state.dialog;
    }

    injectStyles();

    const dialog = document.createElement('dialog');
    dialog.id = DIALOG_ID;
    dialog.className = 'app-access-denied-dialog';
    dialog.setAttribute('aria-labelledby', 'appAccessDeniedDialogTitle');
    dialog.setAttribute('aria-describedby', 'appAccessDeniedDialogMessage');

    dialog.innerHTML = `
      <div class="app-access-denied-dialog__card">
        <div class="app-access-denied-dialog__header">
          <div>
            <p class="app-access-denied-dialog__eyebrow">Atenção</p>
            <h3 id="appAccessDeniedDialogTitle" class="app-access-denied-dialog__title">Erro</h3>
          </div>
        </div>

        <p id="appAccessDeniedDialogMessage" class="app-access-denied-dialog__message">
          Você não tem permissão para executar esta ação.
        </p>

        <div class="app-access-denied-dialog__actions">
          <button type="button" class="app-access-denied-dialog__button" data-action="back">Voltar</button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    const backButton = dialog.querySelector('[data-action="back"]');
    const title = dialog.querySelector('#appAccessDeniedDialogTitle');
    const message = dialog.querySelector('#appAccessDeniedDialogMessage');

    backButton?.addEventListener('click', handleBackClick);
    dialog.addEventListener('cancel', handleCancel);

    state.dialog = dialog;
    state.title = title;
    state.message = message;
    state.backButton = backButton;

    return dialog;
  }

  function injectStyles() {
    if (document.getElementById('app-access-denied-dialog-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'app-access-denied-dialog-styles';
    style.textContent = `
      .app-access-denied-dialog {
        padding: 0;
        border: 0;
        background: transparent;
        width: min(92vw, 520px);
        color: #12304f;
      }

      .app-access-denied-dialog::backdrop {
        background: rgba(5, 15, 31, 0.55);
        backdrop-filter: blur(4px);
      }

      .app-access-denied-dialog__card {
        display: flex;
        flex-direction: column;
        gap: 18px;
        padding: 22px;
        border-radius: 24px;
        background: #ffffff;
        box-shadow: 0 26px 72px rgba(7, 20, 43, 0.3);
        border: 1px solid rgba(18, 42, 79, 0.08);
      }

      .app-access-denied-dialog__header {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: flex-start;
      }

      .app-access-denied-dialog__eyebrow {
        margin: 0 0 6px;
        font-size: 0.74rem;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #1557c0;
      }

      .app-access-denied-dialog__title {
        margin: 0;
        font-size: 1.35rem;
        line-height: 1.2;
      }

      .app-access-denied-dialog__message {
        margin: 0;
        line-height: 1.6;
        color: #324a67;
      }

      .app-access-denied-dialog__actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
      }

      .app-access-denied-dialog__button {
        min-width: 140px;
        padding: 12px 18px;
        border: 0;
        border-radius: 999px;
        background: #1557c0;
        color: #ffffff;
        font-size: 0.98rem;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 12px 24px rgba(21, 87, 192, 0.2);
      }

      .app-access-denied-dialog__button:focus-visible {
        outline: 3px solid rgba(21, 87, 192, 0.28);
        outline-offset: 2px;
      }

      @media (max-width: 520px) {
        .app-access-denied-dialog__card {
          padding: 18px;
          border-radius: 20px;
        }

        .app-access-denied-dialog__actions {
          justify-content: stretch;
        }

        .app-access-denied-dialog__button {
          min-width: 0;
          flex: 1 1 140px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function lockPageScroll() {
    if (state.scrollLocked) return;

    const body = document.body;
    const html = document.documentElement;

    state.scrollY = window.scrollY || window.pageYOffset || 0;
    state.bodyStyleSnapshot = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
      overscrollBehavior: body.style.overscrollBehavior,
      touchAction: body.style.touchAction
    };
    state.htmlStyleSnapshot = {
      overflow: html.style.overflow,
      overscrollBehavior: html.style.overscrollBehavior
    };

    body.style.position = 'fixed';
    body.style.top = `-${state.scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';
    body.style.touchAction = 'none';

    html.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';

    state.scrollLocked = true;
  }

  function unlockPageScroll() {
    if (!state.scrollLocked) return;

    const body = document.body;
    const html = document.documentElement;
    const bodySnapshot = state.bodyStyleSnapshot || {};
    const htmlSnapshot = state.htmlStyleSnapshot || {};

    body.style.position = bodySnapshot.position || '';
    body.style.top = bodySnapshot.top || '';
    body.style.left = bodySnapshot.left || '';
    body.style.right = bodySnapshot.right || '';
    body.style.width = bodySnapshot.width || '';
    body.style.overflow = bodySnapshot.overflow || '';
    body.style.overscrollBehavior = bodySnapshot.overscrollBehavior || '';
    body.style.touchAction = bodySnapshot.touchAction || '';

    html.style.overflow = htmlSnapshot.overflow || '';
    html.style.overscrollBehavior = htmlSnapshot.overscrollBehavior || '';

    window.scrollTo(0, state.scrollY || 0);

    state.scrollLocked = false;
    state.bodyStyleSnapshot = null;
    state.htmlStyleSnapshot = null;
    state.scrollY = 0;
  }

  function preventScrollInteraction(event) {
    if (!state.dialog || !state.dialog.open) return;
    const target = event.target;
    if (target && state.dialog.contains(target)) return;
    event.preventDefault();
  }

  function normalizeMessage(value) {
    const text = String(value || '').trim();
    return text || 'Você não tem permissão para executar esta ação.';
  }

  function open(options = {}) {
    const dialog = ensureDialog();
    const title = normalizeMessage(options.title || 'Erro');
    const message = normalizeMessage(options.message);
    const onBack = typeof options.onBack === 'function' ? options.onBack : null;
    const backHref = String(options.backHref || '').trim();

    state.onBack = onBack;
    dialog.dataset.backHref = backHref;

    if (state.title) state.title.textContent = title;
    if (state.message) state.message.textContent = message;

    const shouldLockScroll = !state.scrollLocked;
    lockPageScroll();
    if (shouldLockScroll) {
      document.addEventListener('wheel', preventScrollInteraction, { passive: false, capture: true });
      document.addEventListener('touchmove', preventScrollInteraction, { passive: false, capture: true });
    }

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

    document.removeEventListener('wheel', preventScrollInteraction, { capture: true });
    document.removeEventListener('touchmove', preventScrollInteraction, { capture: true });
    unlockPageScroll();

    if (typeof state.dialog.close === 'function') {
      state.dialog.close();
    } else {
      state.dialog.removeAttribute('open');
    }
  }

  function handleCancel(event) {
    event.preventDefault();
  }

  function handleBackClick() {
    const backHref = String(state.dialog?.dataset.backHref || '').trim();

    closeDialog();

    if (state.onBack) {
      state.onBack();
      return;
    }

    if (backHref) {
      window.location.assign(backHref);
      return;
    }

    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.location.assign('../../dashboard/pages/home/index.html');
  }

  globalObject.APP_ACCESS_DENIED_DIALOG = Object.freeze({
    open,
    close: closeDialog,
    ensure: ensureDialog
  });
})(typeof globalThis !== 'undefined' ? globalThis : window);
