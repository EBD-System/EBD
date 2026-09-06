const STORAGE_KEYS = window.APP_STORAGE_KEYS;
const AUTH_STORAGE = window.APP_AUTH_STORAGE;
const APP_REPORTS_SERVICE = window.APP_REPORTS_SERVICE;
const APP_ACCESS_DENIED_DIALOG = window.APP_ACCESS_DENIED_DIALOG;

const form = document.getElementById('reportForm');
const reportDateInput = document.getElementById('reportDate');
const searchButton = document.getElementById('searchButton');
const sendButton = document.getElementById('sendButton');
const attendanceButton = document.getElementById('attendanceButton');
const statusBanner = document.getElementById('statusBanner');
const resultsMeta = document.getElementById('resultsMeta');
const emptyState = document.getElementById('emptyState');
const reportContent = document.getElementById('reportContent');
const reportTitle = document.getElementById('reportTitle');
const reportPeriod = document.getElementById('reportPeriod');
const reportSummary = document.getElementById('reportSummary');
const resultsPanel = document.getElementById('resultsPanel');
const statCards = Array.from(document.querySelectorAll('[data-stat]'));

const state = {
  token: '',
  snapshot: null,
  lastCriteria: null,
  loading: false,
  pdfDetails: null
};

const session = readSession();
if (!session.token) {
  goToLogin();
} else {
  state.token = session.token;
  setDefaultDate();
  setStatus('Informe uma data e clique em Buscar para carregar o relatório.', 'info');
  wireEvents();
}

function readSession() {
  try {
    return {
      token: AUTH_STORAGE.readToken(STORAGE_KEYS.token)
    };
  } catch {
    return { token: '' };
  }
}

function setDefaultDate() {
  const today = new Date();
  reportDateInput.value = formatIsoDate(today);
}

function wireEvents() {
  form.addEventListener('submit', handleSearch);
  sendButton.addEventListener('click', handleDownloadReport);
  attendanceButton.addEventListener('click', handleDownloadAttendances);
  reportDateInput.addEventListener('input', resetDownloadState);
}

function setVisibility(node, visible) {
  if (!node) return;
  node.hidden = !visible;
  node.classList.toggle('hidden', !visible);
}

async function handleSearch(event) {
  event.preventDefault();

  if (state.loading) {
    return;
  }

  const reportDate = reportDateInput.value;

  if (!isIsoDate(reportDate)) {
    setStatus('Preencha uma data válida para buscar o relatório.', 'warning');
    clearReport();
    return;
  }

  state.loading = true;
  searchButton.disabled = true;
  sendButton.disabled = true;
  setStatus('Consultando o relatório...', 'info');
  setResultsMeta('Consulta em andamento...');
  clearReport(true);

  try {
    const result = await APP_REPORTS_SERVICE.searchByPeriod({
      date: reportDate,
      token: state.token
    });

    if (!result?.found) {
      state.snapshot = null;
    state.pdfDetails = null;
      setStatus(result?.reason || 'Nenhum relatório encontrado para o período informado.', 'warning');
      setResultsMeta('Nenhum resultado retornado.');
      clearReport();
      return;
    }

    state.snapshot = APP_REPORTS_SERVICE.createPdfSnapshot(result.report);
    state.pdfDetails = null;
    state.lastCriteria = { startDate: reportDate, endDate: reportDate, date: reportDate };

    renderReport(result.report);
    setStatus('Relatório encontrado. Os botões de download estão liberados.', 'success');
    setResultsMeta(`Consulta carregada de ${formatDisplayDate(reportDate)} até ${formatDisplayDate(reportDate)}.`);
    sendButton.disabled = false;
    attendanceButton.disabled = false;
  } catch (error) {
    state.snapshot = null;

    if (Number(error?.status) === 403) {
      openAccessDeniedDialog(error);
      setResultsMeta('Acesso restrito a este módulo de Relatórios.');
      clearReport();
      return;
    }

    if (error?.requiresRelogin) {
      setStatus(error.message, 'warning');
      setResultsMeta('Sessão expirada.');
      clearReport();
      goToLogin();
      return;
    }

    setStatus(error?.message || 'Falha ao consultar o relatório.', 'warning');
    setResultsMeta('Não foi possível concluir a consulta.');
    clearReport();

    openErrorDialog({
      message: 'Houve um erro. Fale com o suporte para corrigir.',
      trace: buildErrorTrace(error, 'Falha ao consultar o relatório de período.', state.lastCriteria || { date: reportDate })
    });
  } finally {
    state.loading = false;
    searchButton.disabled = false;
  }
}

function renderReport(report) {
  const details = normalizeReportDetails(report);

  setVisibility(resultsPanel, true);
  setVisibility(emptyState, false);
  setVisibility(reportContent, true);

  reportTitle.textContent = details.title;
  if (reportPeriod) {
    reportPeriod.textContent = details.dateLabel || 'Data normalizada indisponível.';
  }

  if (reportSummary) {
    reportSummary.innerHTML = buildReportSummaryMarkup(details);
  }
}

function clearReport(keepStructure = false) {
  setVisibility(reportContent, false);
  setVisibility(emptyState, true);
  setVisibility(resultsPanel, false);
  sendButton.disabled = true;
  attendanceButton.disabled = true;

  if (!keepStructure) {
    reportTitle.textContent = 'Relatório carregado';
    if (reportPeriod) {
      reportPeriod.textContent = 'O relatório normalizado aparecerá aqui.';
    }
    if (reportSummary) {
      reportSummary.innerHTML = `
        <p class="placeholder">O relatório aparecerá aqui assim que você buscar um período válido.</p>
      `;
    }
  }
}

function resetDownloadState() {
  state.snapshot = null;
  state.pdfDetails = null;
  sendButton.disabled = true;
  attendanceButton.disabled = true;
  if (!state.loading) {
    setStatus('Ajuste a data e busque novamente para liberar o download.', 'info');
  }
}

async function handleDownloadReport() {
  if (!state.snapshot) {
    setStatus('Busque um relatório antes de baixar o PDF.', 'warning');
    return;
  }

  if (!window.jspdf?.jsPDF) {
    setStatus('A biblioteca de PDF não foi carregada. Verifique o script do jsPDF na página.', 'warning');
    return;
  }

  const fileName = buildPdfFileName(state.snapshot);

  try {
    const doc = buildPeriodPdf(state.snapshot);
    downloadPdfDocument(doc, fileName);
    setStatus('Relatório baixado em PDF.', 'success');
    setResultsMeta(`PDF baixado: ${fileName}.`);
  } catch (error) {
    try {
      const fallbackDoc = buildFallbackPeriodPdf(state.snapshot, error);
      downloadPdfDocument(fallbackDoc, fileName);
      setStatus('O layout principal falhou; um PDF alternativo foi baixado.', 'warning');
      setResultsMeta(`PDF alternativo baixado: ${fileName}.`);
    } catch (fallbackError) {
      setStatus(fallbackError?.message || 'Não foi possível gerar o PDF.', 'warning');
      openErrorDialog({
        message: 'Houve um erro ao gerar o PDF.',
        trace: buildErrorTrace(fallbackError, 'Falha ao gerar o PDF alternativo do relatório de período.', state.lastCriteria || {})
      });
    }
  }
}

async function handleDownloadAttendances() {
  if (!state.lastCriteria) {
    setStatus('Busque um relatório antes de baixar as presenças.', 'warning');
    return;
  }

  if (!window.jspdf?.jsPDF) {
    setStatus('A biblioteca de PDF não foi carregada. Verifique o script do jsPDF na página.', 'warning');
    return;
  }

  const baseName = buildPdfFileName(state.snapshot || { title: 'presencas' });
  const fileName = baseName.replace(/\.pdf$/i, '-presencas.pdf');
  let pdfDetails = state.pdfDetails;

  try {
    setStatus('Buscando os dados de presença...', 'info');
    const detailResult = await APP_REPORTS_SERVICE.fetchPeriodPdfDetails({
      startDate: state.lastCriteria.startDate,
      endDate: state.lastCriteria.endDate,
      token: state.token
    });

    if (detailResult?.found) {
      pdfDetails = detailResult.report;
      state.pdfDetails = pdfDetails;
    } else {
      setStatus(detailResult?.reason || 'Não foi possível encontrar dados de presença para o período informado.', 'warning');
      return;
    }
  } catch (error) {
    if (Number(error?.status) === 403) {
      openAccessDeniedDialog(error);
      setResultsMeta('Acesso restrito a este módulo de Relatórios.');
      return;
    }

    if (error?.requiresRelogin) {
      setStatus(error.message, 'warning');
      setResultsMeta('Sessão expirada.');
      goToLogin();
      return;
    }

    setStatus('Não foi possível carregar os dados de presença.', 'warning');
    openErrorDialog({
      message: 'Houve um erro ao buscar as presenças.',
      trace: buildErrorTrace(error, 'Falha ao buscar os dados detalhados de presença.', state.lastCriteria || {})
    });
    return;
  }

  try {
    const doc = buildAttendanceOnlyPdf(pdfDetails);
    downloadPdfDocument(doc, fileName);
    setStatus('Presenças baixadas em PDF.', 'success');
    setResultsMeta(`PDF baixado: ${fileName}.`);
  } catch (error) {
    setStatus(error?.message || 'Não foi possível gerar o PDF de presenças.', 'warning');
    openErrorDialog({
      message: 'Houve um erro ao gerar o PDF de presenças.',
      trace: buildErrorTrace(error, 'Falha ao gerar o PDF de presenças.', state.lastCriteria || {})
    });
  }
}

function downloadPdfDocument(doc, fileName) {
  const blob = doc.output('blob');
  if (!blob) {
    throw new Error('Não foi possível criar o arquivo PDF.');
  }

  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => {
    try {
      URL.revokeObjectURL(blobUrl);
    } catch {
      // Ignora falhas de revoke.
    }
  }, 1000);
}

function normalizeReportDetails(report = {}) {
  const summaryRoot = extractSummaryRoot(report);
  const summarySource = summaryRoot && typeof summaryRoot === 'object' ? summaryRoot : {};
  const activities = extractActivities(report);

  const cards = buildTurmaCards(activities, summarySource);
  const totalCard = buildTotalReportCard(cards, summarySource);

  const dateLabel = normalizeDisplayDate(
    report?.consultedAt ||
      report?.data_referencia ||
      report?.periodo?.endDate ||
      report?.periodo?.startDate ||
      report?.date ||
      report?.createdAt ||
      state.lastCriteria?.endDate
  );

  return {
    title: String(report?.title || 'Relatório carregado'),
    subtitle: String(report?.subtitle || buildPeriodSubtitle(report?.periodo || {})),
    dateLabel,
    cards,
    totalCard,
    activities,
    period: report?.periodo || {}
  };
}

function buildReportSummaryMarkup(details) {
  const cards = [];

  if (details.totalCard) {
    cards.push(details.totalCard);
  }

  if (Array.isArray(details.cards) && details.cards.length) {
    cards.push(...details.cards);
  }

  if (!cards.length) {
    return `
      <p class="placeholder">O relatório aparecerá aqui assim que você buscar um período válido.</p>
    `;
  }

  return `
    <div class="report-summary__grid">
      ${cards.map((card) => buildReportCardMarkup(card)).join('')}
    </div>
  `;
}

function buildReportCardMarkup(card) {
  const lines = Array.isArray(card?.lines) ? card.lines : [];

  return `
    <article class="report-summary__item${card?.isTotal ? ' report-summary__item--total' : ''}">
      <header class="report-summary__header">
        <p class="report-summary__label">${escapeHtml(card?.title || 'Turma')}</p>
        ${card?.subtitle ? `<p class="report-summary__subtitle">${escapeHtml(card.subtitle)}</p>` : ''}
      </header>
      <div class="report-summary__lines">
        ${lines
          .map(
            ([label, value]) => `
              <p><span>${escapeHtml(label)}:</span> ${escapeHtml(value)}</p>
            `
          )
          .join('')}
      </div>
    </article>
  `;
}

function buildTurmaCards(activities = [], summarySource = {}) {
  const groups = new Map();

  activities.forEach((activity, index) => {
    const classTitle = resolveClassTitle(activity, index);
    const classKey = String(activity?.id_classe ?? activity?.classId ?? normalizeLookupKey(classTitle) ?? index);

    const current = groups.get(classKey) || {
      title: classTitle,
      subtitle: '',
      matriculados: null,
      ausentes: 0,
      presentes: 0,
      visitantes: 0,
      biblias: 0,
      revistas: 0,
      ofertas: 0,
      dates: []
    };

    current.title = current.title || classTitle;
    current.subtitle = resolveCardSubtitle(activity, current.subtitle);
    current.matriculados = pickLargestCount(current.matriculados, normalizeCount(firstDefined(activity, ['total_alunos', 'matriculados', 'totalAlunos', 'enrolled', 'total'])));
    current.ausentes += normalizeCount(firstDefined(activity, ['ausentes', 'absentCount', 'faltas', 'faltantes'])) || 0;
    current.presentes += normalizeCount(firstDefined(activity, ['presentes', 'presentCount', 'present', 'presenceCount'])) || 0;
    current.visitantes += normalizeCount(firstDefined(activity, ['visitantes', 'visitorCount', 'visitors'])) || 0;
    current.biblias += normalizeCount(firstDefined(activity, ['biblias', 'bíblias', 'biblia', 'bibleCount', 'bibles'])) || 0;
    current.revistas += normalizeCount(firstDefined(activity, ['revistas', 'revistaCount', 'magazines'])) || 0;
    current.ofertas += parseCurrencyValue(firstDefined(activity, ['value', 'oferta', 'offerings', 'offer'])) || 0;

    const dateLabel = normalizeDisplayDate(firstDefined(activity, ['date', 'data_chamada', 'dataChamada']));
    if (dateLabel && !current.dates.includes(dateLabel)) {
      current.dates.push(dateLabel);
    }

    groups.set(classKey, current);
  });

  const cards = Array.from(groups.values()).map((card) => {
    const matriculados = Number.isFinite(card.matriculados) ? card.matriculados : 0;
    const ausentes = Number.isFinite(card.ausentes) ? card.ausentes : 0;
    const presentes = Number.isFinite(card.presentes) ? card.presentes : 0;
    const visitantes = Number.isFinite(card.visitantes) ? card.visitantes : 0;
    const biblias = Number.isFinite(card.biblias) ? card.biblias : 0;
    const revistas = Number.isFinite(card.revistas) ? card.revistas : 0;
    const ofertas = Number.isFinite(card.ofertas) ? card.ofertas : 0;
    const total = presentes + visitantes;

    return {
      title: card.title,
      subtitle: card.subtitle || (card.dates.length ? card.dates.join(' • ') : ''),
      isTotal: false,
      lines: [
        ['Matriculados', formatCardCountValue(matriculados)],
        ['Ausentes', formatAbsentValue(ausentes)],
        ['Presentes', formatCardCountValue(presentes)],
        ['Visitantes', formatCardCountValue(visitantes)],
        ['Total', formatCardCountValue(total)],
        ['Bíblias', formatCardCountValue(biblias)],
        ['Revistas', formatCardCountValue(revistas)],
        ['Ofertas', formatOfferValue(ofertas)]
      ]
    };
  });

  if (!cards.length && summarySource) {
    const title = String(summarySource.title || summarySource.classe || 'Total do período').trim() || 'Total do período';
    const fallbackTotal = normalizeCount(summarySource.total_alunos ?? summarySource.totalAlunos ?? summarySource.totalRecords) || 0;
    const fallbackPresentes = normalizeCount(summarySource.presences ?? summarySource.presentes) || 0;
    const fallbackVisitantes = normalizeCount(summarySource.visitors ?? summarySource.visitantes) || 0;
    const fallbackAusentes = normalizeCount(summarySource.ausentes) || 0;
    const fallbackBiblias = normalizeCount(summarySource.biblias) || 0;
    const fallbackRevistas = normalizeCount(summarySource.revistas) || 0;
    const fallbackOfertas = parseCurrencyValue(summarySource.offerings ?? summarySource.ofertas) || 0;

    cards.push({
      title,
      subtitle: '',
      isTotal: false,
      lines: [
        ['Matriculados', formatCardCountValue(fallbackTotal)],
        ['Ausentes', formatAbsentValue(fallbackAusentes)],
        ['Presentes', formatCardCountValue(fallbackPresentes)],
        ['Visitantes', formatCardCountValue(fallbackVisitantes)],
        ['Total', formatCardCountValue(fallbackTotal + fallbackVisitantes)],
        ['Bíblias', formatCardCountValue(fallbackBiblias)],
        ['Revistas', formatCardCountValue(fallbackRevistas)],
        ['Ofertas', formatOfferValue(fallbackOfertas)]
      ]
    });
  }

  return cards;
}

function buildTotalReportCard(cards = [], summarySource = {}) {
  if (!Array.isArray(cards) || cards.length === 0) {
    const fallbackTitle = String(summarySource.title || 'Total do período').trim() || 'Total do período';
    const totalMatriculados = normalizeCount(summarySource.total_alunos ?? summarySource.totalAlunos ?? summarySource.totalRecords) || 0;
    const totalVisitantes = normalizeCount(summarySource.visitors ?? summarySource.visitantes) || 0;
    const totalAusentes = normalizeCount(summarySource.ausentes) || 0;
    const totalPresentes = normalizeCount(summarySource.presences ?? summarySource.presentes) || 0;
    const totalBiblias = normalizeCount(summarySource.biblias) || 0;
    const totalRevistas = normalizeCount(summarySource.revistas) || 0;
    const totalOfertas = parseCurrencyValue(summarySource.offerings ?? summarySource.ofertas) || 0;
    const total = totalPresentes + totalVisitantes;

    return {
      title: fallbackTitle,
      subtitle: 'Consolidado do período',
      isTotal: true,
      lines: [
        ['Matriculados', formatCardCountValue(totalMatriculados)],
        ['Ausentes', formatAbsentValue(totalAusentes)],
        ['Presentes', formatCardCountValue(totalPresentes)],
        ['Visitantes', formatCardCountValue(totalVisitantes)],
        ['Total', formatCardCountValue(total)],
        ['Bíblias', formatCardCountValue(totalBiblias)],
        ['Revistas', formatCardCountValue(totalRevistas)],
        ['Ofertas', formatOfferValue(totalOfertas)]
      ]
    };
  }

  const totalMatriculados = cards.reduce((acc, card) => acc + (normalizeCountFromText(card, 0, 'Matriculados') || 0), 0);
  const totalAusentes = cards.reduce((acc, card) => acc + (normalizeCountFromText(card, 1, 'Ausentes') || 0), 0);
  const totalPresentes = cards.reduce((acc, card) => acc + (normalizeCountFromText(card, 2, 'Presentes') || 0), 0);
  const totalVisitantes = cards.reduce((acc, card) => acc + (normalizeCountFromText(card, 3, 'Visitantes') || 0), 0);
  const totalBiblias = cards.reduce((acc, card) => acc + (normalizeCountFromText(card, 5, 'Bíblias') || 0), 0);
  const totalRevistas = cards.reduce((acc, card) => acc + (normalizeCountFromText(card, 6, 'Revistas') || 0), 0);
  const totalOfertas = cards.reduce((acc, card) => acc + (normalizeMoneyFromText(card, 7) || 0), 0);
  const total = cards.reduce((acc, card) => acc + (normalizeCountFromText(card, 4, 'Total') || 0), 0);

  return {
    title: 'Total do período',
    subtitle: 'Consolidado do período',
    isTotal: true,
    lines: [
      ['Matriculados', formatCardCountValue(totalMatriculados)],
      ['Ausentes', formatAbsentValue(totalAusentes)],
      ['Presentes', formatCardCountValue(totalPresentes)],
      ['Visitantes', formatCardCountValue(totalVisitantes)],
      ['Total', formatCardCountValue(total)],
      ['Bíblias', formatCardCountValue(totalBiblias)],
      ['Revistas', formatCardCountValue(totalRevistas)],
      ['Ofertas', formatOfferValue(totalOfertas)]
    ]
  };
}

function normalizeCountFromText(card, index, label) {
  const line = Array.isArray(card?.lines) ? card.lines[index] : null;
  if (!Array.isArray(line) || line.length < 2) {
    return null;
  }

  const [lineLabel, value] = line;
  if (String(lineLabel || '').toLowerCase() !== String(label || '').toLowerCase()) {
    return null;
  }

  return normalizeCount(value);
}

function normalizeMoneyFromText(card, index) {
  const line = Array.isArray(card?.lines) ? card.lines[index] : null;
  if (!Array.isArray(line) || line.length < 2) {
    return null;
  }

  return parseCurrencyValue(line[1]);
}

function resolveClassTitle(activity = {}, index = 0) {
  const title = String(
    firstDefined(activity, ['title', 'classe', 'className', 'nome', 'turma']) ||
      `Turma ${index + 1}`
  )
    .trim();

  return title || `Turma ${index + 1}`;
}

function resolveCardSubtitle(activity = {}, currentSubtitle = '') {
  void activity;
  return currentSubtitle || '';
}

function pickLargestCount(current, next) {
  const currentValue = Number.isFinite(current) ? current : null;
  const nextValue = Number.isFinite(next) ? next : null;

  if (!Number.isFinite(currentValue)) return nextValue;
  if (!Number.isFinite(nextValue)) return currentValue;
  return Math.max(currentValue, nextValue);
}

function firstDefined(source = {}, keys = []) {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return undefined;
}

function formatCardCountValue(value) {
  const numeric = normalizeCount(value);
  return Number.isFinite(numeric) ? String(numeric) : '0';
}

function formatAbsentValue(value) {
  const numeric = normalizeCount(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 'Não houve';
  }
  return String(numeric);
}

function syncStatCards(values = {}) {
  const stats = [
    { key: 'matriculados', label: 'Matriculados', value: formatSummaryValue(values.matriculados) },
    { key: 'presentes', label: 'Presentes', value: formatSummaryValue(values.presentes) },
    { key: 'visitantes', label: 'Visitantes', value: formatSummaryValue(values.visitantes) },
    { key: 'ofertas', label: 'Ofertas', value: formatOfferValue(values.ofertas) }
  ];

  statCards.forEach((card) => {
    const key = String(card.dataset.stat || '').trim();
    const item = stats.find((entry) => entry.key === key);
    if (!item) return;

    const valueNode = card.querySelector('[data-value]');
    const labelNode = card.querySelector('[data-label]');
    if (valueNode) valueNode.textContent = item.value;
    if (labelNode) labelNode.textContent = item.label;
  });
}

function extractActivities(report = {}) {
  const candidates = [
    report?.activities,
    report?.itens,
    report?.items,
    report?.rows,
    report?.data?.activities,
    report?.data?.itens,
    report?.result?.activities,
    report?.payload?.activities
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.slice();
    }
  }

  return [];
}

function extractSummaryRoot(payload) {
  const candidates = [
    payload?.data?.summary,
    payload?.summary,
    payload?.data?.data?.summary,
    payload?.data?.result?.summary,
    payload?.data,
    payload?.result,
    payload?.payload,
    payload?.attendanceSummary,
    payload?.callSummary,
    payload?.stats,
    payload?.statistics
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object') {
      return candidate;
    }
  }

  return payload;
}

function extractCountFromSummary(root, keys) {
  const value = findValueInObjectTree(root, keys);
  return normalizeCount(value);
}

function extractMoneyFromSummary(root, keys) {
  const value = findValueInObjectTree(root, keys);
  return normalizeMoney(value);
}

function sumActivityValues(activities, keys) {
  let total = 0;
  let found = false;

  activities.forEach((activity) => {
    const value = findValueInObjectTree(activity, keys);
    const numeric = normalizeCount(value);
    if (Number.isFinite(numeric)) {
      total += numeric;
      found = true;
    }
  });

  return found ? total : null;
}

function sumActivityMoneyValues(activities, keys) {
  let total = 0;
  let found = false;

  activities.forEach((activity) => {
    const value = findValueInObjectTree(activity, keys);
    const numeric = normalizeMoney(value);
    if (Number.isFinite(numeric)) {
      total += numeric;
      found = true;
    }
  });

  return found ? total : null;
}

function normalizeMoney(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = parseCurrencyValue(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function findValueInObjectTree(root, keys) {
  const normalizedKeys = keys.map(normalizeLookupKey);
  const queue = [root];
  const seen = new Set();

  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== 'object' || seen.has(current)) continue;
    seen.add(current);

    for (const [key, value] of Object.entries(current)) {
      if (normalizedKeys.includes(normalizeLookupKey(key))) {
        return value;
      }

      if (value && typeof value === 'object') {
        queue.push(value);
      }
    }
  }

  return undefined;
}

function normalizeLookupKey(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

function normalizeCount(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }

  const raw = String(value)
    .trim()
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');

  if (!raw) return null;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;

  return Math.max(0, Math.trunc(parsed));
}

function sumCounts(a, b) {
  if (!Number.isFinite(a) && !Number.isFinite(b)) {
    return null;
  }

  return (Number.isFinite(a) ? a : 0) + (Number.isFinite(b) ? b : 0);
}

function formatSummaryValue(value) {
  if (value === undefined || value === null || value === '') {
    return 'Não houve';
  }

  if (typeof value === 'number') {
    return value > 0 ? String(value) : 'Não houve';
  }

  const parsed = Number(String(value).replace(',', '.').replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 'Não houve';
  }

  return String(Math.trunc(parsed));
}

function formatOfferValue(value) {
  const numeric = parseCurrencyValue(value);
  const safeValue = Number.isFinite(numeric) ? numeric : 0;

  return safeValue.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function parseCurrencyValue(value) {
  if (value === undefined || value === null || value === '') {
    return NaN;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : NaN;
  }

  let raw = String(value).trim();
  if (!raw) {
    return NaN;
  }

  raw = raw.replace(/[^\d.,-]/g, '');

  if (!raw) {
    return NaN;
  }

  const hasComma = raw.includes(',');
  const hasDot = raw.includes('.');

  if (hasComma && hasDot) {
    const lastComma = raw.lastIndexOf(',');
    const lastDot = raw.lastIndexOf('.');

    if (lastComma > lastDot) {
      raw = raw.replace(/\./g, '');
      raw = raw.replace(',', '.');
    } else {
      raw = raw.replace(/,/g, '');
    }
  } else if (hasComma) {
    raw = raw.replace(/\./g, '');
    raw = raw.replace(',', '.');
  } else if (hasDot) {
    const parts = raw.split('.');
    if (parts.length > 2) {
      raw = parts.join('');
    }
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function buildPdfFileName(report) {
  const details = normalizeReportDetails(report);
  const start = details.period?.startDate || state.lastCriteria?.startDate || 'periodo';
  const end = details.period?.endDate || state.lastCriteria?.endDate || 'periodo';
  const title =
    String(details.title || 'relatorio-periodo')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'relatorio-periodo';

  return `${title}-${start}-ate-${end}.pdf`;
}

function buildPeriodPdf(report) {
  const details = normalizeReportDetails(report);
  const doc = new window.jspdf.jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  const pages = buildPeriodCardsPdfPages(details);
  const title = String(details.title || 'Relatório de período');
  const subject = String(details.subtitle || buildPeriodSubtitle(details.period));

  doc.setProperties({
    title,
    subject,
    author: 'EBD',
    creator: 'EBD'
  });

  pages.forEach((page, index) => {
    if (index > 0) {
      doc.addPage();
    }

    const meta = {
      pageNumber: index + 1,
      totalPages: pages.length
    };

    if (page.type === 'attendance') {
      drawAttendancePage(doc, page, meta);
      return;
    }

    drawPeriodCardsPage(doc, page, meta);
  });

  return doc;
}

function buildAttendanceOnlyPdf(pdfDetails = null) {
  const pages = buildAttendancePdfPages(pdfDetails);
  if (!pages.length) {
    throw new Error('Nenhum dado de presença encontrado para o período informado.');
  }

  const doc = new window.jspdf.jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  doc.setProperties({
    title: 'Presenças do período',
    subject: 'Detalhamento de presença por data e classe',
    author: 'EBD',
    creator: 'EBD'
  });

  pages.forEach((page, index) => {
    if (index > 0) {
      doc.addPage();
    }

    drawAttendancePage(doc, page, {
      pageNumber: index + 1,
      totalPages: pages.length
    });
  });

  return doc;
}

function buildFallbackPeriodPdf(report, error) {
  const details = normalizeReportDetails(report);
  const doc = new window.jspdf.jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  const width = doc.internal.pageSize.getWidth();
  const margin = 16;
  const contentWidth = width - margin * 2;

  doc.setFillColor(247, 249, 252);
  doc.rect(0, 0, width, doc.internal.pageSize.getHeight(), 'F');

  doc.setFillColor(23, 43, 77);
  doc.roundedRect(margin, margin, contentWidth, 28, 4, 4, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(String(details.title || 'Relatório de período'), margin + 8, margin + 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.2);
  doc.text(String(details.subtitle || 'Resumo consolidado do período.'), margin + 8, margin + 20);

  const lines = [
    details.dateLabel ? `Data normalizada: ${details.dateLabel}` : 'Data normalizada indisponível.',
    `Matriculados: ${formatCardCountValue(details.matriculados)}`,
    `Ausentes: ${formatAbsentValue(details.ausentes)}`,
    `Presentes: ${formatCardCountValue(details.presentes)}`,
    `Visitantes: ${formatCardCountValue(details.visitantes)}`,
    `Total: ${formatCardCountValue(details.total)}`,
    `Bíblias: ${formatCardCountValue(details.biblias)}`,
    `Revistas: ${formatCardCountValue(details.revistas)}`,
    `Ofertas: ${formatOfferValue(details.ofertas)}`
  ];

  if (error?.message) {
    lines.push('', `Layout principal: ${error.message}`);
  }

  doc.setTextColor(23, 43, 77);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(doc.splitTextToSize(lines.join('\n'), contentWidth), margin, margin + 44);

  if (details.activities.length) {
    doc.setFontSize(9);
    doc.setTextColor(91, 102, 122);
    doc.text('O PDF alternativo foi gerado porque o layout principal não pôde ser renderizado.', margin, doc.internal.pageSize.getHeight() - 12);
  }

  return doc;
}


function buildAttendancePdfPages(pdfDetails = null) {
  const sourceRows = collectAttendanceRows(pdfDetails);
  if (!sourceRows.length) {
    return [];
  }

  const groups = new Map();
  sourceRows.forEach((row) => {
    const normalized = normalizeAttendanceRow(row);
    const key = `${normalized.dateKey}::${normalized.classKey}`;
    const current = groups.get(key) || {
      dateKey: normalized.dateKey,
      dateLabel: normalized.dateLabel,
      classKey: normalized.classKey,
      className: normalized.className,
      rows: []
    };

    current.rows.push(normalized);
    groups.set(key, current);
  });

  const pages = [];
  Array.from(groups.values())
    .sort((a, b) => {
      const dateCompare = String(a.dateKey || '').localeCompare(String(b.dateKey || ''));
      if (dateCompare !== 0) return dateCompare;
      return String(a.className || '').localeCompare(String(b.className || ''));
    })
    .forEach((group) => {
      const pageChunks = paginateAttendanceRows(group.rows);
      pageChunks.forEach((chunk, index) => {
        const summary = chunk.reduce(
          (acc, row) => {
            acc.total += 1;
            if (row.presence === 'presente' || row.presence === 'atrasado') acc.presentes += 1;
            if (row.presence === 'atrasado') acc.atrasados += 1;
            if (row.presence === 'ausente') acc.ausentes += 1;
            if (row.studentStatus === 'ativo') acc.ativos += 1;
            if (row.studentStatus === 'inativo') acc.inativos += 1;
            return acc;
          },
          {
            total: 0,
            presentes: 0,
            atrasados: 0,
            ausentes: 0,
            ativos: 0,
            inativos: 0
          }
        );

        pages.push({
          type: 'attendance',
          title: `${group.className} • ${group.dateLabel}`,
          subtitle: 'Presentes e ausentes da classe',
          note: `Presentes: ${summary.presentes} • Atrasados: ${summary.atrasados} • Ausentes: ${summary.ausentes} • Ativos: ${summary.ativos} • Inativos: ${summary.inativos}`,
          summary,
          rows: chunk,
          pageNote:
            index === 0
              ? `Detalhamento de presença e status do aluno • ${group.rows.length} registro(s)`
              : `Continuação do detalhamento de presença • página ${index + 1}`
        });
      });
    });

  return pages;
}

function collectAttendanceRows(pdfDetails = null) {
  if (!pdfDetails || typeof pdfDetails !== 'object') {
    return [];
  }

  if (Array.isArray(pdfDetails.rows) && pdfDetails.rows.length) {
    return pdfDetails.rows.slice();
  }

  if (Array.isArray(pdfDetails.dailyPages)) {
    return pdfDetails.dailyPages.flatMap((page) => (Array.isArray(page?.rows) ? page.rows : []));
  }

  if (Array.isArray(pdfDetails.itens)) {
    return pdfDetails.itens.flatMap((page) => (Array.isArray(page?.rows) ? page.rows : []));
  }

  return [];
}

function normalizeAttendanceRow(row = {}) {
  const dateKey = String(firstDefined(row, ['data_chamada', 'date']) || '').trim();
  const className = String(firstDefined(row, ['classe', 'className', 'title']) || 'Classe').trim() || 'Classe';
  return {
    dateKey,
    dateLabel: normalizeDisplayDate(dateKey) || dateKey || 'Data indisponível',
    classKey: String(firstDefined(row, ['id_classe', 'classId']) || className).trim() || className,
    className,
    studentName: String(firstDefined(row, ['nome', 'studentName']) || 'Aluno').trim() || 'Aluno',
    presence: String(firstDefined(row, ['status_presenca', 'presence']) || '').trim().toLowerCase() || 'ausente',
    studentStatus: String(firstDefined(row, ['status_aluno', 'studentStatus']) || '').trim().toLowerCase() || 'ativo'
  };
}

function paginateAttendanceRows(rows = []) {
  const width = 210;
  const height = 297;
  const margin = 12;
  const contentWidth = width - margin * 2;
  const headerTop = margin + 44;
  const listBottom = height - 18;
  const availableHeight = listBottom - headerTop;
  const nameWidth = 88;
  const presenceWidth = 48;
  const statusWidth = contentWidth - nameWidth - presenceWidth - 2;
  const fontSize = 8.6;
  const lineHeight = 3.4;

  const pages = [];
  let currentRows = [];
  let currentHeight = 0;

  rows.forEach((row) => {
    const nameLines = measurePdfLines(row.studentName, nameWidth, fontSize);
    const rowHeight = Math.max(9.5, Math.max(nameLines.length, 1) * lineHeight + 4);

    if (currentRows.length && currentHeight + rowHeight > availableHeight) {
      pages.push(currentRows);
      currentRows = [];
      currentHeight = 0;
    }

    currentRows.push({
      ...row,
      nameLines,
      rowHeight
    });
    currentHeight += rowHeight;
  });

  if (currentRows.length || !pages.length) {
    pages.push(currentRows);
  }

  return pages;
}

function drawAttendancePage(doc, page, meta) {
  const shell = drawPdfShell(doc, page, meta);
  const rows = Array.isArray(page.rows) ? page.rows : [];
  const nameWidth = 88;
  const presenceWidth = 48;
  const statusWidth = shell.contentWidth - nameWidth - presenceWidth - 2;
  const rowTop = shell.margin + 44;
  const rowBottom = shell.height - 18;
  const headerY = rowTop - 4;

  doc.setDrawColor(217, 224, 235);
  doc.setLineWidth(0.2);
  doc.line(shell.margin, headerY, shell.width - shell.margin, headerY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.4);
  doc.setTextColor(91, 102, 122);
  doc.text('Aluno', shell.margin, headerY - 1.5);
  doc.text('Presença', shell.margin + nameWidth + 2, headerY - 1.5);
  doc.text('Status do aluno', shell.width - shell.margin, headerY - 1.5, { align: 'right' });
  doc.line(shell.margin, headerY + 2, shell.width - shell.margin, headerY + 2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.6);
  doc.setTextColor(23, 43, 77);

  let y = rowTop;
  rows.forEach((row, index) => {
    const fill = index % 2 === 0 ? [255, 255, 255] : [248, 251, 255];
    doc.setFillColor(fill[0], fill[1], fill[2]);
    doc.roundedRect(shell.margin, y - 1, shell.contentWidth, row.rowHeight, 2, 2, 'F');

    doc.setTextColor(21, 39, 66);
    doc.text(row.nameLines || [row.studentName], shell.margin + 1, y + 3.2);

    const presenceText = formatAttendancePresenceLabel(row.presence);
    const statusText = formatStudentStatusLabel(row.studentStatus);
    doc.text(presenceText, shell.margin + nameWidth + 1, y + 3.2);
    doc.text(statusText, shell.width - shell.margin - 1, y + 3.2, { align: 'right' });

    doc.setDrawColor(230, 236, 244);
    doc.line(shell.margin + 1, Math.min(y + row.rowHeight, rowBottom), shell.width - shell.margin - 1, Math.min(y + row.rowHeight, rowBottom));
    y += row.rowHeight + 1;
  });

  doc.setDrawColor(221, 228, 239);
  doc.line(shell.margin, shell.height - 16, shell.width - shell.margin, shell.height - 16);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.4);
  doc.text('O detalhe diário foi acrescentado ao PDF consolidado.', shell.margin, shell.height - 10);
}

function formatAttendancePresenceLabel(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'presente') return 'Presente';
  if (raw === 'atrasado') return 'Atrasado';
  if (raw === 'ausente') return 'Ausente';
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : 'Ausente';
}

function formatStudentStatusLabel(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'ativo') return 'Ativo';
  if (raw === 'inativo') return 'Inativo';
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : 'Ativo';
}


function buildPeriodCardsPdfPages(details) {
  const cards = Array.isArray(details.cards) ? details.cards : [];
  const pages = [];
  const chunkSize = 4;
  const chunks = cards.length ? chunkArray(cards, chunkSize) : [[]];

  chunks.forEach((chunk, index) => {
    pages.push({
      type: 'cards',
      title: details.title,
      subtitle: details.subtitle,
      note: details.dateLabel ? `Data normalizada: ${details.dateLabel}` : 'Data normalizada indisponível.',
      totalCard: index === 0 ? details.totalCard || null : null,
      cards: chunk,
      pageNote:
        index === 0
          ? `Consolidação dos cards por turma • ${cards.length} turma(s) no total`
          : `Continuação dos cards por turma • ${chunk.length} turma(s) nesta página`
    });
  });

  return pages;
}

function drawPeriodCardsPage(doc, page, meta) {
  const shell = drawPdfShell(doc, page, meta);
  const totalCard = page.totalCard || null;
  const cards = Array.isArray(page.cards) ? page.cards : [];
  const gap = 6;
  const cardWidth = (shell.contentWidth - gap) / 2;
  const cardHeight = 50;
  const totalHeight = totalCard ? 54 : 0;
  let cursorY = shell.margin + 42;

  if (totalCard) {
    drawReportPdfCard(doc, shell.margin, cursorY, shell.contentWidth, totalHeight, totalCard, true);
    cursorY += totalHeight + 8;
  }

  cards.forEach((card, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = shell.margin + col * (cardWidth + gap);
    const y = cursorY + row * (cardHeight + gap);
    drawReportPdfCard(doc, x, y, cardWidth, cardHeight, card, false);
  });

  doc.setDrawColor(221, 228, 239);
  doc.line(shell.margin, shell.height - 16, shell.width - shell.margin, shell.height - 16);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.4);
  doc.text(String(page.pageNote || 'Snapshot consolidado do frontend.'), shell.margin, shell.height - 10);
}

function drawReportPdfCard(doc, x, y, width, height, card, highlight = false) {
  const fill = highlight ? [234, 242, 255] : [255, 255, 255];
  const border = highlight ? [15, 138, 95] : [217, 224, 235];
  doc.setFillColor(fill[0], fill[1], fill[2]);
  doc.setDrawColor(border[0], border[1], border[2]);
  doc.roundedRect(x, y, width, height, 3, 3, 'FD');

  doc.setTextColor(23, 43, 77);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(highlight ? 12.2 : 11.2);
  doc.text(String(card?.title || 'Turma'), x + 5, y + 8);

  if (card?.subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(91, 102, 122);
    doc.text(String(card.subtitle), x + 5, y + 13);
  }

  const lines = Array.isArray(card?.lines) ? card.lines : [];
  const startY = card?.subtitle ? y + 19 : y + 15;
  const lineStep = highlight ? 4.4 : 4.3;

  lines.forEach(([label, value], index) => {
    const lineY = startY + index * lineStep;
    const text = `${label}: ${value}`;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(36, 52, 83);
    doc.text(text, x + 5, lineY);
  });
}

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function buildPeriodPdfPages(details) {
  const activities = Array.isArray(details.activities) ? details.activities : [];
  const pages = [
    {
      type: 'summary',
      title: details.title,
      subtitle: details.subtitle,
      note: `Data normalizada: ${details.dateLabel || 'indisponível'}`,
      summary: {
        matriculados: Number.isFinite(details.matriculados) ? details.matriculados : 0,
        ausentes: Number.isFinite(details.ausentes) ? details.ausentes : 0,
        presentes: Number.isFinite(details.presentes) ? details.presentes : 0,
        visitantes: Number.isFinite(details.visitantes) ? details.visitantes : 0,
        total: Number.isFinite(details.total) ? details.total : 0,
        biblias: Number.isFinite(details.biblias) ? details.biblias : 0,
        revistas: Number.isFinite(details.revistas) ? details.revistas : 0,
        ofertas: Number.isFinite(details.ofertas) ? details.ofertas : 0
      }
    }
  ];

  if (activities.length) {
    pages.push(...paginatePeriodActivities(activities, details));
  }

  return pages;
}

function buildPeriodSubtitle(period = {}) {
  const startDate = formatDisplayDate(period.startDate);
  const endDate = formatDisplayDate(period.endDate);

  if (startDate && endDate) {
    return `Consulta carregada de ${startDate} até ${endDate}.`;
  }

  if (startDate || endDate) {
    return `Consulta carregada em ${startDate || endDate}.`;
  }

  return 'Consulta carregada por período.';
}

function paginatePeriodActivities(activities, basePage = {}) {
  const width = 210;
  const height = 297;
  const margin = 12;
  const contentWidth = width - margin * 2;
  const listTop = margin + 44;
  const listBottom = height - 18;
  const availableHeight = listBottom - listTop;
  const dateWidth = 24;
  const titleWidth = 32;
  const valueWidth = 28;
  const descriptionWidth = Math.max(44, contentWidth - dateWidth - titleWidth - valueWidth - 8);
  const fontSize = 8.4;
  const lineHeight = 3.2;

  const pages = [];
  let currentRows = [];
  let currentHeight = 0;

  activities.forEach((activity) => {
    const row = normalizeActivityRow(activity);
    const descriptionLines = measurePdfLines(row.description, descriptionWidth, fontSize);
    const titleLines = measurePdfLines(row.title, titleWidth, fontSize);
    const rowHeight = Math.max(11, Math.max(descriptionLines.length, titleLines.length, 1) * lineHeight + 4);

    if (currentRows.length && currentHeight + rowHeight > availableHeight) {
      pages.push({
        type: 'activities',
        title: basePage.title,
        subtitle: basePage.subtitle,
        note: `Atividades do período • ${currentRows.length} itens nesta página`,
        rows: currentRows,
        layout: {
          dateWidth,
          titleWidth,
          valueWidth,
          descriptionWidth,
          fontSize,
          lineHeight
        }
      });
      currentRows = [];
      currentHeight = 0;
    }

    currentRows.push({
      ...row,
      descriptionLines,
      titleLines,
      rowHeight
    });
    currentHeight += rowHeight;
  });

  if (currentRows.length || !pages.length) {
    pages.push({
      type: 'activities',
      title: basePage.title,
      subtitle: basePage.subtitle,
      note: `Atividades do período • ${activities.length} registro(s) no total`,
      rows: currentRows,
      layout: {
        dateWidth,
        titleWidth,
        valueWidth,
        descriptionWidth,
        fontSize,
        lineHeight
      }
    });
  }

  return pages;
}

function normalizeActivityRow(activity = {}) {
  return {
    date: formatDisplayDate(activity.date),
    title: String(activity.title || 'Item do relatório').trim() || 'Item do relatório',
    description: String(activity.description || 'Descrição indisponível.').trim() || 'Descrição indisponível.',
    value: formatOfferValue(activity.value)
  };
}

function measurePdfLines(text, maxWidth, fontSize) {
  const doc = createMeasurementPdf();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fontSize);
  return doc.splitTextToSize(String(text || ''), maxWidth) || [String(text || '')];
}

function createMeasurementPdf() {
  return new window.jspdf.jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true
  });
}

function drawPdfShell(doc, page, meta) {
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = width - margin * 2;

  doc.setFillColor(247, 249, 252);
  doc.rect(0, 0, width, height, 'F');

  doc.setFillColor(23, 43, 77);
  doc.roundedRect(margin, margin, contentWidth, 28, 4, 4, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  const titleLines = doc.splitTextToSize(String(page.title || ''), contentWidth - 24);
  doc.text(titleLines, margin + 8, margin + 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.2);
  doc.text(String(page.subtitle || ''), margin + 8, margin + 20);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.2);
  doc.text(`Página ${meta.pageNumber}/${meta.totalPages}`, width - margin - 3, margin + 9, { align: 'right' });

  doc.setTextColor(45, 55, 72);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.8);
  doc.text(String(page.note || ''), margin, margin + 38);

  return { width, height, margin, contentWidth };
}

function drawPeriodSummaryPage(doc, page, meta) {
  const shell = drawPdfShell(doc, page, meta);
  const metrics = [
    { label: 'Matriculados', value: formatSummaryValue(page.summary?.matriculados) },
    { label: 'Ausentes', value: formatSummaryValue(page.summary?.ausentes) },
    { label: 'Presentes', value: formatSummaryValue(page.summary?.presentes) },
    { label: 'Visitantes', value: formatSummaryValue(page.summary?.visitantes) },
    { label: 'Total', value: formatSummaryValue(page.summary?.total) },
    { label: 'Bíblias', value: formatSummaryValue(page.summary?.biblias) },
    { label: 'Revistas', value: formatSummaryValue(page.summary?.revistas) },
    { label: 'Ofertas', value: formatOfferValue(page.summary?.ofertas) }
  ];

  const cardW = (shell.contentWidth - 6) / 2;
  const cardH = 24;
  const startY = shell.margin + 44;
  const gapY = 6;
  const gapX = 6;

  metrics.forEach((metric, index) => {
    const row = Math.floor(index / 2);
    const col = index % 2;
    const x = shell.margin + col * (cardW + gapX);
    const y = startY + row * (cardH + gapY);
    drawMetricCard(doc, x, y, cardW, cardH, metric.label, metric.value, metric.label === 'Total' || metric.label === 'Ofertas');
  });

  doc.setDrawColor(221, 228, 239);
  doc.line(shell.margin, shell.height - 16, shell.width - shell.margin, shell.height - 16);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.4);
  doc.text('Relatório consolidado renderizado diretamente no PDF.', shell.margin, shell.height - 10);
}

function drawPeriodActivitiesPage(doc, page, meta) {
  const shell = drawPdfShell(doc, page, meta);
  const rows = Array.isArray(page.rows) ? page.rows : [];
  const layout = page.layout || {};
  const dateWidth = Number(layout.dateWidth || 24);
  const titleWidth = Number(layout.titleWidth || 32);
  const valueWidth = Number(layout.valueWidth || 28);
  const descriptionWidth = Number(layout.descriptionWidth || (shell.contentWidth - dateWidth - titleWidth - valueWidth - 8));
  const fontSize = Number(layout.fontSize || 8.4);
  const lineHeight = Number(layout.lineHeight || 3.2);
  const rowTop = shell.margin + 44;
  const rowBottom = shell.height - 18;
  const rowHeaderY = rowTop - 4;

  doc.setDrawColor(217, 224, 235);
  doc.setLineWidth(0.2);
  doc.line(shell.margin, rowHeaderY, shell.width - shell.margin, rowHeaderY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(Math.max(8, fontSize - 0.2));
  doc.setTextColor(91, 102, 122);
  doc.text('Data', shell.margin, rowHeaderY - 1.5);
  doc.text('Classe', shell.margin + dateWidth + 2, rowHeaderY - 1.5);
  doc.text('Descrição', shell.margin + dateWidth + titleWidth + 4, rowHeaderY - 1.5);
  doc.text('Valor', shell.width - shell.margin, rowHeaderY - 1.5, { align: 'right' });
  doc.line(shell.margin, rowHeaderY + 2, shell.width - shell.margin, rowHeaderY + 2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fontSize);
  doc.setTextColor(23, 43, 77);

  let y = rowTop;
  rows.forEach((row, index) => {
    const rowHeight = row.rowHeight || 11;
    const fill = index % 2 === 0 ? [255, 255, 255] : [248, 251, 255];
    doc.setFillColor(fill[0], fill[1], fill[2]);
    doc.roundedRect(shell.margin, y - 1, shell.contentWidth, rowHeight, 2, 2, 'F');

    doc.setTextColor(21, 39, 66);
    doc.text(String(row.date || ''), shell.margin + 1, y + 3.2);

    const titleLines = row.titleLines || measurePdfLines(row.title, titleWidth, fontSize);
    const descLines = row.descriptionLines || measurePdfLines(row.description, descriptionWidth, fontSize);

    doc.text(titleLines, shell.margin + dateWidth + 1, y + 3.2);
    doc.setTextColor(83, 95, 114);
    doc.text(descLines, shell.margin + dateWidth + titleWidth + 3, y + 3.2);
    doc.setTextColor(21, 39, 66);
    doc.text(String(row.value || ''), shell.width - shell.margin - 1, y + 3.2, { align: 'right' });

    doc.setDrawColor(230, 236, 244);
    doc.line(shell.margin + 1, Math.min(y + rowHeight, rowBottom), shell.width - shell.margin - 1, Math.min(y + rowHeight, rowBottom));
    y += rowHeight + 1;
  });

  doc.setDrawColor(221, 228, 239);
  doc.line(shell.margin, shell.height - 16, shell.width - shell.margin, shell.height - 16);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.4);
  doc.text('O PDF foi montado a partir do snapshot, sem depender da leitura do DOM.', shell.margin, shell.height - 10);
}

function drawMetricCard(doc, x, y, width, height, label, value, highlight = false) {
  const fill = highlight ? [234, 242, 255] : [255, 255, 255];
  doc.setFillColor(fill[0], fill[1], fill[2]);
  doc.setDrawColor(217, 224, 235);
  doc.roundedRect(x, y, width, height, 3, 3, 'FD');

  doc.setTextColor(91, 102, 122);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.3);
  doc.text(String(label || ''), x + 4, y + 7);

  doc.setTextColor(23, 43, 77);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13.5);
  const valueLines = doc.splitTextToSize(String(value || '0'), width - 8);
  doc.text(valueLines, x + 4, y + 16);
}

function setStatus(message, tone = 'info') {
  statusBanner.textContent = message;
  statusBanner.classList.remove('is-warning', 'is-success');

  if (tone === 'warning') {
    statusBanner.classList.add('is-warning');
  }

  if (tone === 'success') {
    statusBanner.classList.add('is-success');
  }
}

function setResultsMeta(message) {
  resultsMeta.textContent = message;
}

function openAccessDeniedDialog(error) {
  const message = String(error?.backendMessage || error?.primaryMessage || error?.message || 'Usuário sem permissão').trim() || 'Usuário sem permissão';

  if (APP_ACCESS_DENIED_DIALOG?.open) {
    APP_ACCESS_DENIED_DIALOG.open({
      title: 'Usuário sem permissão',
      message,
      backHref: '../pages/index.html'
    });
    return;
  }

  window.alert(message);
}

function goToLogin() {
  window.location.replace('../../../../../index.html');
}

function formatIsoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function normalizeDisplayDate(value) {
  if (value === undefined || value === null || value === '') {
    return '';
  }

  const raw = String(value).trim();
  if (!raw) {
    return '';
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('pt-BR');
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }

  const hasTime = /T|\d{2}:\d{2}/.test(raw);
  const dateText = parsed.toLocaleDateString('pt-BR');

  if (!hasTime) {
    return dateText;
  }

  const timeText = parsed.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  return `${dateText} - ${timeText}`;
}

function formatDisplayDate(value) {
  return normalizeDisplayDate(value);
}

function formatNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '0';
  }

  return numeric.toLocaleString('pt-BR');
}

function formatCurrency(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 'R$ 0,00';
  }

  return numeric.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function buildErrorTrace(error, context, criteria = null) {
  const pieces = [
    `Contexto: ${context || 'Erro na interface'}`,
    criteria?.startDate ? `Data inicial: ${criteria.startDate}` : '',
    criteria?.endDate ? `Data final: ${criteria.endDate}` : '',
    error?.name ? `Nome: ${error.name}` : '',
    error?.message ? `Mensagem: ${error.message}` : '',
    error?.status ? `Status: ${error.status}` : '',
    error?.stack ? `Stack:\n${error.stack}` : ''
  ].filter(Boolean);

  return pieces.join('\n\n');
}

function openErrorDialog({ message, trace }) {
  if (!window.APP_ERROR_DIALOG?.open) {
    window.alert(`${message}\n\n${trace || ''}`.trim());
    return;
  }

  const dialog = window.APP_ERROR_DIALOG.ensure?.();
  if (dialog?.open) {
    return;
  }

  window.APP_ERROR_DIALOG.open({ message, trace });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
