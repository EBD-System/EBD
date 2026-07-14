// Configure a URL da API HTTP que conversa com PostgreSQL.
// TODO: conectar o site a um backend real que exponha o banco de dados.
const BACKEND_API_URL = window.BACKEND_API_URL || window.API_BASE_URL || '';

const STORAGE_KEY = 'prb_presenca_turmas_v2';
const ROSTER_CACHE_KEY = 'prb_roster_cache_v1';
const ROSTER_CACHE_VERSION = 1;
const DEBUG_CONSOLE_ACCESS_CODE = '50292230';

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
