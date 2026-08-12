const STORAGE_KEYS = window.APP_STORAGE_KEYS;

const AUTH_STORAGE = window.APP_AUTH_STORAGE;
const APP_CONFIG = window.APP_CONFIG || {};

const navGrid = document.getElementById('navGrid');
const logoutButton = document.getElementById('logoutButton');
const sessionLabel = document.getElementById('sessionLabel');

const navigationItems = [
  {
    title: 'Alunos',
    description: 'Gerencie cadastros, vínculos e histórico dos alunos.',
    icon: 'A',
    href: '../../../aluno/pages/index.html'
  },
  {
    title: 'Chamada',
    description: 'Acesse presença de alunos e visitantes com rapidez.',
    icon: 'C',
    href: '../../../chamada/pages/index.html'
  },
  {
    title: 'Classes',
    description: 'Veja as classes disponíveis e selecione uma delas.',
    icon: 'CL',
    href: '../../../classe/pages/index.html'
  },
  {
    title: 'Gerar escala',
    description: 'Monte a escala dos domingos do ano.',
    icon: 'E',
    href: '../../../gerar-escala/index.html',
    alwaysVisible: true
  },
  {
    title: 'Relatórios',
    description: 'Entre nos relatórios consolidados e análises operacionais.',
    icon: 'R',
    href: '../../../relatorios/pages/index.html'
  },
  {
    title: 'Cadastro',
    description: 'Abra o fluxo de registro e manutenção cadastral.',
    icon: '+',
    href: '../../../cadastro/pages/index.html'
  },
  {
    title: 'Usuários',
    description: 'Navegue pelo gerenciamento de acesso e perfis de login.',
    icon: 'U',
    href: '../../../usuario/pages/index.html'
  },
  {
    title: 'Pessoas',
    description: 'Consulte e mantenha os dados cadastrais de pessoas.',
    icon: 'P',
    href: '../../../pessoa/pages/index.html'
  },
  {
    title: 'Perfis',
    description: 'Acesse a área de perfis e permissões do sistema.',
    icon: 'PR',
    href: '../../../perfil/pages/index.html'
  },
  {
    title: 'Visitantes',
    description: 'Gerencie registros rápidos de visitantes do ambiente.',
    icon: 'V',
    href: '../../../visitante/pages/index.html'
  },
  {
    title: 'Configurações',
    description: 'Abra os ajustes gerais do sistema administrativo.',
    icon: '⚙',
    href: '../../../configuracoes/pages/index.html'
  }
];

const session = readSession();
if (!session.token) {
  goToLogin();
} else {
  renderSession(session);
  renderNavigation();
}

logoutButton.addEventListener('click', handleLogout);

function readSession() {
  try {
    const token = AUTH_STORAGE.readToken(STORAGE_KEYS.token);
    const rememberedUsername = window.localStorage.getItem(STORAGE_KEYS.username) || '';
    return {
      token,
      user: rememberedUsername
    };
  } catch {
    return { token: '' };
  }
}

function renderSession(currentSession) {
  const label = currentSession.user ? `Conectado como ${currentSession.user}` : 'Sessão ativa';
  sessionLabel.textContent = label;
}

function shouldShowNavigationItem(item) {
  if (item.alwaysVisible) {
    return true;
  }

  if (typeof APP_CONFIG.isVisibleModule === 'function' && !APP_CONFIG.isVisibleModule(item.title)) {
    return false;
  }

  if (APP_CONFIG.developmentMode !== false) {
    return true;
  }

  const allowedTitles = APP_CONFIG.developmentVisibleModuleTitles || ['Classes', 'Relatórios'];
  return allowedTitles.includes(item.title);
}


function renderNavigation() {
  const visibleItems = navigationItems.filter(shouldShowNavigationItem);

  navGrid.innerHTML = visibleItems
    .map(
      (item) => `
        <a class="nav-card" href="${item.href}">
          <span class="nav-card__icon" aria-hidden="true">${item.icon}</span>
          <h4 class="nav-card__title">${item.title}</h4>
          <p class="nav-card__description">${item.description}</p>
          <span class="nav-card__footer">Abrir módulo →</span>
        </a>
      `
    )
    .join('');
}

function handleLogout() {
  AUTH_STORAGE.clearToken(STORAGE_KEYS.token);
  goToLogin();
}

function goToLogin() {
  window.location.replace('../../../../../index.html');
}
