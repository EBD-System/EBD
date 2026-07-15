(function () {
  const ROUTE_SECTION_IDS = [
    'toolbar',
    'shortcutPanel',
    'summaryGrid',
    'actionsPanel',
    'reportsPanel',
    'registrationPanel',
    'studentsList',
    'emptyState',
  ];

  const ROUTE_LABELS = {
    root: 'Entrada',
    login: 'Login',
    turmas: 'Turmas',
    'turma-detail': 'Turma',
    chamada: 'Chamada',
    'abrir-chamada': 'Abrir chamada',
    inativos: 'Inativos',
  };
  function getAppBasePath() {
    const fromWindow = String(window.APP_BASE_PATH || '').trim();
    if (fromWindow) return fromWindow === '/' ? '/' : fromWindow.replace(/\/+$/, '');
    const baseUrl = String(window.APP_BASE_URL || window.location.origin + '/').trim();
    try {
      return new URL(baseUrl).pathname.replace(/\/+$/, '') || '/';
    } catch (err) {
      return '/';
    }
  }

  function buildRoutePath(path = '/') {
    const raw = String(path || '/').trim();
    const normalized = raw.startsWith('/') ? raw : `/${raw}`;
    const basePath = getAppBasePath();
    if (!basePath || basePath === '/') return normalized;
    return `${basePath}${normalized}`.replace(/\/+/g, '/');
  }

  function stripBasePath(pathname = window.location.pathname) {
    const cleanPath = String(pathname || '/').replace(/\/+$/, '') || '/';
    const basePath = getAppBasePath();
    if (!basePath || basePath === '/') return cleanPath || '/';

    const normalizedBase = basePath.replace(/\/+$/, '') || '/';
    if (cleanPath === normalizedBase) return '/';
    if (cleanPath.startsWith(`${normalizedBase}/`)) {
      return cleanPath.slice(normalizedBase.length) || '/';
    }
    return cleanPath || '/';
  }


  function routePortal() {
    let portal = document.getElementById('routePortal');
    if (portal) return portal;

    portal = document.createElement('section');
    portal.id = 'routePortal';
    portal.className = 'card panel route-portal';

    const hero = document.querySelector('.hero');
    if (hero?.parentElement) {
      hero.insertAdjacentElement('afterend', portal);
    } else {
      document.querySelector('.app')?.prepend(portal);
    }

    return portal;
  }

  function syncForgotPasswordDialog() {
    const dialog = document.getElementById('forgotPasswordDialog');
    if (!dialog || dialog.dataset.bound) return dialog;

    dialog.dataset.bound = '1';
    dialog.addEventListener('click', (event) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.dataset.action === 'close' || target === dialog)) {
        dialog.close?.();
      }
    });

    dialog.addEventListener('cancel', () => {
      dialog.close?.();
    });

    return dialog;
  }

  function setRouteVisibility(mode) {
    const hideDefault = ['toolbar', 'shortcutPanel', 'summaryGrid', 'actionsPanel', 'reportsPanel', 'registrationPanel', 'studentsList', 'emptyState'];
    const hideLogin = [...hideDefault];
    const hideList = ['toolbar', 'shortcutPanel', 'summaryGrid', 'actionsPanel', 'reportsPanel', 'registrationPanel', 'studentsList', 'emptyState'];
    const hideCall = [];

    const hiddenIds = mode === 'login'
      ? hideLogin
      : mode === 'list'
        ? hideList
        : hideCall;

    ROUTE_SECTION_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.hidden = hiddenIds.includes(id);
    });

    const hero = document.querySelector('.hero');
    if (hero) {
      hero.hidden = mode === 'login';
    }

    const portal = routePortal();
    portal.hidden = mode === 'call';
    portal.classList.toggle('route-portal--hidden', mode === 'call');
    portal.classList.toggle('route-portal--login', mode === 'login');
    document.body.dataset.routeMode = mode;
  }

  function setHeroCopy(title, description, badge = '') {
    const hero = document.querySelector('.hero');
    if (!hero) return;

    const badgeEl = hero.querySelector('.badge');
    const titleEl = hero.querySelector('.hero-copy h1');
    const descEl = hero.querySelector('.hero-copy p');

    if (badgeEl && badge !== '') {
      badgeEl.textContent = badge;
    }
    if (titleEl) {
      titleEl.textContent = title;
    }
    if (descEl) {
      descEl.textContent = description;
    }
  }

  function getStoredSession() {
    return getStoredAccessSession?.() || null;
  }

  function getResolvedAccessCode() {
    const queryCode = String(getAccessCodeFromUrl?.() || '').trim();
    if (queryCode) return queryCode;
    const session = getStoredSession();
    return String(
      session?.legacyAccessCode ||
      session?.accessCode ||
      session?.login ||
      state.accessCode ||
      ''
    ).trim();
  }

  function normalizeRoute() {
    const pathname = stripBasePath(window.location.pathname);
    const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean);

    if (!parts.length) return { name: 'root', params: {} };
    if (parts[0] === 'login') return { name: 'login', params: {} };
    if (parts[0] === 'turma' && parts[1]) return { name: 'turma-detail', params: { turmaRef: decodeURIComponent(parts[1]) } };
    if (parts[0] === 'turma') return { name: 'turmas', params: {} };
    if (parts[0] === 'chamada') return { name: 'chamada', params: {} };
    if (parts[0] === 'abrir-chamada') return { name: 'abrir-chamada', params: {} };
    if (parts[0] === 'inativos') return { name: 'inativos', params: {} };

    return { name: 'root', params: {} };
  }

  function resolveTurmaIdFromRef(ref) {
    const turmas = getTurmasSorted?.() || [];
    const raw = String(ref || '').trim();
    if (!raw) return '';

    const direct = turmas.find((turma) => String(turma.TurmaID || '') === raw || String(turma.Nome || '') === raw);
    if (direct) return direct.TurmaID;

    if (/^\d+$/.test(raw)) {
      const index = Number(raw) - 1;
      return turmas[index]?.TurmaID || '';
    }

    const lower = raw.toLowerCase();
    const bySlug = turmas.find((turma) => String(turma.Nome || '').toLowerCase().replace(/\s+/g, '-') === lower);
    return bySlug?.TurmaID || '';
  }

  function resolveRouteView(route) {
    if (route.name === 'turmas') return 'turmas';
    if (route.name === 'inativos') return 'inativos';
    return '';
  }

  function safeSetInnerHtml(el, html) {
    if (!el) return;
    el.innerHTML = html;
  }

  function renderLoginView() {
    const portal = routePortal();
    const session = getStoredSession();
    setRouteVisibility('login');
    portal.classList.add('route-portal--login');
    setHeroCopy(
      'Login',
      '',
      'EBD • Acesso'
    );

    const rememberedLogin = String(getRememberedLogin?.() || session?.login || getResolvedAccessCode() || '').trim();
    const rememberChecked = shouldRememberLogin?.() || !!rememberedLogin;

    safeSetInnerHtml(portal, `
      <section class="card route-login-card">
        <span class="badge">EBD • Acesso</span>
        <h1>Login</h1>
        <p class="route-login-card__subtitle">Entre com seu nome de usuário e senha para acessar o sistema.</p>

        <form id="routeLoginForm" class="route-login-form">
          <div class="field">
            <label for="routeLoginUser">Nome de usuário</label>
            <input id="routeLoginUser" type="text" autocomplete="username" placeholder="Nome de usuário" required />
          </div>

          <div class="field">
            <label for="routeLoginPassword">Senha</label>
            <input id="routeLoginPassword" type="password" autocomplete="current-password" placeholder="Senha" required />
          </div>

          <label class="route-login-remember">
            <input id="routeLoginRemember" type="checkbox" ${rememberChecked ? 'checked' : ''} />
            <span>Lembrar meu nome de usuário</span>
          </label>

          <div class="route-login-form__links">
            <button id="routeForgotPasswordBtn" class="route-login-link" type="button">Esqueci minha senha</button>
          </div>

          <div class="route-login-form__actions">
            <button class="btn btn--primary" type="submit">Entrar</button>
            <a class="btn btn--ghost" href="${escapeHtml(buildRoutePath('/cadastro/'))}">Criar cadastro</a>
          </div>
        </form>
      </section>

      <dialog id="forgotPasswordDialog" class="route-login-dialog">
        <div class="card route-login-dialog__card">
          <h2>Esqueci minha senha</h2>
          <p>Essa funcionalidade ainda não foi criada.</p>
          <div class="route-login-dialog__actions">
            <button id="routeForgotPasswordCloseBtn" class="btn btn--primary" type="button">Fechar</button>
          </div>
        </div>
      </dialog>
    `);

    const form = document.getElementById('routeLoginForm');
    const inputUser = document.getElementById('routeLoginUser');
    const inputPassword = document.getElementById('routeLoginPassword');
    const rememberInput = document.getElementById('routeLoginRemember');
    const forgotBtn = document.getElementById('routeForgotPasswordBtn');
    const dialog = syncForgotPasswordDialog();
    const dialogCloseBtn = document.getElementById('routeForgotPasswordCloseBtn');

    if (inputUser) {
      inputUser.value = rememberedLogin;
      inputUser.focus?.();
      inputUser.select?.();
    }
    if (inputPassword) {
      inputPassword.value = '';
    }

    if (form && !form.dataset.bound) {
      form.dataset.bound = '1';
      form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const login = String(inputUser?.value || '').trim();
        const senha = String(inputPassword?.value || '');
        const rememberUsername = !!rememberInput?.checked;
        if (!login) {
          showError('Digite seu nome de usuário.');
          return;
        }
        if (!senha) {
          showError('Digite sua senha.');
          return;
        }

        showBusy('Autenticando...');
        try {
          const result = await authLogin({ login, senha }, { timeoutMs: 30000 });
          const data = result?.data || {};
          const user = data.user || data.usuario || {};

          persistAccessSession({
            userId: user.id_usuario ?? user.userId ?? user.id ?? null,
            login: user.login || login,
            nome: user.pessoa_nome || user.nome || user.name || login,
            perfis: user.profiles || user.perfis || user.perfil || [],
            token: data.token || data.accessToken || user.token || '',
            accessToken: data.token || data.accessToken || user.token || '',
            accessMode: inferAccessModeFromProfiles(user.profiles || user.perfis || user.perfil || []),
          });

          if (typeof setRememberedLogin === 'function') {
            setRememberedLogin(login, rememberUsername);
          }

          showSuccess(result.message || 'Login realizado com sucesso.');
          navigateTo('/chamada', { replace: true });
        } catch (err) {
          showError(formatAppError(err, 'Login'));
        } finally {
          hideLoading?.();
        }
      });
    }

    if (forgotBtn && !forgotBtn.dataset.bound) {
      forgotBtn.dataset.bound = '1';
      forgotBtn.addEventListener('click', () => {
        if (dialog?.showModal) {
          dialog.showModal();
        } else {
          window.alert('Essa funcionalidade ainda não foi criada.');
        }
      });
    }

    if (dialogCloseBtn && !dialogCloseBtn.dataset.bound) {
      dialogCloseBtn.dataset.bound = '1';
      dialogCloseBtn.addEventListener('click', () => {
        dialog?.close?.();
      });
    }
  }



  function renderTurmasView(data) {
    const portal = routePortal();
    setRouteVisibility('list');
    setHeroCopy(
      'Turmas',
      'Visualização leve das turmas cadastradas, com atalho para abrir o detalhe de cada uma.',
      'EBD • Navegação'
    );

    const turmas = Array.isArray(data?.turmas) ? data.turmas : [];
    const cards = turmas.length
      ? turmas.map((turma, index) => {
          const ref = index + 1;
          const ativos = Number(turma.alunosAtivos || 0);
          const inativos = Number(turma.alunosInativos || 0);
          const total = Number(turma.totalAlunos || ativos + inativos);
          return `
            <article class="student card route-card">
              <div class="student__main">
                <div class="student__identity">
                  <div class="student__titleRow">
                    <strong class="student-name">${escapeHtml(turma.Nome || turma.TurmaID || 'Turma')}</strong>
                    <button class="btn btn--soft" type="button" data-route="/turma/${ref}">Abrir</button>
                  </div>
                  <div class="student-code">ID: ${escapeHtml(String(turma.TurmaID || ref))}</div>
                  <div class="student-badges">
                    <span class="badge">${total} alunos</span>
                    <span class="badge">${ativos} ativos</span>
                    <span class="badge">${inativos} inativos</span>
                  </div>
                </div>
              </div>
            </article>`;
        }).join('')
      : '<div class="empty-state">Nenhuma turma encontrada.</div>';

    safeSetInnerHtml(portal, `
      <div class="panel__head">
        <div>
          <h2>Lista de turmas</h2>
          <p>Selecione uma turma para abrir sua página dedicada.</p>
        </div>
      </div>
      <div class="students-list route-list">${cards}</div>
    `);
  }

  function renderInativosView(data) {
    const portal = routePortal();
    setRouteVisibility('list');
    setHeroCopy(
      'Alunos inativos',
      'Lista isolada dos alunos inativos, separada da navegação principal da chamada.',
      'EBD • Consulta'
    );

    const inativos = Array.isArray(data?.inativos) ? data.inativos : [];
    const cards = inativos.length
      ? inativos.map((aluno) => {
          const alunoId = String(aluno.AlunoID || aluno.id_aluno || '');
          const editUrl = typeof buildStudentEditPageUrl === 'function'
            ? buildStudentEditPageUrl(aluno.Nome || alunoId)
            : `aluno/editar-aluno/?alunoId=${encodeURIComponent(alunoId)}`;
          return `
            <article class="student card route-card">
              <div class="student__main">
                <div class="student__identity">
                  <div class="student__titleRow">
                    <strong class="student-name">${escapeHtml(aluno.Nome || 'Aluno')}</strong>
                    <a class="btn btn--soft" href="${escapeHtml(editUrl)}">Editar</a>
                  </div>
                  <div class="student-code">Turma: ${escapeHtml(aluno.TurmaNome || aluno.TurmaID || '—')}</div>
                  <div class="student-badges">
                    <span class="badge">Inativo</span>
                    <span class="badge">${escapeHtml(aluno.Motivo || aluno.motivo_desligamento || 'Sem motivo')}</span>
                  </div>
                </div>
              </div>
            </article>`;
        }).join('')
      : '<div class="empty-state">Nenhum aluno inativo encontrado.</div>';

    safeSetInnerHtml(portal, `
      <div class="panel__head">
        <div>
          <h2>Alunos inativos</h2>
          <p>Consulta separada para revisar os registros desativados sem carregar a chamada completa.</p>
        </div>
      </div>
      <div class="students-list route-list">${cards}</div>
    `);
  }

  function renderCallView(route) {
    const portal = routePortal();
    const isPrepRoute = route.name === 'abrir-chamada';
    setRouteVisibility('call');
    setHeroCopy(
      'Regras:',
      'Presente = P • Atrasado = P • Ausente = F • Atrasado conta como presença • 4 faltas consecutivas = inativo • Relatórios parcial e geral enviados ao WhatsApp',
      'EBD • A.D. DOIS DE JULHO'
    );
    portal.hidden = !isPrepRoute;
    safeSetInnerHtml(portal, isPrepRoute
      ? `
        <div class="panel__head">
          <div>
            <h2>Abrir chamada</h2>
            <p>Use esta etapa para preparar a chamada do dia antes de preencher os registros.</p>
          </div>
        </div>
      `
      : '');

    if (typeof renderAll === 'function') {
      renderAll();
    }
  }

  async function loadRouteData(route) {
    const view = resolveRouteView(route);
    const turmaId = route.name === 'turma-detail' ? resolveTurmaIdFromRef(route.params.turmaRef) : '';

    if (!view) {
      await refreshFromBackend(false, { silent: false, preferLocal: true, view: '', turmaId: turmaId || '' });
      if (route.name === 'turma-detail' && turmaId) {
        state.selectedTurmaId = turmaId;
      }
      return;
    }

    await refreshFromBackend(false, { silent: false, preferLocal: false, view, turmaId: '' });
  }

  function syncSessionFromUrl() {
    const queryCode = String(getAccessCodeFromUrl?.() || '').trim();
    if (queryCode) {
      persistAccessSession(queryCode);
      const cleanPath = window.location.pathname || '/';
      window.history.replaceState({}, document.title, cleanPath);
      return queryCode;
    }

    const session = getStoredSession();
    if (session) {
      state.session = session;
      state.accessCode = String(session.legacyAccessCode || session.accessCode || session.login || '').trim();
      state.accessMode = String(session.accessMode || resolveAccessMode(session)).trim().toLowerCase();
      applyAccessMode();
      renderResponsavelLabel?.();
      return state.accessCode;
    }

    return '';
  }

  function ensureSessionForRoute(route) {
    if (route.name === 'login') return true;
    const session = getStoredSession();
    if (session && (session.accessCode || session.legacyAccessCode || session.login || session.userId !== null)) {
      return true;
    }
    return false;
  }

  function navigateTo(path, { replace = false } = {}) {
    const nextPath = String(path || '/').trim() || '/';
    if (replace) {
      window.history.replaceState({}, '', buildRoutePath(nextPath));
    } else {
      window.history.pushState({}, '', buildRoutePath(nextPath));
    }
    start();
  }

  async function start() {
    syncSessionFromUrl();
    const route = normalizeRoute();
    state.routeName = route.name;
    state.routeParams = route.params;

    if (route.name === 'root') {
      if (getStoredSession()) {
        navigateTo('/chamada', { replace: true });
      } else {
        navigateTo('/login', { replace: true });
      }
      return;
    }

    if (!ensureSessionForRoute(route)) {
      navigateTo('/login', { replace: true });
      return;
    }

    if (route.name === 'login') {
      state.session = getStoredSession();
      state.accessCode = String(state.session?.legacyAccessCode || state.session?.accessCode || state.session?.login || '').trim();
      state.accessMode = String(state.session?.accessMode || resolveAccessMode(state.session || state.accessCode)).trim().toLowerCase();
      applyAccessMode();
      renderResponsavelLabel?.();

      if (state.session && (state.session.accessCode || state.session.legacyAccessCode || state.session.login || state.session.userId !== null)) {
        navigateTo('/chamada', { replace: true });
        return;
      }

      renderLoginView();
      return;
    }

    if (state.routeLoading) return;
    state.routeLoading = true;

    try {
      await loadRouteData(route);

      if (route.name === 'turmas') {
        renderTurmasView(state.routeData);
        return;
      }

      if (route.name === 'inativos') {
        renderInativosView(state.routeData);
        return;
      }

      if (route.name === 'turma-detail' && state.routeParams?.turmaRef) {
        const selectedId = resolveTurmaIdFromRef(state.routeParams.turmaRef);
        if (selectedId) {
          state.selectedTurmaId = selectedId;
        }
      }

      renderCallView(route);
    } finally {
      state.routeLoading = false;
    }
  }

  window.AppRouter = {
    start,
    navigate: navigateTo,
    refreshCurrentRoute: start,
  };

  window.addEventListener('popstate', () => {
    state.routerStarted = false;
    start();
  });

  document.addEventListener('click', (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target) return;

    const routeTarget = target.closest('[data-route]');
    if (routeTarget instanceof HTMLElement) {
      event.preventDefault();
      navigateTo(routeTarget.dataset.route || '/');
      return;
    }
  });
})();
