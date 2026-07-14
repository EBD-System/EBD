// Configure a URL da API HTTP que conversa com PostgreSQL.
// TODO: conectar o site a um backend real que exponha o banco de dados.
const BACKEND_API_URL = window.BACKEND_API_URL || window.API_BASE_URL || '';

const STORAGE_KEY = 'prb_presenca_turmas_v2';
const ROSTER_CACHE_KEY = 'prb_roster_cache_v1';
const ROSTER_CACHE_VERSION = 1;
const DEBUG_CONSOLE_ACCESS_CODE = '50292230';

// Base path when hosted on GitHub Pages.
const APP_BASE_PATH = '/EBD';

// Temporary development bypass while authentication is not complete.
const DEV_BYPASS_AUTH = true;

const NORMALIZED_APP_BASE_PATH = String(APP_BASE_PATH || '').trim().replace(/\/+$/, '');

function splitRouteSuffix(input = '') {
  const raw = String(input || '').trim();
  const hashIndex = raw.indexOf('#');
  const queryIndex = raw.indexOf('?');

  let pathEnd = raw.length;
  if (queryIndex !== -1) pathEnd = Math.min(pathEnd, queryIndex);
  if (hashIndex !== -1) pathEnd = Math.min(pathEnd, hashIndex);

  return {
    path: raw.slice(0, pathEnd) || '/',
    query: queryIndex !== -1
      ? raw.slice(queryIndex, hashIndex !== -1 && hashIndex > queryIndex ? hashIndex : raw.length)
      : '',
    hash: hashIndex !== -1 ? raw.slice(hashIndex) : '',
  };
}

function stripAppBasePath(pathname = window.location.pathname) {
  const raw = String(pathname || '/').replace(/\/+/g, '/');
  const clean = raw.replace(/\/+$/, '') || '/';

  if (!NORMALIZED_APP_BASE_PATH) return clean;
  if (clean === NORMALIZED_APP_BASE_PATH) return '/';
  if (clean.startsWith(`${NORMALIZED_APP_BASE_PATH}/`)) {
    const next = clean.slice(NORMALIZED_APP_BASE_PATH.length);
    return next || '/';
  }

  return clean;
}

function buildAppPath(path = '/') {
  const { path: rawPath, query, hash } = splitRouteSuffix(path);
  let normalized = String(rawPath || '/').replace(/\/+/g, '/').trim() || '/';

  if (!normalized.startsWith('/')) normalized = `/${normalized}`;
  normalized = normalized.replace(/\/+$/, '') || '/';

  if (normalized === '/index.html' || normalized === '/index') {
    normalized = '/';
  }

  if (NORMALIZED_APP_BASE_PATH && normalized.startsWith(`${NORMALIZED_APP_BASE_PATH}/`)) {
    normalized = normalized.slice(NORMALIZED_APP_BASE_PATH.length) || '/';
  }

  const finalPath = NORMALIZED_APP_BASE_PATH
    ? `${NORMALIZED_APP_BASE_PATH}${normalized === '/' ? '/' : normalized}`
    : normalized;

  return `${finalPath}${query}${hash}`;
}

// Se false, o carregamento inicial usa somente o que vem do backend.
// Se true, o rascunho local pode voltar a ser aplicado quando existir.
const APPLY_LOCAL_DRAFTS_ON_LOAD = false;

function isDebugConsoleEnabled(accessCode = state.accessCode) {
  return String(accessCode || '').trim() === DEBUG_CONSOLE_ACCESS_CODE;
}

function syncDebugConsoleVisibility() {
  const enabled = isDebugConsoleEnabled();
  if (document?.body) {
    document.body.classList.toggle('debug-console-enabled', enabled);
  }
  const consoleBox = document.getElementById('debugConsole');
  if (consoleBox) {
    consoleBox.hidden = !enabled;
  }
  return enabled;
}

function todayKey() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(Date.now() - tz).toISOString().slice(0, 10);
}

const state = {
  syncToken: 0,
  loading: false,
  dateKey: todayKey(),
  turmas: [],
  alunos: [],
  chamadasByTurma: {},
  resumoGeral: null,
  selectedTurmaId: '',
  search: '',
  showInactive: true,
  dirty: false,
  initialized: false,
  autosaveTimer: null,
  editingAlunoId: '',
  accessCode: '',
  accessMode: 'self',
  selfCelularSuffix: '',
  baseRowsCount: 0,
  routeName: '',
  routeParams: {},
  routeData: null,
  inativos: [],
  routerStarted: false,
  session: null,
};

const ACCESS_CODES = {
  full: new Set(['50292230']),
  restricted: new Set(['ninha', 'cleverton', 'larissa', 'taiz', 'alais', 'samuel']),
};

const els = {
  dateInput: document.getElementById('dateInput'),
  turmaSelect: document.getElementById('turmaSelect'),
  alunoTurma: document.getElementById('alunoTurma'),
  searchInput: document.getElementById('searchInput'),
  responsavelLabel: document.getElementById('responsavelLabel'),
  showInactive: document.getElementById('showInactive'),
  reloadBtn: document.getElementById('reloadBtn'),
  clearBtn: document.getElementById('clearBtn'),
  addAlunoPageBtn: document.getElementById('addAlunoPageBtn'),
  saveBtn: document.getElementById('saveBtn'),
  sendTurmaBtn: document.getElementById('sendTurmaBtn'),
  sendGeralBtn: document.getElementById('sendGeralBtn'),
  saveNextBtn: document.getElementById('saveNextBtn'),
  markAllPresentBtn: document.getElementById('markAllPresentBtn'),
  markAllAbsentBtn: document.getElementById('markAllAbsentBtn'),
  copyTurmaBtn: document.getElementById('copyTurmaBtn'),
  copyGeralBtn: document.getElementById('copyGeralBtn'),
  turmaForm: document.getElementById('turmaForm'),
  turmaNome: document.getElementById('turmaNome'),
  turmaOrdem: document.getElementById('turmaOrdem'),
  alunoForm: document.getElementById('alunoForm'),
  alunoNome: document.getElementById('alunoNome'),
  alunoCelular: document.getElementById('alunoCelular'),
  studentEditModal: document.getElementById('studentEditModal'),
  studentEditForm: document.getElementById('studentEditForm'),
  studentEditTitle: document.getElementById('studentEditTitle'),
  studentEditCode: document.getElementById('studentEditCode'),
  studentEditName: document.getElementById('studentEditName'),
  studentEditCelular: document.getElementById('studentEditCelular'),
  studentEditTurma: document.getElementById('studentEditTurma'),
  studentEditStatus: document.getElementById('studentEditStatus'),
  studentEditCancel: document.getElementById('studentEditCancel'),
  feedback: document.getElementById('feedback'),
  turmaMeta: document.getElementById('turmaMeta'),
  summary: {
    total: document.getElementById('statTotalAlunos'),
    presentes: document.getElementById('statPresentes'),
    ausentes: document.getElementById('statAusentes'),
    percentual: document.getElementById('statPercentual'),
    oferta: document.getElementById('statOferta'),
    visitantes: document.getElementById('statVisitantes'),
    biblias: document.getElementById('statBiblias'),
    revistas: document.getElementById('statRevistas'),
  },
  studentsList: document.getElementById('studentsList'),
  emptyState: document.getElementById('emptyState'),
  studentTemplate: document.getElementById('studentTemplate'),
  turmaReport: document.getElementById('turmaReport'),
  geralReport: document.getElementById('geralReport'),
};

let loadingCount = 0;
let loadingWatchdog = null;
let loadingWatchdogMessage = 'A operação demorou demais. Tente novamente.';
