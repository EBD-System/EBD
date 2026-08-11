const params = new URLSearchParams(window.location.search);
const className = params.get('className') || 'Classe selecionada';
const classId = normalizeClassId(params.get('classId'));

const API_CONFIG = window.APP_CONFIG;
const STORAGE_KEYS = window.APP_STORAGE_KEYS;
const AUTH_STORAGE = window.APP_AUTH_STORAGE;
const APP_API_CLIENT = window.APP_API_CLIENT;
const API_BASE_URL =
  typeof API_CONFIG.resolveApiBaseUrl === 'function'
    ? API_CONFIG.resolveApiBaseUrl()
    : `${window.location.protocol}//${window.location.hostname}${window.location.port ? `:${window.location.port}` : ''}/api/v1`;
const ATTENDANCE_CALL_QUERY_KEY = 'callId';
const ATTENDANCE_STATUSES = ['presente', 'atrasado', 'ausente'];
const ATTENDANCE_LABELS = {
  presente: 'Presente',
  atrasado: 'Atrasado',
  ausente: 'Ausente'
};

const classLabel = document.getElementById('classLabel');
const addStudentButton = document.getElementById('addStudentButton');
const saveAttendanceButtonBottom = document.getElementById('saveAttendanceButtonBottom');
const studentsTitle = document.getElementById('studentsTitle');
const studentsCounter = document.getElementById('studentsCounter');
const attendanceSummary = document.getElementById('attendanceSummary');
const activeTabButton = document.getElementById('activeTabButton');
const inactiveTabButton = document.getElementById('inactiveTabButton');
const activeCount = document.getElementById('activeCount');
const inactiveCount = document.getElementById('inactiveCount');
const studentsList = document.getElementById('studentsList');
const attendanceFeedback = document.getElementById('attendanceFeedback');
const classOfferInput = document.getElementById('classOfferInput');
const classVisitorsInput = document.getElementById('classVisitorsInput');
const classBiblesInput = document.getElementById('classBiblesInput');
const classMagazinesInput = document.getElementById('classMagazinesInput');
const ATTENDANCE_SUMMARY_ENDPOINTS = [
  (selectedClassId) => `/attendance/classes/${encodeURIComponent(selectedClassId)}/summary`,
  (selectedClassId) => `/classes/${encodeURIComponent(selectedClassId)}/attendance/summary`
];
let studentsListEventsBound = false;
let classSummaryEventsBound = false;
const dialog = document.getElementById('addStudentDialog');
const dialogTitle = document.getElementById('dialogTitle');
const dialogCloseButton = document.getElementById('dialogCloseButton');
const cancelButton = document.getElementById('cancelButton');
const deleteButton = document.getElementById('deleteButton');
const addStudentForm = document.getElementById('addStudentForm');
const formFeedback = document.getElementById('formFeedback');
const submitButton = document.getElementById('submitButton');

const studentNameInput = document.getElementById('studentName');
const studentSexInput = document.getElementById('studentSex');
const studentCpfInput = document.getElementById('studentCpf');
const studentBirthDateInput = document.getElementById('studentBirthDate');
const studentPhoneInput = document.getElementById('studentPhone');
const studentEmailInput = document.getElementById('studentEmail');
const studentStreetInput = document.getElementById('studentStreet');
const studentNumberInput = document.getElementById('studentNumber');
const studentNeighborhoodInput = document.getElementById('studentNeighborhood');
const studentCityInput = document.getElementById('studentCity');
const studentStateInput = document.getElementById('studentState');
const studentZipCodeInput = document.getElementById('studentZipCode');
const studentObservationInput = document.getElementById('studentObservation');
const studentEnrollmentInput = document.getElementById('studentEnrollment');
const studentStartDateInput = document.getElementById('studentStartDate');
const studentStartDateNote = document.getElementById('studentStartDateNote');
const studentActiveToggleInput = document.getElementById('studentActiveToggle');
const studentStatusControl = document.getElementById('studentStatusControl');
const studentStatusValue = document.getElementById('studentStatusValue');
const studentStatusHelp = document.getElementById('studentStatusHelp');
const studentDataTitle = document.getElementById('studentDataTitle');

const state = {
  students: [],
  currentTab: 'ativo',
  inactiveReasonMap: new Map(),
  inactiveReasonsLoading: false,
  inactiveReasonsLoaded: false,
  loadingStudents: false,
  attendanceCallId: '',
  attendanceLoading: false,
  attendanceSaving: false,
  attendanceOriginalMap: new Map(),
  attendanceDraftMap: new Map(),
  attendanceReady: false,
  classSummaryOriginal: null,
  classSummaryLoaded: false,
  studentDialogMode: 'create',
  studentDialogKey: ''
};

const sessionToken = readSessionToken();
if (!sessionToken) {
  goToLogin();
} else {
  initializePage();
}

function readAttendanceCallIdFromUrl() {
  try {
    return new URLSearchParams(window.location.search).get(ATTENDANCE_CALL_QUERY_KEY)?.trim() || '';
  } catch {
    return '';
  }
}

function updateAttendanceCallIdInUrl(callId) {
  try {
    const url = new URL(window.location.href);
    if (callId) {
      url.searchParams.set(ATTENDANCE_CALL_QUERY_KEY, String(callId));
    } else {
      url.searchParams.delete(ATTENDANCE_CALL_QUERY_KEY);
    }
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // ignore URL update failures
  }
}

function syncAttendanceCallId(callId, { updateUrl = true } = {}) {
  const normalized = String(callId ?? '').trim();
  state.attendanceCallId = normalized;
  if (updateUrl) {
    updateAttendanceCallIdInUrl(normalized);
  }
  return normalized;
}

function initializePage() {
  classLabel.textContent = className;

  const urlCallId = readAttendanceCallIdFromUrl();
  if (urlCallId) {
    state.attendanceCallId = urlCallId;
  }

  updateStudentDialogCopy('create');

  bindClassSummaryEvents();
  syncClassSummaryInputs({ clampDependents: true });
  bindStudentsListEvents();
  addStudentButton.addEventListener('click', () => openStudentDialog('create'));
  saveAttendanceButtonBottom.addEventListener('click', handleSaveAttendance);
  dialogCloseButton.addEventListener('click', closeDialog);
  cancelButton.addEventListener('click', closeDialog);
  deleteButton.addEventListener('click', handleDeleteStudent);
  dialog.addEventListener('click', handleBackdropClick);
  addStudentForm.addEventListener('submit', handleStudentFormSubmit);

  activeTabButton.addEventListener('click', () => switchTab('ativo'));
  inactiveTabButton.addEventListener('click', () => switchTab('inativo'));

  for (const field of getFormFields()) {
    field.addEventListener('input', () => clearFieldState(field));
    field.addEventListener('change', () => clearFieldState(field));
  }

  studentActiveToggleInput?.addEventListener('change', () => {
    updateStudentStatusToggleVisual(studentActiveToggleInput.checked);
  });

  if (!hasValidClassId()) {
    renderEmptyState('Selecione uma classe para carregar os alunos.');
    updateCounters();
    updateAttendanceSummary();
    return;
  }

  void loadStudentsAndAttendance();
}

function switchTab(tab) {
  if (state.currentTab === tab) return;
  state.currentTab = tab;
  renderStudents();

  if (tab === 'inativo' && !state.inactiveReasonsLoaded && !state.inactiveReasonsLoading) {
    void preloadInactiveReasons();
  }
}

async function loadStudentsAndAttendance() {
  state.loadingStudents = true;
  state.attendanceLoading = true;
  state.inactiveReasonMap = new Map();
  state.inactiveReasonsLoading = false;
  state.inactiveReasonsLoaded = false;
  renderLoadingState('Carregando alunos e presença da classe...');

  try {
    const [activeResult, inactiveResult] = await Promise.allSettled([
      fetchStudentsForStatus('ativo'),
      fetchStudentsForStatus('inativo')
    ]);

    const activeStudents = activeResult.status === 'fulfilled' ? normalizeStudents(activeResult.value.payload) : [];
    const inactiveStudents = inactiveResult.status === 'fulfilled' ? normalizeStudents(inactiveResult.value.payload) : [];
    state.students = mergeStudentsByEnrollmentStatus(activeStudents, inactiveStudents);

    const urlCallId = readAttendanceCallIdFromUrl();
    if (urlCallId) {
      state.attendanceCallId = urlCallId;
    }

    const opened = await ensureAttendanceCall();
    if (opened.callId) {
      syncAttendanceCallId(opened.callId);
    }

    let snapshot = await fetchAttendanceSnapshot();

    if (!snapshot.callId && state.attendanceCallId) {
      snapshot.callId = state.attendanceCallId;
    }

    if (!snapshot.callId && opened.callId) {
      snapshot.callId = opened.callId;
    }

    if (!snapshot.callId) {
      const refreshed = await fetchAttendanceSnapshot();
      snapshot.callId = refreshed.callId || snapshot.callId;
      if (refreshed.records.length) {
        snapshot.records = refreshed.records;
      }
    }

    if (snapshot.callId) {
      syncAttendanceCallId(snapshot.callId);
    } else if (state.attendanceCallId) {
      syncAttendanceCallId(state.attendanceCallId, { updateUrl: false });
    }

    reconcileAttendanceState(snapshot.records);
    await loadClassSummary();
    state.attendanceReady = true;
    updateCounters();
    renderStudents();
    void preloadInactiveReasons();
  } catch (error) {
    const message = error?.message || 'Não foi possível carregar os alunos agora.';
    renderErrorState(message);

    if (/401/.test(message)) {
      clearStoredToken();
      window.setTimeout(goToLogin, 350);
    }
  } finally {
    state.loadingStudents = false;
    state.attendanceLoading = false;
    updateCounters();
    renderStudents();
    updateAttendanceSummary();
    updateSaveButtonsState();
  }
}

async function fetchStudentsForStatus(status) {
  const normalizedStatus = String(status || '').trim().toLowerCase();
  const encodedClassId = encodeURIComponent(classId);
  const encodedStatus = encodeURIComponent(normalizedStatus);
  const paths = normalizedStatus === 'inativo'
    ? [
        `/students?classId=${encodedClassId}&status=${encodedStatus}`,
        `/students/inactive?classId=${encodedClassId}`,
        `/students/inactive`,
        `/classes/${encodedClassId}/students?status=${encodedStatus}`,
        `/classes/${encodedClassId}/students`
      ]
    : [
        `/students?classId=${encodedClassId}&status=${encodedStatus}`,
        `/classes/${encodedClassId}/students?status=${encodedStatus}`,
        `/classes/${encodedClassId}/students`
      ];

  let lastError = null;

  for (const path of paths) {
    try {
      return await apiRequest(path);
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  return { payload: [] };
}


function mergeStudentsByEnrollmentStatus(...groups) {
  const merged = new Map();

  for (const group of groups) {
    for (const student of group || []) {
      const key = String(student?.attendanceKey || student?.studentClassId || student?.id || '').trim();
      if (!key) continue;

      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, student);
        continue;
      }

      const existingStatus = normalizeEnrollmentStatus(existing.raw || existing);
      const nextStatus = normalizeEnrollmentStatus(student.raw || student);

      if (existingStatus === 'inativo' && nextStatus !== 'inativo') {
        merged.set(key, mergeStudentRecords(existing, student));
        continue;
      }

      if (nextStatus === 'inativo' && existingStatus !== 'inativo') {
        merged.set(key, mergeStudentRecords(existing, student));
        continue;
      }

      merged.set(key, mergeStudentRecords(existing, student));
    }
  }

  return [...merged.values()];
}

function mergeStudentRecords(existing, student) {
  const mergedRaw = mergeStudentRawRecords(existing?.raw, student?.raw);
  const mergedAttendanceKey =
    extractStudentClassId(student) ||
    extractStudentClassId(mergedRaw) ||
    extractStudentClassId(existing) ||
    String(existing?.attendanceKey || '').trim() ||
    String(student?.attendanceKey || '').trim();

  const existingId = String(existing?.id || '').trim();
  const nextId = String(student?.id || '').trim();
  const mergedId = nextId || existingId;

  const existingPersonId = String(existing?.personId || '').trim();
  const nextPersonId = String(student?.personId || '').trim();
  const mergedPersonId = nextPersonId || existingPersonId;

  const merged = {
    ...existing,
    ...student,
    id: mergedId,
    personId: mergedPersonId,
    raw: mergedRaw
  };

  syncStudentAttendanceKey(merged, mergedAttendanceKey);
  return merged;
}

function mergeStudentRawRecords(existingRaw, nextRaw) {
  if (!existingRaw && !nextRaw) return {};
  if (!existingRaw) return { ...(nextRaw && typeof nextRaw === 'object' ? nextRaw : {}) };
  if (!nextRaw) return { ...(existingRaw && typeof existingRaw === 'object' ? existingRaw : {}) };

  return {
    ...(existingRaw && typeof existingRaw === 'object' ? existingRaw : {}),
    ...(nextRaw && typeof nextRaw === 'object' ? nextRaw : {})
  };
}

function syncStudentAttendanceKey(student, attendanceKey) {
  const normalized = String(attendanceKey ?? '').trim();
  if (!student || typeof student !== 'object' || !normalized) {
    return normalized;
  }

  student.attendanceKey = normalized;
  student.studentClassId = normalized;
  student.id_aluno_classe = normalized;
  student.idAlunoClasse = normalized;
  student.id_aluno_turma = normalized;
  student.idAlunoTurma = normalized;
  student.classStudentId = normalized;

  if (student.raw && typeof student.raw === 'object') {
    student.raw.id_aluno_classe = normalized;
    student.raw.idAlunoClasse = normalized;
    student.raw.id_aluno_turma = normalized;
    student.raw.idAlunoTurma = normalized;
    student.raw.studentClassId = normalized;
    student.raw.classStudentId = normalized;
  }

  return normalized;
}


async function fetchAttendanceSnapshot() {
  const query = `date=${encodeURIComponent(getBusinessISODate())}`;
  const paths = [
    `/classes/${classId}/attendance?${query}`,
    `/attendance/classes/${classId}?${query}`
  ];

  let lastError = null;

  for (const path of paths) {
    try {
      const result = await apiRequest(path);
      const snapshot = extractAttendanceContext(result.payload);
      if (snapshot.callId) {
        syncAttendanceCallId(snapshot.callId);
      }
      return snapshot;
    } catch (error) {
      if (error?.status === 401) {
        throw error;
      }

      if (error?.status !== 404) {
        lastError = error;
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  return { callId: '', records: [] };
}

async function ensureAttendanceCall() {
  try {
    const result = await apiRequest('/attendance/open', {
      method: 'POST',
      body: {
        classId
      }
    });

    const opened = extractAttendanceContext(result.payload);
    if (opened.callId) {
      syncAttendanceCallId(opened.callId);
    }
    return opened;
  } catch (error) {
    if (error?.status === 409 || error?.status === 400) {
      return { callId: '', records: [] };
    }

    throw error;
  }
}

async function preloadInactiveReasons() {
  const inactiveStudents = state.students.filter((student) => isInactiveStudent(student));

  if (!inactiveStudents.length) {
    state.inactiveReasonsLoaded = true;
    return;
  }

  state.inactiveReasonsLoading = true;

  try {
    const studentsWithoutReason = inactiveStudents.filter((student) => !getStudentInactiveReason(student));
    const ids = [...new Set(studentsWithoutReason.map((student) => String(student.id ?? '').trim()).filter(Boolean))];

    if (ids.length > 0) {
      try {
        const { payload } = await apiRequest(`/students/inactive-reasons?ids=${encodeURIComponent(ids.join(','))}`);
        const reasonMap = normalizeInactiveReasonMap(payload);

        for (const [studentId, reason] of reasonMap.entries()) {
          if (studentId && reason) {
            state.inactiveReasonMap.set(String(studentId), reason);
          }
        }
      } catch {
        await preloadInactiveReasonsFromHistory(studentsWithoutReason);
      }
    }

    state.inactiveReasonsLoaded = true;
    if (state.currentTab === 'inativo') {
      renderStudents();
    }
  } finally {
    state.inactiveReasonsLoading = false;
  }
}

async function preloadInactiveReasonsFromHistory(students) {
  const results = await Promise.allSettled(
    (students || []).map(async (student) => {
      const studentId = String(student.id ?? '').trim();
      if (!studentId) {
        return null;
      }

      try {
        const { payload } = await apiRequest(`/students/${encodeURIComponent(studentId)}/status-history`);
        const history = normalizeStatusHistory(payload);
        const reason = extractInactiveReason(history) || '';
        return [studentId, reason];
      } catch {
        return [studentId, ''];
      }
    })
  );

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      const [studentId, reason] = result.value;
      if (studentId && reason) {
        state.inactiveReasonMap.set(String(studentId), reason);
      }
    }
  }
}

function hydrateAttendanceState(records) {
  const index = indexAttendanceRecords(records || []);

  state.attendanceOriginalMap = new Map();
  state.attendanceDraftMap = new Map();

  for (const student of state.students) {
    const status = findAttendanceStatusForStudent(student, index) || student.attendanceStatus || 'presente';
    student.attendanceStatus = status;
    const key = String(student.attendanceKey || student.studentClassId || '').trim();
    state.attendanceOriginalMap.set(key, status);
    state.attendanceDraftMap.set(key, status);
  }
}

function backfillAttendanceKeysFromRecords(records) {
  const lookup = new Map();

  for (const record of records || []) {
    const studentClassId = extractStudentClassId(record);
    if (!studentClassId) continue;

    for (const key of getAttendanceLookupKeys(record)) {
      if (!lookup.has(key)) {
        lookup.set(key, studentClassId);
      }
    }
  }

  let updated = false;

  for (const student of state.students) {
    const currentKey = String(student.attendanceKey ?? student.studentClassId ?? '').trim();
    if (currentKey) continue;

    let resolved = '';

    for (const key of getAttendanceLookupKeys(student)) {
      const match = lookup.get(key);
      if (match) {
        resolved = match;
        break;
      }
    }

    if (!resolved) continue;

    syncStudentAttendanceKey(student, resolved);
    updated = true;
  }

  return updated;
}

function resolveStudentClassIdFromRecords(records, reference) {
  const referenceKeys = new Set(
    [
      extractStudentId(reference),
      reference?.personId,
      reference?.idPessoa,
      reference?.id_pessoa,
      reference?.idAluno,
      reference?.id_aluno,
      reference?.studentId,
      reference?.idStudent
    ]
      .map((value) => String(value ?? '').trim())
      .filter(Boolean)
  );

  for (const record of records || []) {
    const studentClassId = extractStudentClassId(record);
    if (!studentClassId) continue;

    const recordKeys = getAttendanceLookupKeys(record);
    for (const key of recordKeys) {
      if (referenceKeys.has(key)) {
        return studentClassId;
      }
    }
  }

  return '';
}

function reconcileAttendanceState(records) {
  backfillAttendanceKeysFromRecords(records);
  hydrateAttendanceState(records);
}

function renderStudents() {
  if (state.loadingStudents && !state.students.length) {
    return;
  }

  const activeStudents = state.students.filter((student) => isActiveStudent(student));
  const inactiveStudents = state.students.filter((student) => isInactiveStudent(student));
  updateCounters(activeStudents.length, inactiveStudents.length);

  const visibleStudents = state.currentTab === 'ativo' ? activeStudents : inactiveStudents;
  const currentLabel = state.currentTab === 'ativo' ? 'ativos' : 'inativos';

  studentsTitle.textContent = state.currentTab === 'ativo' ? 'Alunos ativos' : 'Alunos inativos';

  setTabState(activeStudents.length, inactiveStudents.length);

  if (!state.students.length) {
    renderEmptyState('Nenhum aluno foi encontrado para esta classe.');
    updateAttendanceSummary();
    updateSaveButtonsState();
    return;
  }

  if (!visibleStudents.length) {
    renderEmptyState(`Não há alunos ${currentLabel} para exibir.`);
    updateAttendanceSummary();
    updateSaveButtonsState();
    return;
  }

  studentsList.innerHTML = visibleStudents.map((student) => renderStudentCard(student)).join('');
  updateAttendanceSummary();
  updateSaveButtonsState();
}

function bindStudentsListEvents() {
  if (studentsListEventsBound) {
    return;
  }

  studentsListEventsBound = true;
  studentsList.addEventListener('click', (event) => {
    const target = event.target;
    const editButton = target instanceof Element ? target.closest('.student-card__edit-button') : null;
    if (editButton && studentsList.contains(editButton)) {
      const studentKey = editButton.dataset.studentKey || '';
      if (studentKey) {
        openStudentDialog('edit', studentKey);
      }
      return;
    }

    const button = target instanceof Element ? target.closest('.attendance-status-button') : null;
    if (!button || !studentsList.contains(button)) return;

    const studentKey = button.dataset.studentKey || '';
    const status = button.dataset.status || '';
    if (!studentKey || !status) return;

    setAttendanceStatus(studentKey, status);
  });
}

function findStudentByAttendanceKey(studentKey) {
  const normalizedKey = String(studentKey ?? '').trim();
  if (!normalizedKey) return null;

  return state.students.find((entry) => String(entry.attendanceKey) === normalizedKey) || null;
}

function updateStudentCardInPlace(studentKey) {
  const normalizedKey = String(studentKey ?? '').trim();
  if (!normalizedKey) return;

  const student = findStudentByAttendanceKey(normalizedKey);
  if (!student) return;

  const card = Array.from(studentsList.querySelectorAll('.student-card')).find(
    (entry) => String(entry.dataset.studentKey || '').trim() === normalizedKey
  );

  if (!card) {
    return;
  }

  const template = document.createElement('template');
  template.innerHTML = renderStudentCard(student).trim();
  const nextCard = template.content.firstElementChild;

  if (!nextCard) {
    return;
  }

  card.replaceWith(nextCard);
}

function setAttendanceStatus(studentKey, status) {
  if (!ATTENDANCE_STATUSES.includes(status)) return;

  const normalizedKey = String(studentKey);
  state.attendanceDraftMap.set(normalizedKey, status);

  const student = findStudentByAttendanceKey(normalizedKey);
  if (student) {
    student.attendanceStatus = status;
  }

  updateStudentCardInPlace(normalizedKey);
  updateAttendanceSummary();
  updateSaveButtonsState();
}

function renderStudentCard(student) {
  const enrollmentStatus = student.enrollmentStatus;
  const enrollmentLabel = enrollmentStatus === 'inativo' ? 'Inativo' : 'Ativo';
  const enrollmentClass = enrollmentStatus === 'inativo' ? 'is-inactive' : 'is-active';
  const attendanceStatus = getCurrentAttendanceStatus(student);
  const attendanceEditable = isActiveStudent(student);
  const attendanceLabel = ATTENDANCE_LABELS[attendanceStatus] || 'Presente';

  const observation =
    enrollmentStatus === 'inativo'
      ? getStudentInactiveReason(student) || (state.inactiveReasonsLoading ? 'Carregando motivo da inativação...' : '')
      : student.observation || '';

  return `
    <article class="student-card" data-student-key="${escapeHtml(student.attendanceKey)}">
      <div class="student-card__top">
        <div>
          <h4 class="student-card__title">${escapeHtml(student.name)}</h4>
          <p class="student-card__meta">
            ${student.enrollment ? `Matrícula: ${escapeHtml(student.enrollment)}<br />` : ''}
            ${student.city ? `Cidade: ${escapeHtml(student.city)}<br />` : ''}
            ${student.startDate ? `Início: ${escapeHtml(student.startDate)}` : 'Aluno vinculado à classe atual.'}
          </p>
        </div>

        <div class="student-card__top-actions">
          <button
            type="button"
            class="student-card__edit-button"
            data-student-key="${escapeHtml(student.attendanceKey)}"
            aria-label="Editar aluno ${escapeHtml(student.name)}"
          >
            Editar
          </button>
          <span class="student-status ${enrollmentClass}">${enrollmentLabel}</span>
        </div>
      </div>

      <div class="student-card__attendance">
        <div class="student-card__attendance-head">
          <p class="student-card__attendance-title">Status da chamada</p>
          <span class="student-card__attendance-badge is-${attendanceStatus}">${attendanceLabel}</span>
        </div>

        <div class="student-card__attendance-buttons" role="group" aria-label="Marcar presença de ${escapeHtml(student.name)}">
          ${ATTENDANCE_STATUSES.map((status) => {
            const isSelected = status === attendanceStatus;
            return `
              <button
                type="button"
                class="attendance-status-button attendance-status-button--${status}${isSelected ? ' is-selected' : ''}"
                data-student-key="${escapeHtml(student.attendanceKey)}"
                data-status="${status}"
                aria-pressed="${String(isSelected)}"
                ${attendanceEditable ? '' : 'disabled aria-disabled="true"'}
              >
                ${ATTENDANCE_LABELS[status]}
              </button>
            `;
          }).join('')}
        </div>
      </div>

      ${observation ? `<p class="student-card__note"><strong>${enrollmentStatus === 'inativo' ? 'Motivo da inativação' : 'Observação'}</strong> ${escapeHtml(observation)}</p>` : ''}
    </article>
  `;
}

function renderLoadingState(message) {
  studentsList.innerHTML = `
    <article class="student-card__loading" aria-busy="true">
      <p class="students-empty">${escapeHtml(message)}</p>
    </article>
  `;
  studentsTitle.textContent = 'Alunos da classe';
  updateAttendanceSummary();
  updateSaveButtonsState();
}

function renderErrorState(message) {
  studentsList.innerHTML = `
    <article class="student-card__empty" role="status">
      <p class="students-empty">${escapeHtml(message)}</p>
    </article>
  `;
  studentsTitle.textContent = 'Alunos da classe';
  setTabState(0, 0);
  studentsCounter.textContent = '0 alunos';
  attendanceSummary.textContent = '0 presentes • 0 atrasados • 0 ausentes';
  updateSaveButtonsState();
}

function renderEmptyState(message) {
  studentsList.innerHTML = `
    <article class="students-empty-card" role="status">
      <p class="students-empty">${escapeHtml(message)}</p>
    </article>
  `;
}

function renderAttendanceFeedback(message, isError) {
  attendanceFeedback.textContent = message;
  attendanceFeedback.classList.toggle('is-error', Boolean(isError));
}

function getAttendanceErrorMessage(error, fallbackMessage = 'Não foi possível salvar a chamada agora.') {
  const candidates = [
    error?.backendMessage,
    error?.primaryMessage,
    error?.detailMessage,
    error?.payload?.message,
    error?.payload?.error?.message,
    error?.payload?.detail,
    error?.message
  ];

  for (const candidate of candidates) {
    const text = APP_API_CLIENT.normalizeText(candidate);
    if (text) return text;
  }

  return fallbackMessage;
}

function updateCounters(activeTotal = 0, inactiveTotal = 0) {
  activeCount.textContent = String(activeTotal);
  inactiveCount.textContent = String(inactiveTotal);
  studentsCounter.textContent =
    state.currentTab === 'ativo'
      ? `${activeTotal} aluno${activeTotal === 1 ? '' : 's'} ativo${activeTotal === 1 ? '' : 's'}`
      : `${inactiveTotal} aluno${inactiveTotal === 1 ? '' : 's'} inativo${inactiveTotal === 1 ? '' : 's'}`;
}

function setTabState(activeTotal, inactiveTotal) {
  activeTabButton.classList.toggle('is-active', state.currentTab === 'ativo');
  inactiveTabButton.classList.toggle('is-active', state.currentTab === 'inativo');

  activeTabButton.setAttribute('aria-selected', String(state.currentTab === 'ativo'));
  inactiveTabButton.setAttribute('aria-selected', String(state.currentTab === 'inativo'));

  studentsCounter.textContent =
    state.currentTab === 'ativo'
      ? `${activeTotal} aluno${activeTotal === 1 ? '' : 's'} ativo${activeTotal === 1 ? '' : 's'}`
      : `${inactiveTotal} aluno${inactiveTotal === 1 ? '' : 's'} inativo${inactiveTotal === 1 ? '' : 's'}`;
}

function updateAttendanceSummary() {
  const counts = {
    presente: 0,
    atrasado: 0,
    ausente: 0
  };

  for (const student of getSavableAttendanceStudents()) {
    const status = getCurrentAttendanceStatus(student);
    if (counts[status] !== undefined) {
      counts[status] += 1;
    }
  }

  const pendingChanges = getAttendancePendingChangesCount();

  attendanceSummary.textContent =
    `${counts.presente} presente${counts.presente === 1 ? '' : 's'} • ` +
    `${counts.atrasado} atrasado${counts.atrasado === 1 ? '' : 's'} • ` +
    `${counts.ausente} ausente${counts.ausente === 1 ? '' : 's'}` +
    (pendingChanges ? ` • ${pendingChanges} alteração${pendingChanges === 1 ? '' : 'es'} pendente${pendingChanges === 1 ? '' : 's'}` : '');

  attendanceSummary.setAttribute('title', state.attendanceCallId ? `Chamada ${state.attendanceCallId}` : 'Nenhuma chamada aberta ainda.');
  clampClassSummaryDependentInputs({ alertOnClamp: false });
}

function getAttendancePendingChangesCount() {
  let pending = 0;

  for (const student of getSavableAttendanceStudents()) {
    const key = String(student.attendanceKey || student.studentClassId || '');
    const original = state.attendanceOriginalMap.get(key) || '';
    const draft = state.attendanceDraftMap.get(key) || '';
    if (original !== draft) {
      pending += 1;
    }
  }

  return pending;
}

function updateSaveButtonsState() {
  const disabled = state.loadingStudents || state.attendanceSaving || !getSavableAttendanceStudents().length || !state.attendanceCallId;
  const buttons = [saveAttendanceButtonBottom].filter(Boolean);

  for (const button of buttons) {
    button.disabled = disabled;
    button.textContent = state.attendanceSaving ? 'Salvando...' : 'Salvar Chamada';
  }
}

function normalizeStudents(payload) {
  const items = normalizeCollection(payload);

  return items.map((item, index) => {
    const attendanceKey = requireStudentClassId(
      item,
      `Aluno na posição ${index + 1} sem vínculo válido com a turma.`
    );

    const student = {
      raw: item,
      id: extractStudentId(item),
      personId: extractPersonId(item),
      name: getStudentName(item, index),
      enrollmentStatus: normalizeEnrollmentStatus(item),
      attendanceStatus: extractAttendanceStatus(item) || '',
      enrollment: getStudentEnrollment(item),
      startDate: getStudentStartDate(item),
      city: getStudentCity(item),
      observation: getStudentObservation(item)
    };

    syncStudentAttendanceKey(student, attendanceKey);
    return student;
  });
}

function extractAttendanceContext(payload) {
  return {
    callId: extractCallId(payload),
    records: normalizeAttendanceRecords(payload)
  };
}

function normalizeAttendanceRecords(payload) {
  const items = normalizeCollection(payload);
  return items
    .map((item, index) => ({
      raw: item,
      studentClassId: requireStudentClassId(
        item,
        `Registro de chamada na posição ${index + 1} sem vínculo válido com a turma.`
      ),
      studentId: extractStudentId(item),
      callId: extractCallId(item),
      status: extractAttendanceStatus(item)
    }))
    .filter((item) => item.studentClassId || item.studentId || item.status);
}

function indexAttendanceRecords(records) {
  const map = new Map();

  for (const record of records || []) {
    const status = normalizeStatusToken(record.status);
    if (!status) continue;

    for (const key of getAttendanceLookupKeys(record)) {
      map.set(String(key), status);
    }
  }

  return map;
}

function findAttendanceStatusForStudent(student, index) {
  for (const key of getAttendanceLookupKeys(student)) {
    const status = index.get(String(key));
    if (status) return status;
  }

  return normalizeStatusToken(student.attendanceStatus);
}

function getAttendanceLookupKeys(item) {
  const keys = [
    item?.attendanceKey,
    item?.studentClassId,
    item?.studentId,
    item?.id,
    item?.id_aluno_classe,
    item?.idAlunoClasse,
    item?.id_aluno_turma,
    item?.idAlunoTurma,
    item?.idAluno,
    item?.idAlunoMatricula,
    item?.idAlunoMatrícula,
    item?.idMatricula,
    item?.id_matricula,
    item?.idMatrícula,
    item?.idPessoa,
    item?.id_pessoa,
    item?.student?.id,
    item?.student?.idAluno,
    item?.student?.idAlunoTurma,
    item?.aluno?.id,
    item?.aluno?.idAluno
  ];

  return [...new Set(keys.map((value) => String(value ?? '').trim()).filter(Boolean))];
}

function normalizeCollection(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.students)) return payload.students;
  if (Array.isArray(payload?.attendance)) return payload.attendance;
  if (Array.isArray(payload?.records)) return payload.records;
  if (Array.isArray(payload?.history)) return payload.history;
  if (Array.isArray(payload?.call?.students)) return payload.call.students;
  if (Array.isArray(payload?.call?.attendance)) return payload.call.attendance;
  if (Array.isArray(payload?.data?.students)) return payload.data.students;
  if (Array.isArray(payload?.data?.attendance)) return payload.data.attendance;
  if (Array.isArray(payload?.result?.students)) return payload.result.students;
  if (Array.isArray(payload?.result?.attendance)) return payload.result.attendance;
  return [];
}

function extractStudentId(item) {
  const value =
    item?.id_aluno ??
    item?.idAluno ??
    item?.studentId ??
    item?.idStudent ??
    item?.idPessoa ??
    item?.id_pessoa ??
    item?.id_matricula ??
    item?.idMatricula ??
    item?.id ??
    item?.student?.id ??
    item?.aluno?.id;

  if (value === undefined || value === null || value === '') {
    return '';
  }

  return String(value);
}

function extractPersonId(item) {
  const value =
    item?.id_pessoa ??
    item?.idPessoa ??
    item?.personId ??
    item?.pessoa?.id ??
    item?.person?.id ??
    item?.student?.idPessoa ??
    item?.aluno?.idPessoa ??
    item?.raw?.id_pessoa ??
    item?.raw?.idPessoa;

  if (value === undefined || value === null || value === '') {
    return '';
  }

  return String(value);
}

function extractStudentClassId(item) {
  const value =
    item?.id_aluno_classe ??
    item?.idAlunoClasse ??
    item?.id_aluno_turma ??
    item?.idAlunoTurma ??
    item?.studentClassId ??
    item?.idStudentClass ??
    item?.idClasseAluno ??
    item?.classStudentId ??
    item?.studentClass?.id ??
    item?.alunoClasse?.id ??
    item?.turmaAluno?.id;

  if (value === undefined || value === null || value === '') {
    return '';
  }

  return String(value);
}

function requireStudentClassId(item, context) {
  const value = extractStudentClassId(item);

  if (!value) {
    const error = new Error(
      context ||
        'Não foi possível identificar o vínculo do aluno com a turma para salvar a chamada.'
    );
    error.code = 'MISSING_STUDENT_CLASS_ID';
    error.missingStudentClassId = true;
    error.record = item;
    throw error;
  }

  return value;
}

function extractCallId(payload) {
  if (payload === undefined || payload === null || payload === '') {
    return '';
  }

  if (typeof payload === 'number' || typeof payload === 'bigint') {
    return String(payload);
  }

  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    return trimmed ? trimmed : '';
  }

  const candidates = [
    payload?.id_chamada,
    payload?.idChamada,
    payload?.callId,
    payload?.attendanceId,
    payload?.id,
    payload?.call?.id_chamada,
    payload?.call?.idChamada,
    payload?.call?.callId,
    payload?.call?.attendanceId,
    payload?.call?.id,
    payload?.attendance?.id_chamada,
    payload?.attendance?.idChamada,
    payload?.attendance?.callId,
    payload?.attendance?.attendanceId,
    payload?.attendance?.id,
    payload?.data?.id_chamada,
    payload?.data?.idChamada,
    payload?.data?.callId,
    payload?.data?.attendanceId,
    payload?.data?.id,
    payload?.result?.id_chamada,
    payload?.result?.idChamada,
    payload?.result?.callId,
    payload?.result?.attendanceId,
    payload?.result?.id
  ];

  for (const candidate of candidates) {
    if (candidate !== undefined && candidate !== null && String(candidate).trim()) {
      return String(candidate).trim();
    }
  }

  if (typeof payload === 'object') {
    const queue = [payload];
    const seen = new Set();

    while (queue.length) {
      const current = queue.shift();
      if (!current || typeof current !== 'object' || seen.has(current)) continue;
      seen.add(current);

      for (const [key, value] of Object.entries(current)) {
        const normalizedKey = String(key).trim().toLowerCase();
        if (['id_chamada', 'idchamada', 'callid', 'attendanceid'].includes(normalizedKey)) {
          if (value !== undefined && value !== null && String(value).trim()) {
            return String(value).trim();
          }
        }
        if (value && typeof value === 'object') {
          queue.push(value);
        }
      }
    }
  }

  return '';
}

function extractAttendanceStatus(item) {
  const candidates = [
    item?.attendanceStatus,
    item?.statusFrequencia,
    item?.statusPresenca,
    item?.status_chamada,
    item?.statusChamada,
    item?.chamadaStatus,
    item?.situacaoChamada,
    item?.frequencia,
    item?.presenca,
    item?.presence,
    item?.attendance,
    item?.situacao,
    item?.status
  ];

  for (const candidate of candidates) {
    const normalized = normalizeStatusToken(candidate);
    if (normalized) return normalized;
  }

  if (item?.presente === true || item?.present === true || item?.isPresent === true) {
    return 'presente';
  }

  if (item?.atrasado === true || item?.late === true || item?.isLate === true) {
    return 'atrasado';
  }

  if (item?.ausente === true || item?.absent === true || item?.isAbsent === true) {
    return 'ausente';
  }

  return '';
}

function normalizeStatusToken(value) {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text) return '';

  if (text.includes('pres') || text.includes('present')) return 'presente';
  if (text.includes('atras') || text.includes('late')) return 'atrasado';
  if (text.includes('aus') || text.includes('falt') || text.includes('absent')) return 'ausente';

  return '';
}

function normalizeEnrollmentStatus(item) {
  const source = item?.raw && typeof item.raw === 'object' ? item.raw : item;

  if (typeof source?.ativo === 'boolean') {
    return source.ativo ? 'ativo' : 'inativo';
  }

  const raw =
    source?.statusAluno ??
    source?.status_aluno ??
    source?.statusPessoa ??
    source?.situacaoAluno ??
    source?.situacao ??
    source?.status ??
    item?.statusAluno ??
    item?.status_aluno ??
    item?.statusPessoa ??
    item?.situacaoAluno ??
    item?.situacao ??
    item?.status ??
    '';

  const status = String(raw).trim().toLowerCase();
  if (status.includes('inativ')) return 'inativo';
  if (status.includes('ativo')) return 'ativo';

  return 'ativo';
}

function isActiveStudent(student) {
  return student.enrollmentStatus !== 'inativo';
}

function isInactiveStudent(student) {
  return student.enrollmentStatus === 'inativo';
}

function getSavableAttendanceStudents() {
  return state.students.filter((student) => isActiveStudent(student));
}

function getCurrentAttendanceStatus(student) {
  const key = String(student.attendanceKey);
  const draft = state.attendanceDraftMap.get(key);
  const original = state.attendanceOriginalMap.get(key);

  return draft || original || student.attendanceStatus || 'presente';
}

function getStudentEnrollment(item) {
  return (
    item?.matricula ||
    item?.registration ||
    item?.codigoMatricula ||
    item?.numeroMatricula ||
    item?.student?.matricula ||
    item?.aluno?.matricula ||
    ''
  );
}

function getStudentStartDate(item) {
  return item?.dataInicio || item?.data_inicio || item?.inicio || item?.student?.dataInicio || '';
}

function getStudentCity(item) {
  return item?.cidade || item?.city || item?.pessoa?.cidade || item?.student?.cidade || '';
}

function getStudentName(item, index) {
  return (
    item?.nome ||
    item?.name ||
    item?.pessoa?.nome ||
    item?.student?.nome ||
    item?.aluno?.nome ||
    `Aluno ${index + 1}`
  );
}

function getStudentObservation(item) {
  return (
    item?.observacao ||
    item?.observation ||
    item?.obs ||
    item?.nota ||
    item?.student?.observacao ||
    item?.pessoa?.observacao ||
    item?.person?.observacao ||
    ''
  );
}

function getStudentInactiveReason(student) {
  return state.inactiveReasonMap.get(String(student.id)) || getStudentObservation(student.raw) || '';
}

function normalizeStatusHistory(payload) {
  const items = normalizeCollection(payload);
  return items.map((item) => item || {});
}

function extractInactiveReason(history) {
  if (!history.length) return '';

  const reversedHistory = [...history].reverse();
  for (const entry of reversedHistory) {
    const status = normalizeEnrollmentStatus(entry);
    if (status === 'inativo') {
      const reason =
        entry?.motivo ||
        entry?.observacao ||
        entry?.justificativa ||
        entry?.reason ||
        entry?.descricao ||
        '';
      if (reason) return String(reason).trim();
    }
  }

  const fallback = reversedHistory[0];
  return (
    fallback?.motivo ||
    fallback?.observacao ||
    fallback?.justificativa ||
    fallback?.reason ||
    fallback?.descricao ||
    ''
  );
}


function openStudentDialog(mode = 'create', studentKey = '') {
  if (!hasValidClassId()) {
    renderAttendanceFeedback('Selecione uma classe antes de cadastrar ou editar um aluno.', true);
    return;
  }

  const normalizedMode = mode === 'edit' ? 'edit' : 'create';
  state.studentDialogMode = normalizedMode;
  state.studentDialogKey = normalizedMode === 'edit' ? String(studentKey || '').trim() : '';

  clearFeedback();
  clearAllFieldStates();

  let student = null;
  if (normalizedMode === 'edit') {
    student = findStudentByAttendanceKey(state.studentDialogKey);
    if (!student) {
      setFeedback('Não foi possível localizar o aluno para edição.', true);
      state.studentDialogMode = 'create';
      state.studentDialogKey = '';
      return;
    }

    populateStudentForm(student);
  } else {
    addStudentForm.reset();
  }

  updateStudentDialogCopy(normalizedMode);
  syncStudentDialogControls(normalizedMode, student);
  updateDeleteButtonVisibility();

  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else {
    dialog.setAttribute('open', '');
  }

  window.requestAnimationFrame(() => {
    studentNameInput.focus();
  });
}

function closeDialog() {
  if (typeof dialog.close === 'function') {
    dialog.close();
  } else {
    dialog.removeAttribute('open');
  }

  state.studentDialogMode = 'create';
  state.studentDialogKey = '';
  clearFeedback();
  clearAllFieldStates();
  updateStudentDialogCopy('create');
  syncStudentDialogControls('create');
  updateDeleteButtonVisibility();
}

function handleBackdropClick(event) {
  if (event.target === dialog) {
    closeDialog();
  }
}

function bindClassSummaryEvents() {
  if (classSummaryEventsBound) return;
  classSummaryEventsBound = true;

  if (classOfferInput) {
    classOfferInput.addEventListener('input', handleClassOfferInput);
    classOfferInput.addEventListener('blur', handleClassOfferInput);
  }

  if (classVisitorsInput) {
    classVisitorsInput.addEventListener('input', handleClassVisitorsInput);
    classVisitorsInput.addEventListener('blur', handleClassVisitorsInput);
  }

  if (classBiblesInput) {
    classBiblesInput.addEventListener('input', handleClassBiblesInput);
    classBiblesInput.addEventListener('blur', handleClassBiblesInput);
  }

  if (classMagazinesInput) {
    classMagazinesInput.addEventListener('input', handleClassMagazinesInput);
    classMagazinesInput.addEventListener('blur', handleClassMagazinesInput);
  }
}

function handleClassOfferInput(event) {
  if (!event?.target) return;
  formatTensToBRL(event);
}

function handleClassVisitorsInput(event) {
  if (!event?.target) return;
  syncNumericInputField(event.target, {
    max: 50,
    alertOnClamp: true,
    alertLabel: 'O número máximo permitido para visitantes'
  });
  clampClassSummaryDependentInputs({ alertOnClamp: false });
}

function handleClassBiblesInput(event) {
  if (!event?.target) return;
  syncNumericInputField(event.target, {
    max: getClassSummaryResourceLimit(),
    alertOnClamp: true,
    alertLabel: 'O número máximo permitido para bíblias'
  });
}

function handleClassMagazinesInput(event) {
  if (!event?.target) return;
  syncNumericInputField(event.target, {
    max: getClassSummaryResourceLimit(),
    alertOnClamp: true,
    alertLabel: 'O número máximo permitido para revistas'
  });
}

function syncClassSummaryInputs({ clampDependents = false } = {}) {
  if (classOfferInput) {
    classOfferInput.value = formatCurrencyBR(classOfferInput.value);
  }

  if (classVisitorsInput) {
    classVisitorsInput.value = normalizeNumericInputValue_(classVisitorsInput.value);
  }

  if (clampDependents) {
    clampClassSummaryDependentInputs({ alertOnClamp: false });
  }
}

function clampClassSummaryDependentInputs({ alertOnClamp = false } = {}) {
  const limit = getClassSummaryResourceLimit();
  if (limit === null) return;

  if (classBiblesInput) {
    syncNumericInputField(classBiblesInput, {
      max: limit,
      alertOnClamp,
      alertLabel: 'O número máximo permitido para bíblias'
    });
  }

  if (classMagazinesInput) {
    syncNumericInputField(classMagazinesInput, {
      max: limit,
      alertOnClamp,
      alertLabel: 'O número máximo permitido para revistas'
    });
  }
}

function getClassSummaryResourceLimit() {
  if (!state.attendanceReady || !state.students.length) {
    return null;
  }

  const visitors = normalizeSummaryCountValue(classVisitorsInput?.value);
  return Math.max(0, getCurrentPresentCount() + visitors);
}

function getCurrentPresentCount() {
  if (!state.students.length) return 0;

  return getSavableAttendanceStudents().reduce((count, student) => {
    const status = getCurrentAttendanceStatus(student);
    return count + (status === 'ausente' ? 0 : 1);
  }, 0);
}

function normalizeWholeNumberText(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return String(Number(digits));
}

function clampWholeNumber(value, max = null) {
  const normalized = normalizeWholeNumberText(value);
  let numeric = normalized === '' ? 0 : Number(normalized);

  if (!Number.isFinite(numeric) || numeric < 0) {
    numeric = 0;
  }

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
    const visitantes = clampWholeNumber(classVisitorsInput?.value ?? 0, 50);
    showNumericLimitAlert_(Number.isFinite(max) ? Math.floor(max) : numeric, presentes, visitantes, alertLabel);
  }

  return numeric;
}

function formatTensToBRL(event) {
  if (!event?.target) return;

  const digits = String(event.target.value || '').replace(/\D/g, '');
  const cents = digits.padStart(3, '0');
  const number = Number(cents) / 100;

  event.target.value = number.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
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
  return number.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function collectClassSummaryData() {
  return {
    oferta: parseCurrencyBR(classOfferInput?.value),
    visitantes: normalizeSummaryCountValue(classVisitorsInput?.value),
    biblias: normalizeSummaryCountValue(classBiblesInput?.value),
    revistas: normalizeSummaryCountValue(classMagazinesInput?.value)
  };
}

async function loadClassSummary() {
  try {
    const classSummary = await fetchClassSummary();
    if (!classSummary) {
      state.classSummaryOriginal = null;
      state.classSummaryLoaded = false;
      return null;
    }

    state.classSummaryOriginal = classSummary;
    state.classSummaryLoaded = true;
    applyClassSummaryToInputs(classSummary);
    syncClassSummaryInputs({ clampDependents: false });
    return classSummary;
  } catch (error) {
    state.classSummaryOriginal = null;
    state.classSummaryLoaded = false;
    // eslint-disable-next-line no-console
    console.error('Erro ao carregar o resumo da classe:', error);
    return null;
  }
}

async function fetchClassSummary() {
  if (!hasValidClassId()) {
    return null;
  }

  let lastError = null;

  for (const buildUrl of ATTENDANCE_SUMMARY_ENDPOINTS) {
    const url = buildUrl(classId);

    try {
      const { payload } = await apiRequest(`${url}${url.includes('?') ? '&' : '?'}date=${encodeURIComponent(getBusinessISODate())}`);
      const summary = normalizeClassSummaryPayload(payload);
      if (summary) {
        return summary;
      }
      return null;
    } catch (error) {
      const status = Number(error?.status || error?.error?.statusCode || 0);
      if ([404, 405].includes(status)) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  if (lastError) {
    return null;
  }

  return null;
}

function normalizeClassSummaryPayload(payload) {
  const candidate = Array.isArray(payload)
    ? payload[0]
    : Array.isArray(payload?.data)
      ? payload.data[0]
      : Array.isArray(payload?.result)
        ? payload.result[0]
        : Array.isArray(payload?.items)
          ? payload.items[0]
          : payload?.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
            ? payload.data
            : payload?.result && typeof payload.result === 'object' && !Array.isArray(payload.result)
              ? payload.result
              : payload?.payload && typeof payload.payload === 'object'
                ? payload.payload
                : payload;

  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  return {
    idChamada: candidate.id_chamada ?? candidate.idChamada ?? null,
    oferta: parseCurrencyBR(candidate.oferta ?? candidate.value ?? 0),
    visitantes: normalizeSummaryCountValue(candidate.visitantes ?? candidate.visitors ?? 0),
    biblias: normalizeSummaryCountValue(candidate.biblias ?? candidate.bibles ?? 0),
    revistas: normalizeSummaryCountValue(candidate.revistas ?? candidate.magazines ?? 0)
  };
}

function applyClassSummaryToInputs(summary) {
  if (!summary) return;

  if (classOfferInput) {
    classOfferInput.value = formatCurrencyBR(summary.oferta);
  }

  if (classVisitorsInput) {
    classVisitorsInput.value = String(normalizeSummaryCountValue(summary.visitantes));
  }

  if (classBiblesInput) {
    classBiblesInput.value = String(normalizeSummaryCountValue(summary.biblias));
  }

  if (classMagazinesInput) {
    classMagazinesInput.value = String(normalizeSummaryCountValue(summary.revistas));
  }
}

function shouldSaveClassSummary(summaryPayload) {
  if (!summaryPayload || typeof summaryPayload !== 'object') {
    return false;
  }

  const current = {
    oferta: Number(summaryPayload.oferta || 0),
    visitantes: normalizeSummaryCountValue(summaryPayload.visitantes),
    biblias: normalizeSummaryCountValue(summaryPayload.biblias),
    revistas: normalizeSummaryCountValue(summaryPayload.revistas)
  };

  if (!state.classSummaryLoaded && !current.oferta && !current.visitantes && !current.biblias && !current.revistas) {
    return false;
  }

  if (!state.classSummaryOriginal) {
    return true;
  }

  return !isSameClassSummary(state.classSummaryOriginal, current);
}

function isSameClassSummary(left, right) {
  return Number(left?.oferta || 0) === Number(right?.oferta || 0)
    && normalizeSummaryCountValue(left?.visitantes) === normalizeSummaryCountValue(right?.visitantes)
    && normalizeSummaryCountValue(left?.biblias) === normalizeSummaryCountValue(right?.biblias)
    && normalizeSummaryCountValue(left?.revistas) === normalizeSummaryCountValue(right?.revistas);
}

async function saveClassSummary(summaryPayload) {
  if (!shouldSaveClassSummary(summaryPayload)) {
    return null;
  }

  const body = {
    oferta: Number(summaryPayload.oferta || 0),
    visitantes: normalizeSummaryCountValue(summaryPayload.visitantes),
    biblias: normalizeSummaryCountValue(summaryPayload.biblias),
    revistas: normalizeSummaryCountValue(summaryPayload.revistas)
  };

  const { payload } = await apiRequest(`/attendance/${encodeURIComponent(state.attendanceCallId)}/summary`, {
    method: 'PUT',
    body
  });

  const savedSummary = normalizeClassSummaryPayload(payload) || body;
  state.classSummaryOriginal = savedSummary;
  state.classSummaryLoaded = true;
  applyClassSummaryToInputs(savedSummary);
  return savedSummary;
}

function normalizeSummaryCountValue(value) {
  return clampWholeNumber(value);
}

function normalizeSummaryMoneyValue(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return 'R$ 0,00';

  return formatCurrencyBR(raw);
}

async function handleStudentFormSubmit(event) {
  event.preventDefault();
  clearFeedback();
  clearAllFieldStates();

  const formData = collectFormData();
  const invalidFields = validateFields(formData);

  if (invalidFields.length > 0) {
    markInvalidFields(invalidFields);
    focusFirstInvalidField(invalidFields);
    setFeedback('Preencha os campos obrigatórios antes de continuar.', true);
    return;
  }

  const currentStudent = state.studentDialogMode === 'edit'
    ? findStudentByAttendanceKey(state.studentDialogKey)
    : null;

  setEnrollmentLoading(true);

  try {
    if (state.studentDialogMode === 'edit') {
      if (!currentStudent) {
        throw new Error('Não foi possível localizar o aluno para edição.');
      }

      const mutationResult = await updateStudentFromForm(currentStudent, formData);
      applyLocalStudentMutation(currentStudent, mutationResult, formData);
      renderStudents();
      renderAttendanceFeedback(`Aluno "${currentStudent.name}" atualizado com sucesso.`, false);
    } else {
      await createStudentFromForm(formData);
      await loadStudentsAndAttendance();
      renderAttendanceFeedback(`Aluno "${formData.nome}" cadastrado com sucesso.`, false);
    }

    closeDialog();
  } catch (error) {
    const message = getStudentMutationErrorMessage(error);
    setFeedback(message, true);
    renderAttendanceFeedback(message, true);
  } finally {
    setEnrollmentLoading(false);
  }
}

async function handleDeleteStudent() {
  if (state.studentDialogMode !== 'edit') {
    return;
  }

  const student = findStudentByAttendanceKey(state.studentDialogKey);
  if (!student) {
    setFeedback('Não foi possível localizar o aluno para exclusão.', true);
    return;
  }

  const confirmMessage = `Excluir ${student.name}? Esta ação vai inativar o aluno e remover o card da turma ativa.`;
  if (!window.confirm(confirmMessage)) {
    return;
  }

  setEnrollmentLoading(true);

  try {
    await inactivateStudentFromForm(student, {
      motivo: 'Exclusão solicitada na edição',
      observacao: student.observation || ''
    });

    closeDialog();
    await loadStudentsAndAttendance();
    renderAttendanceFeedback(`Aluno "${student.name}" excluído com sucesso.`, false);
  } catch (error) {
    const message = getStudentMutationErrorMessage(error);
    setFeedback(message, true);
    renderAttendanceFeedback(message, true);
  } finally {
    setEnrollmentLoading(false);
  }
}

async function createStudentFromForm(formData) {
  const personPayload = buildPersonPayload(formData);
  const { payload: personResult } = await apiRequest('/people', {
    method: 'POST',
    body: personPayload
  });

  const personId = extractPersonId(personResult);
  if (!personId) {
    throw new Error('Não foi possível concluir o cadastro da pessoa.');
  }

  const enrollmentPayload = buildEnrollmentPayload(personId, formData);
  const { payload: enrollmentResult } = await apiRequest('/students/enroll', {
    method: 'POST',
    body: enrollmentPayload
  });

  const studentId = extractStudentId(enrollmentResult);
  if (!studentId) {
    throw new Error('Não foi possível concluir a matrícula do aluno.');
  }

  if (formData.ativo === false) {
    await inactivateStudentFromForm(
      {
        id: studentId,
        observation: formData.observacao || ''
      },
      {
        motivo: 'Cadastro realizado como aluno inativo',
        observacao: formData.observacao || ''
      }
    );
  }

  return {
    personResult,
    enrollmentResult
  };
}

async function updateStudentFromForm(student, formData) {
  const personId = extractPersonId(student);
  if (!personId) {
    throw new Error('Não foi possível identificar a pessoa vinculada ao aluno.');
  }

  const personPayload = buildPersonPayload(formData);
  const { payload: personResult } = await apiRequest(`/people/${encodeURIComponent(personId)}`, {
    method: 'PUT',
    body: personPayload
  });

  const studentObservationResult = await updateStudentObservationFromForm(student.id, formData);

  const currentStatus = normalizeEnrollmentStatus(student);
  const desiredStatus = formData.ativo ? 'ativo' : 'inativo';
  let statusResult = null;

  if (currentStatus !== desiredStatus) {
    if (desiredStatus === 'ativo') {
      statusResult = await activateStudentFromForm(student.id, formData);
    } else {
      statusResult = await inactivateStudentFromForm(student, {
        motivo: 'Inativação manual na edição',
        observacao: formData.observacao || ''
      });
    }
  }

  return {
    personResult,
    studentObservationResult,
    statusResult,
    desiredStatus,
    currentStatus,
    statusChanged: currentStatus !== desiredStatus
  };
}
async function updateStudentObservationFromForm(studentId, formData = {}) {
  const { payload } = await apiRequest(`/students/${encodeURIComponent(studentId)}/observation`, {
    method: 'PUT',
    body: {
      observacao: formData?.observacao || ''
    }
  });

  return payload;
}


async function activateStudentFromForm(studentId, formData = {}) {
  const { payload } = await apiRequest(`/students/${encodeURIComponent(studentId)}/activate`, {
    method: 'PUT',
    body: {
      observacao: formData?.observacao || ''
    }
  });

  return payload;
}

async function inactivateStudentFromForm(student, { motivo = 'Inativação manual na edição', observacao = '' } = {}) {
  const studentId = typeof student === 'object' ? extractStudentId(student) : String(student ?? '').trim();
  if (!studentId) {
    throw new Error('Não foi possível identificar o aluno para inativação.');
  }

  const { payload } = await apiRequest(`/students/${encodeURIComponent(studentId)}/inactivate`, {
    method: 'PUT',
    body: {
      motivo: String(motivo || '').trim() || 'Inativação manual na edição',
      observacao: observacao || ''
    }
  });

  return payload;
}

function applyLocalStudentMutation(student, mutationResult, formData) {
  if (!student || typeof student !== 'object') {
    return;
  }

  const { personResult, statusResult, desiredStatus, currentStatus, statusChanged } = mutationResult || {};
  const mergedRaw = mergeStudentRawRecords(student.raw, personResult || {});

  mergedRaw.nome = formData.nome || mergedRaw.nome || student.name || '';
  mergedRaw.observacao = formData.observacao ?? '';
  mergedRaw.matricula = formData.matricula || mergedRaw.matricula || '';
  mergedRaw.data_inicio = formData.dataInicio || mergedRaw.data_inicio || mergedRaw.dataInicio || '';
  mergedRaw.dataInicio = formData.dataInicio || mergedRaw.dataInicio || mergedRaw.data_inicio || '';
  mergedRaw.status = desiredStatus || mergedRaw.status || currentStatus || '';
  mergedRaw.ativo = (desiredStatus || currentStatus || 'ativo') === 'ativo';

  student.raw = mergedRaw;
  student.personId = extractPersonId(personResult) || student.personId || '';
  student.name = mergedRaw.nome || student.name;
  student.enrollment = formData.matricula || student.enrollment || '';
  student.startDate = formData.dataInicio || student.startDate || '';
  student.city = formData.cidade || student.city || '';
  student.observation = formData.observacao ?? '';
  student.enrollmentStatus = desiredStatus || currentStatus || student.enrollmentStatus || 'ativo';

  if (statusChanged) {
    if (desiredStatus === 'inativo') {
      const inactiveReason = formData.observacao || 'Inativação manual na edição';
      state.inactiveReasonMap.set(String(student.id), inactiveReason);
      student.raw.motivo_desligamento = inactiveReason;
      student.raw.data_desligamento = getBusinessISODate();
    } else {
      state.inactiveReasonMap.delete(String(student.id));
      student.raw.motivo_desligamento = '';
      student.raw.data_desligamento = null;
    }
  }

  if (statusResult && typeof statusResult === 'object') {
    student.raw = mergeStudentRawRecords(student.raw, statusResult);
  }
}

function getStudentMutationErrorMessage(error, fallbackMessage = 'Não foi possível salvar o aluno agora.') {
  return getAttendanceErrorMessage(error, fallbackMessage);
}

function collectFormData() {
  return {
    nome: studentNameInput.value.trim(),
    sexo: studentSexInput.value.trim(),
    cpf: studentCpfInput.value.trim(),
    data_nascimento: studentBirthDateInput.value,
    telefone: studentPhoneInput.value.trim(),
    email: studentEmailInput.value.trim(),
    logradouro: studentStreetInput.value.trim(),
    numero: studentNumberInput.value.trim(),
    bairro: studentNeighborhoodInput.value.trim(),
    cidade: studentCityInput.value.trim(),
    uf: studentStateInput.value.trim(),
    cep: studentZipCodeInput.value.trim(),
    observacao: studentObservationInput.value.trim(),
    matricula: studentEnrollmentInput.value.trim(),
    dataInicio: studentStartDateInput.value,
    ativo: Boolean(studentActiveToggleInput.checked)
  };
}

function validateFields(formData) {
  const invalidFields = [];

  if (!formData.nome) {
    invalidFields.push(studentNameInput);
  }

  return invalidFields;
}

function markInvalidFields(fields) {
  for (const field of fields) {
    field.closest('.form-field')?.classList.add('is-invalid');
    field.setAttribute('aria-invalid', 'true');
  }
}

function clearFieldState(field) {
  field.closest('.form-field')?.classList.remove('is-invalid');
  field.removeAttribute('aria-invalid');
  if (formFeedback.classList.contains('is-error')) {
    formFeedback.textContent = '';
    formFeedback.classList.remove('is-error');
  }
}

function clearAllFieldStates() {
  for (const field of getFormFields()) {
    clearFieldState(field);
  }
}

function focusFirstInvalidField(fields) {
  const firstField = fields[0];
  if (!firstField) return;
  firstField.focus({ preventScroll: true });
  firstField.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function getFormFields() {
  return [
    studentNameInput,
    studentSexInput,
    studentCpfInput,
    studentBirthDateInput,
    studentPhoneInput,
    studentEmailInput,
    studentStreetInput,
    studentNumberInput,
    studentNeighborhoodInput,
    studentCityInput,
    studentStateInput,
    studentZipCodeInput,
    studentObservationInput,
    studentEnrollmentInput,
    studentStartDateInput
  ];
}

function buildPersonPayload(formData) {
  const payload = {
    nome: formData.nome
  };

  const optionalFields = [
    'sexo',
    'cpf',
    'data_nascimento',
    'telefone',
    'email',
    'logradouro',
    'numero',
    'bairro',
    'cidade',
    'uf',
    'cep'
  ];

  for (const key of optionalFields) {
    if (formData[key]) {
      payload[key] = formData[key];
    }
  }

  return payload;
}

function buildEnrollmentPayload(personId, formData) {
  const payload = {
    idPessoa: personId,
    idClasse: classId
  };

  if (formData.matricula) {
    payload.matricula = formData.matricula;
  }

  if (formData.dataInicio) {
    payload.dataInicio = formData.dataInicio;
  }

  if (formData.observacao) {
    payload.observacao = formData.observacao;
  }

  return payload;
}

async function handleSaveAttendance() {
  if (!state.students.length) {
    renderAttendanceFeedback('Nenhum aluno para salvar.', true);
    return;
  }

  setAttendanceSaving(true);
  renderAttendanceFeedback('', false);

  try {
    if (!state.attendanceCallId) {
      const reopened = await ensureAttendanceCall();
      if (reopened.callId) {
        syncAttendanceCallId(reopened.callId);
      }
      if (reopened.records.length) {
        hydrateAttendanceState(reopened.records);
      }
    }

    if (!state.attendanceCallId) {
      const snapshot = await fetchAttendanceSnapshot();
      if (snapshot.callId) {
        syncAttendanceCallId(snapshot.callId);
      }
      if (snapshot.records.length) {
        hydrateAttendanceState(snapshot.records);
      }
    }

    if (!state.attendanceCallId) {
      throw new Error('Não foi possível identificar a chamada aberta para salvar.');
    }

    const refreshSnapshot = await fetchAttendanceSnapshot().catch(() => ({ callId: '', records: [] }));
    if (refreshSnapshot.records.length) {
      backfillAttendanceKeysFromRecords(refreshSnapshot.records);
      for (const student of state.students) {
        if (String(student.attendanceKey || student.studentClassId || '').trim()) {
          continue;
        }

        const resolved = resolveStudentClassIdFromRecords(refreshSnapshot.records, student);
        if (resolved) {
          syncStudentAttendanceKey(student, resolved);
        }
      }
    }

    const savableStudents = getSavableAttendanceStudents();
    if (!savableStudents.length) {
      renderAttendanceFeedback('Não há alunos ativos para salvar nesta chamada.', true);
      return;
    }

    syncClassSummaryInputs({ clampDependents: true });
    const classSummaryPayload = collectClassSummaryData();

    const missingStudentLink = savableStudents.find((student) => !String(student.attendanceKey || student.studentClassId || '').trim());
    if (missingStudentLink) {
      throw new Error(
        `Não foi possível salvar a chamada: vínculo aluno-classe ausente para "${missingStudentLink.name}". O backend precisa retornar id_aluno_classe.`
      );
    }

    const changes = savableStudents.map((student) => {
      const studentClassId = requireStudentClassId(
        student,
        `Vínculo aluno-classe ausente ao salvar a chamada para "${student.name}". O backend precisa retornar id_aluno_classe.`
      );

      return {
        student,
        studentClassId,
        status: getCurrentAttendanceStatus(student)
      };
    });

    const { payload } = await apiRequest(`/attendance/${encodeURIComponent(state.attendanceCallId)}`, {
      method: 'PATCH',
      body: {
        students: changes.map(({ studentClassId, status }) => ({
          studentClassId,
          id_aluno_classe: studentClassId,
          status
        }))
      }
    });

    const savedAttendance = extractAttendanceContext(payload);
    if (savedAttendance.callId) {
      syncAttendanceCallId(savedAttendance.callId);
    }

    if (savedAttendance.records.length && savedAttendance.records.length === savableStudents.length) {
      reconcileAttendanceState(savedAttendance.records);
    } else {
      for (const { student, studentClassId, status } of changes) {
        const key = String(student.attendanceKey || studentClassId || '').trim();
        if (!key) continue;

        student.attendanceStatus = status;
        state.attendanceOriginalMap.set(key, status);
        state.attendanceDraftMap.set(key, status);
      }
    }

    let summarySaveError = null;
    try {
      await saveClassSummary(classSummaryPayload);
    } catch (error) {
      summarySaveError = error;
      // eslint-disable-next-line no-console
      console.error('Erro ao salvar o resumo da classe:', error);
    }

    if (summarySaveError) {
      renderAttendanceFeedback('Chamada salva, mas o resumo da classe não pôde ser atualizado.', true);
    } else {
      renderAttendanceFeedback('Chamada salva com sucesso.', false);
      window.location.href = '../../classe/pages/index.html';
      return;
    }
    updateAttendanceSummary();
  } catch (error) {
    const message = getAttendanceErrorMessage(error);
    renderAttendanceFeedback(message, true);
    // eslint-disable-next-line no-console
    console.error('Erro ao salvar a chamada:', message, error);
    if (error?.requiresRelogin || error?.status === 401 || /401/.test(message)) {
      clearStoredToken();
      window.setTimeout(goToLogin, 350);
    }
  } finally {
    setAttendanceSaving(false);
    updateAttendanceSummary();
    updateSaveButtonsState();
  }
}


function updateStudentDialogCopy(mode = 'create') {
  const normalizedMode = mode === 'edit' ? 'edit' : 'create';
  const isEditMode = normalizedMode === 'edit';

  dialog.dataset.mode = normalizedMode;

  const eyebrow = dialog.querySelector('.eyebrow');
  if (eyebrow) {
    eyebrow.textContent = isEditMode ? 'Editar aluno' : 'Adicionar aluno';
  }

  if (dialogTitle) {
    dialogTitle.textContent = isEditMode ? 'Editar aluno' : 'Adicionar aluno';
  }

  // Dialog copy is now intentionally compact; the title alone guides the flow.

  if (studentDataTitle) {
    studentDataTitle.textContent = isEditMode ? 'Dados do aluno para edição' : 'Dados do aluno';
  }

  submitButton.textContent = isEditMode ? 'Salvar alterações' : 'Salvar aluno';
}

function updateDeleteButtonVisibility() {
  const isEditMode = state.studentDialogMode === 'edit';
  deleteButton.hidden = !isEditMode;
  deleteButton.disabled = !isEditMode;
}

function syncStudentDialogControls(mode, student = null) {
  const isEditMode = mode === 'edit';

  studentStartDateInput.disabled = isEditMode;
  studentStartDateInput.title = isEditMode
    ? 'A data de início fica bloqueada na edição.'
    : '';
  studentStartDateNote.textContent = isEditMode ? '(bloqueada na edição)' : '(opcional)';

  if (studentStartDateInput.closest('.form-field')) {
    studentStartDateInput.closest('.form-field').classList.toggle('is-locked', isEditMode);
  }

  const isActive = isEditMode && student ? student.enrollmentStatus !== 'inativo' : true;
  updateStudentStatusToggleVisual(isActive, { skipInputSync: false });
}

function updateStudentStatusToggleVisual(isActive, { skipInputSync = false } = {}) {
  const active = Boolean(isActive);

  if (!skipInputSync) {
    studentActiveToggleInput.checked = active;
  }

  if (studentStatusControl) {
    studentStatusControl.dataset.state = active ? 'ativo' : 'inativo';
  }

  if (studentStatusValue) {
    studentStatusValue.textContent = active ? 'Ativo' : 'Inativo';
  }

  if (studentStatusHelp) {
    studentStatusHelp.textContent = active
      ? 'O status ativo será salvo ao confirmar a edição.'
      : 'O status inativo será salvo ao confirmar a edição.';
  }
}

function populateStudentForm(student) {
  const raw = student?.raw && typeof student.raw === 'object' ? student.raw : {};

  studentNameInput.value = getFirstString(raw, ['nome', 'name', 'aluno', 'studentName']) || student?.name || '';
  studentSexInput.value = normalizeSexoSelectValue(
    getFirstString(raw, ['sexo', 'gender', 'genero', 'gênero', 'sexoAluno', 'sexo_aluno']) || student?.sexo
  );
  studentCpfInput.value = normalizeFormValue(getFirstString(raw, ['cpf', 'documento', 'document', 'cpfAluno']));
  studentBirthDateInput.value = normalizeDateInputValue(
    getFirstString(raw, ['data_nascimento', 'dataNascimento', 'nascimento', 'birthDate'])
  );
  studentPhoneInput.value = normalizeFormValue(getFirstString(raw, ['telefone', 'celular', 'phone', 'whatsapp']));
  studentEmailInput.value = normalizeFormValue(getFirstString(raw, ['email', 'e-mail']));
  studentStreetInput.value = normalizeFormValue(getFirstString(raw, ['logradouro', 'rua', 'street', 'endereco']));
  studentNumberInput.value = normalizeFormValue(getFirstString(raw, ['numero', 'número', 'number']));
  studentNeighborhoodInput.value = normalizeFormValue(getFirstString(raw, ['bairro', 'neighborhood']));
  studentCityInput.value = normalizeFormValue(getFirstString(raw, ['cidade', 'city', 'municipio', 'município']));
  studentStateInput.value = normalizeFormValue(getFirstString(raw, ['uf', 'estado', 'state']));
  studentZipCodeInput.value = normalizeFormValue(getFirstString(raw, ['cep', 'zipcode', 'zipCode']));
  studentObservationInput.value = normalizeFormValue(
    getFirstString(raw, ['observacao', 'observação', 'obs', 'note']) || student?.observation
  );
  studentEnrollmentInput.value = normalizeFormValue(
    getFirstString(raw, ['matricula', 'matrícula', 'enrollment', 'registration']) || student?.enrollment
  );
  studentStartDateInput.value = normalizeDateInputValue(
    getFirstString(raw, ['dataInicio', 'data_inicio', 'inicio', 'startDate']) || student?.startDate
  );

  updateStudentStatusToggleVisual(student.enrollmentStatus !== 'inativo');
}

function getFirstString(source, keys) {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }

  return '';
}

function normalizeFormValue(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function normalizeSexoSelectValue(value) {
  const normalized = normalizeFormValue(value).toLowerCase();

  if (!normalized) return '';

  if (normalized === 'm' || normalized === 'masculino') {
    return 'masculino';
  }

  if (normalized === 'f' || normalized === 'feminino') {
    return 'feminino';
  }

  if (normalized === 'outro') {
    return 'outro';
  }

  if (normalized === 'nao_informado' || normalized === 'não_informado') {
    return '';
  }

  return normalized;
}

function normalizeDateInputValue(value) {
  const text = normalizeFormValue(value);
  if (!text) return '';

  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  return '';
}

function setEnrollmentLoading(isLoading) {
  submitButton.disabled = isLoading;
  submitButton.textContent = isLoading
    ? 'Salvando...'
    : state.studentDialogMode === 'edit'
      ? 'Salvar alterações'
      : 'Salvar aluno';
  cancelButton.disabled = isLoading;
  dialogCloseButton.disabled = isLoading;
}

function setAttendanceSaving(isLoading) {
  state.attendanceSaving = isLoading;
  updateSaveButtonsState();
}

function setFeedback(message, isError) {
  formFeedback.textContent = message;
  formFeedback.classList.toggle('is-error', Boolean(isError));
}

function clearFeedback() {
  setFeedback('', false);
}

async function renderCreatedStudent(student) {
  void student;
}

function readSessionToken() {
  return AUTH_STORAGE.readToken(STORAGE_KEYS.token);
}

function clearStoredToken() {
  AUTH_STORAGE.clearToken(STORAGE_KEYS.token);
}

function hasValidClassId() {
  return Boolean(classId);
}

function normalizeClassId(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function goToLogin() {
  window.location.replace('../../../../../index.html');
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers: buildHeaders(options.body !== undefined),
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  });

  const payload = await APP_API_CLIENT.safeJson(response);

  if (!response.ok || APP_API_CLIENT.isFailurePayload?.(payload) || payload?.ok === false) {
    throw APP_API_CLIENT.createApiError(response, payload, {
      fallbackMessage: `Falha ao chamar ${path}.`
    });
  }

  const data = payload && typeof payload === 'object' && payload.ok === true && Object.prototype.hasOwnProperty.call(payload, 'data')
    ? payload.data
    : payload;

  return { response, payload: data };
}

function buildHeaders(hasBody) {
  const headers = {
    Authorization: `Bearer ${sessionToken}`
  };

  if (hasBody) {
    headers['Content-Type'] = 'application/json';
  }

  return headers;
}

function extractId(payload) {
  if (!payload || typeof payload !== 'object') return '';

  return (
    payload.id ||
    payload.idPessoa ||
    payload.id_pessoa ||
    payload.data?.id ||
    payload.data?.idPessoa ||
    payload.data?.id_pessoa ||
    payload.result?.id ||
    payload.result?.idPessoa ||
    payload.result?.id_pessoa ||
    payload.person?.id ||
    payload.person?.idPessoa ||
    ''
  );
}


function formatDisplayDate(value) {
  return String(value || '')
    .split('-')
    .reverse()
    .join('/');
}

function getBusinessISODate() {
  try {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bahia' });
  } catch {
    return new Date().toLocaleDateString('en-CA');
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
