(function initRelatorioAlunoPage(root) {
  const globalObject = root || (typeof globalThis !== 'undefined' ? globalThis : {});
  const STORAGE_KEYS = globalObject.APP_STORAGE_KEYS;
  const AUTH_STORAGE = globalObject.APP_AUTH_STORAGE;
  const APP_API_CLIENT = globalObject.APP_API_CLIENT;
  const APP_REPORTS_SERVICE = globalObject.APP_REPORTS_SERVICE;
  const APP_ACCESS_DENIED_DIALOG = globalObject.APP_ACCESS_DENIED_DIALOG;
  const APP_CONFIG = globalObject.APP_CONFIG || {};

  const API_BASE_URL =
    typeof APP_CONFIG.resolveApiBaseUrl === 'function'
      ? APP_CONFIG.resolveApiBaseUrl()
      : `${globalObject.location?.protocol || 'http:'}//${globalObject.location?.hostname || 'localhost'}${globalObject.location?.port ? `:${globalObject.location.port}` : ''}/api/v1`;

  const classSelect = document.getElementById('classSelect');
  const startDateInput = document.getElementById('startDate');
  const endDateInput = document.getElementById('endDate');
  const studentSearchInput = document.getElementById('studentSearch');
  const classCount = document.getElementById('classCount');
  const statusMessage = document.getElementById('statusMessage');
  const studentEmpty = document.getElementById('studentEmpty');
  const studentEmptyTitle = document.getElementById('studentEmptyTitle');
  const studentEmptyMessage = document.getElementById('studentEmptyMessage');
  const studentTableWrap = document.getElementById('studentTableWrap');
  const studentTableBody = document.getElementById('studentTableBody');
  const reportPreview = document.getElementById('reportPreview');
  const reportStudentName = document.getElementById('reportStudentName');
  const reportClassName = document.getElementById('reportClassName');
  const reportPresences = document.getElementById('reportPresences');
  const reportDelays = document.getElementById('reportDelays');
  const reportPresencePercent = document.getElementById('reportPresencePercent');
  const reportPeriod = document.getElementById('reportPeriod');
  const monthlyTableBody = document.getElementById('monthlyTableBody');

  const state = {
    token: '',
    loadingClasses: false,
    loadingStudents: false,
    downloadingStudentId: '',
    classes: [],
    students: [],
    selectedClassId: '',
    lastReport: null
  };

  const session = readSession();
  if (!session.token) {
    goToLogin();
    return;
  }

  state.token = session.token;
  setDefaultDates();
  wirePage();
  void loadClasses();

  function wirePage() {
    classSelect?.addEventListener('change', (event) => {
      state.selectedClassId = String(event.target.value || '').trim();
      state.students = [];
      state.lastReport = null;
      reportPreview.hidden = true;
      studentSearchInput.disabled = !state.selectedClassId;
      studentSearchInput.value = '';

      if (!state.selectedClassId) {
        renderStudentsEmpty(
          'Escolha uma turma',
          'Selecione uma turma para listar os alunos.'
        );
        setStatus('Selecione uma turma para continuar.');
        return;
      }

      void loadStudentsForClass(state.selectedClassId);
    });

    studentSearchInput?.addEventListener('input', () => {
      renderStudents();
    });
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

  async function loadClasses() {
    if (state.loadingClasses) return;

    state.loadingClasses = true;
    setStatus('Carregando turmas...');

    try {
      const response = await fetch(`${API_BASE_URL}/classes`, {
        headers: {
          Authorization: `Bearer ${state.token}`
        }
      });

      const payload = await APP_API_CLIENT.safeJson(response);

      if (!response.ok || APP_API_CLIENT.isFailurePayload?.(payload) || payload?.ok === false) {
        throw APP_API_CLIENT.createApiError(response, payload, {
          fallbackMessage: 'Não foi possível carregar as turmas.'
        });
      }

      const classes = normalizeClasses(payload);
      state.classes = classes;
      renderClassOptions(classes);

      if (!classes.length) {
        renderStudentsEmpty(
          'Nenhuma turma disponível',
          'Não foi possível encontrar turmas para este cadastro.'
        );
        setStatus('Nenhuma turma disponível.');
        return;
      }

      setStatus(`${classes.length} ${classes.length === 1 ? 'turma disponível' : 'turmas disponíveis'}.`);
      renderStudentsEmpty(
        'Escolha uma turma',
        'Selecione uma turma acima para carregar os alunos.'
      );
    } catch (error) {
      handleError(error, {
        fallbackTitle: 'Falha ao carregar turmas',
        fallbackMessage: 'Não foi possível carregar as turmas.'
      });
    } finally {
      state.loadingClasses = false;
    }
  }

  async function loadStudentsForClass(classId) {
    if (state.loadingStudents) return;

    const normalizedId = String(classId || '').trim();
    if (!normalizedId) return;

    state.loadingStudents = true;
    setStatus('Carregando alunos da turma...');
    renderStudentsEmpty(
      'Carregando alunos',
      'Aguarde enquanto a lista da turma é atualizada.'
    );

    try {
      const response = await fetch(
        `${API_BASE_URL}/classes/${encodeURIComponent(normalizedId)}/students`,
        {
          headers: {
            Authorization: `Bearer ${state.token}`
          }
        }
      );

      const payload = await APP_API_CLIENT.safeJson(response);

      if (!response.ok || APP_API_CLIENT.isFailurePayload?.(payload) || payload?.ok === false) {
        throw APP_API_CLIENT.createApiError(response, payload, {
          fallbackMessage: 'Não foi possível carregar os alunos da turma.'
        });
      }

      state.students = normalizeStudents(payload);
      state.lastReport = null;
      reportPreview.hidden = true;
      classCount.textContent = `${state.students.length} ${state.students.length === 1 ? 'aluno' : 'alunos'}`;
      studentSearchInput.disabled = false;
      renderStudents();

      if (!state.students.length) {
        setStatus('A turma selecionada não possui alunos disponíveis.');
        return;
      }

      const selectedClassName = getSelectedClassName(normalizedId);
      setStatus(
        `${state.students.length} ${state.students.length === 1 ? 'aluno encontrado' : 'alunos encontrados'}${selectedClassName ? ` em ${selectedClassName}` : ''}.`
      );
    } catch (error) {
      state.students = [];
      studentSearchInput.disabled = true;
      classCount.textContent = '0 alunos';
      handleError(error, {
        fallbackTitle: 'Falha ao carregar alunos',
        fallbackMessage: 'Não foi possível carregar os alunos da turma.'
      });
    } finally {
      state.loadingStudents = false;
    }
  }

  function renderClassOptions(classes) {
    classSelect.innerHTML = '<option value="" selected>&lt; SELECIONE &gt;</option>';

    classes.forEach((item) => {
      const option = document.createElement('option');
      option.value = String(item.id);
      option.textContent = item.name;
      classSelect.appendChild(option);
    });
  }

  function renderStudents() {
    const query = normalizeText(studentSearchInput?.value || '');
    const filtered = state.students.filter((student) => {
      if (!query) return true;
      return normalizeText(student.nome).includes(query);
    });

    classCount.textContent = `${filtered.length} de ${state.students.length} ${state.students.length === 1 ? 'aluno' : 'alunos'}`;

    if (!filtered.length) {
      studentTableWrap.hidden = true;
      renderStudentsEmpty(
        state.students.length ? 'Nenhum aluno encontrado' : 'Nenhum aluno disponível',
        state.students.length
          ? 'Tente outro nome na busca.'
          : 'A turma selecionada não possui alunos disponíveis.'
      );
      return;
    }

    studentEmpty.hidden = true;
    studentTableWrap.hidden = false;

    studentTableBody.innerHTML = filtered
      .map((student) => {
        const id = escapeHtml(student.id);
        const name = escapeHtml(student.nome || 'Aluno sem nome');
        const isDownloading = state.downloadingStudentId === String(student.id);

        return `
          <tr>
            <td class="student-name">${name}</td>
            <td>
              <button
                class="student-download${isDownloading ? ' report-loading' : ''}"
                type="button"
                data-student-id="${id}"
                ${isDownloading ? 'disabled' : ''}
              >
                ${isDownloading ? 'GERANDO...' : 'BAIXAR'}
              </button>
            </td>
          </tr>
        `;
      })
      .join('');

    studentTableBody.querySelectorAll('[data-student-id]').forEach((button) => {
      button.addEventListener('click', () => {
        void downloadStudentReport(button.dataset.studentId);
      });
    });
  }

  function renderStudentsEmpty(title, message) {
    studentTableWrap.hidden = true;
    studentEmpty.hidden = false;
    studentEmptyTitle.textContent = title;
    studentEmptyMessage.textContent = message;
    classCount.textContent = state.students.length
      ? `${state.students.length} ${state.students.length === 1 ? 'aluno' : 'alunos'}`
      : '0 alunos';
  }

  async function downloadStudentReport(studentId) {
    if (state.downloadingStudentId) return;

    const startDate = String(startDateInput?.value || '').trim();
    const endDate = String(endDateInput?.value || '').trim();

    if (!isIsoDate(startDate) || !isIsoDate(endDate)) {
      setStatus('Informe uma data inicial e uma data final válidas.');
      return;
    }

    if (startDate > endDate) {
      setStatus('A data inicial não pode ser maior que a data final.');
      return;
    }

    const student = state.students.find((item) => String(item.id) === String(studentId));
    if (!student) {
      setStatus('O aluno selecionado não está mais disponível na lista.');
      return;
    }

    state.downloadingStudentId = String(studentId);
    renderStudents();
    setStatus(`Gerando o relatório de ${student.nome}...`);

    try {
      const result = await APP_REPORTS_SERVICE.fetchStudentReport({
        studentId,
        studentName: student.nome,
        classId: state.selectedClassId,
        startDate,
        endDate,
        token: state.token
      });

      if (!result?.found || !result.report?.aluno) {
        throw new Error(result?.reason || 'Não foi possível gerar o relatório deste aluno.');
      }

      state.lastReport = result.report;
      renderReportPreview(result.report);

      try {
        generatePdf(result.report);
      } catch (pdfError) {
        if (!isPdfGenerationDependencyError(pdfError)) {
          throw pdfError;
        }

        generateFallbackPdf(result.report);
      }

      setStatus(`Relatório de ${student.nome} gerado com sucesso.`);
    } catch (error) {
      handleError(error, {
        fallbackTitle: 'Falha ao gerar relatório',
        fallbackMessage: error?.message || 'Não foi possível gerar o relatório deste aluno.'
      });
    } finally {
      state.downloadingStudentId = '';
      renderStudents();
    }
  }

  function renderReportPreview(report) {
    const student = report.aluno || {};
    const summary = report.resumo || {};
    const months = Array.isArray(report.meses) ? report.meses : [];

    reportStudentName.textContent = student.nome || '—';
    reportClassName.textContent = student.classe || getSelectedClassName(state.selectedClassId) || '—';
    reportPresences.textContent = formatInteger(summary.presencas);
    reportDelays.textContent = formatInteger(summary.atrasos);
    reportPresencePercent.textContent = formatPercent(summary.percentual_presenca);
    reportPeriod.textContent = `${formatDate(report.periodo?.startDate)} até ${formatDate(report.periodo?.endDate)}`;

    monthlyTableBody.innerHTML = months.length
      ? months.map((month) => `
          <tr>
            <td>${escapeHtml(month.mes_nome || formatMonth(month.mes))}</td>
            <td>${formatInteger(month.total_chamadas)}</td>
            <td class="monthly-presence">${formatInteger(month.presencas)}</td>
            <td>${formatInteger(month.atrasos)}</td>
            <td>${formatInteger(month.ausencias)}</td>
            <td class="monthly-presence">${formatPercent(month.percentual_presenca)}</td>
          </tr>
        `).join('')
      : `
        <tr>
          <td colspan="6">Nenhum mês disponível no período.</td>
        </tr>
      `;

    reportPreview.hidden = false;
  }

  function generatePdf(report) {
    const jsPdf = globalObject.jspdf?.jsPDF;
    if (typeof jsPdf !== 'function') {
      throw new Error('Não foi possível preparar o arquivo do relatório.');
    }

    const pdf = new jsPdf({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const student = report.aluno || {};
    const summary = report.resumo || {};
    const months = Array.isArray(report.meses) ? report.meses : [];
    const period = report.periodo || {};

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    let y = 18;

    const addPageHeader = () => {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(18);
      pdf.text('Relatório do Aluno', margin, y);
      y += 8;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9.5);
      pdf.setTextColor(90, 105, 120);
      pdf.text(
        `Período: ${formatDate(period.startDate)} até ${formatDate(period.endDate)}`,
        margin,
        y
      );
      y += 7;

      pdf.setTextColor(18, 48, 79);
      pdf.setDrawColor(214, 223, 232);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 9;
    };

    const ensureSpace = (height) => {
      if (y + height > pageHeight - 18) {
        pdf.addPage();
        y = 18;
        addPageHeader();
      }
    };

    const drawInfo = () => {
      pdf.setFillColor(243, 247, 252);
      pdf.roundedRect(margin, y, pageWidth - margin * 2, 33, 3, 3, 'F');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.text(student.nome || 'Aluno sem nome', margin + 6, y + 8);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.text(`Classe: ${student.classe || '—'}`, margin + 6, y + 15);
      pdf.text(`Matrícula: ${student.matricula || '—'}`, margin + 6, y + 22);
      pdf.text(`Status: ${student.status || '—'}`, margin + 6, y + 29);
      y += 42;
    };

    const drawSummary = () => {
      const cardGap = 4;
      const cardWidth = (pageWidth - margin * 2 - cardGap * 2) / 3;
      const cards = [
        ['Presenças', formatInteger(summary.presencas)],
        ['Atrasos', formatInteger(summary.atrasos)],
        ['Ausências', formatInteger(summary.ausencias)]
      ];

      cards.forEach(([label, value], index) => {
        const x = margin + index * (cardWidth + cardGap);
        pdf.setDrawColor(221, 228, 235);
        pdf.setFillColor(255, 255, 255);
        pdf.roundedRect(x, y, cardWidth, 20, 2.5, 2.5, 'FD');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.setTextColor(100, 116, 139);
        pdf.text(label.toUpperCase(), x + 4, y + 7);
        pdf.setTextColor(18, 48, 79);
        pdf.setFontSize(13);
        pdf.text(value, x + 4, y + 15);
      });

      y += 27;

      pdf.setDrawColor(221, 228, 235);
      pdf.setFillColor(249, 252, 250);
      pdf.roundedRect(margin, y, pageWidth - margin * 2, 18, 2.5, 2.5, 'FD');
      pdf.setTextColor(15, 122, 87);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.text(
        `Presença no período: ${formatPercent(summary.percentual_presenca)}`,
        margin + 5,
        y + 11
      );
      y += 28;
    };

    const drawMonthlyTable = () => {
      pdf.setTextColor(18, 48, 79);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(13);
      pdf.text('Frequência por mês', margin, y);
      y += 6;

      const columns = [
        { label: 'Mês', width: 41, align: 'left' },
        { label: 'Cham.', width: 24, align: 'right' },
        { label: 'Pres.', width: 24, align: 'right' },
        { label: 'Atras.', width: 24, align: 'right' },
        { label: 'Aus.', width: 24, align: 'right' },
        { label: '%', width: 25, align: 'right' }
      ];
      const totalWidth = columns.reduce((sum, column) => sum + column.width, 0);
      const startX = (pageWidth - totalWidth) / 2;
      const rowHeight = 8;

      const drawRow = (values, header = false) => {
        ensureSpace(rowHeight + 2);
        let x = startX;

        if (header) {
          pdf.setFillColor(243, 247, 252);
          pdf.rect(startX, y, totalWidth, rowHeight, 'F');
        }

        values.forEach((value, index) => {
          const column = columns[index];
          const text = String(value);
          pdf.setFont('helvetica', header ? 'bold' : 'normal');
          pdf.setFontSize(header ? 7.4 : 8.2);
          pdf.setTextColor(header ? 21 : 35, header ? 87 : 51, header ? 151 : 70);

          if (column.align === 'right') {
            pdf.text(text, x + column.width - 2, y + 5.2, { align: 'right' });
          } else {
            pdf.text(text, x + 2, y + 5.2);
          }

          x += column.width;
        });

        pdf.setDrawColor(225, 231, 237);
        pdf.line(startX, y + rowHeight, startX + totalWidth, y + rowHeight);
        y += rowHeight;
      };

      drawRow(columns.map((column) => column.label), true);
      months.forEach((month) => {
        drawRow([
          month.mes_nome || formatMonth(month.mes),
          formatInteger(month.total_chamadas),
          formatInteger(month.presencas),
          formatInteger(month.atrasos),
          formatInteger(month.ausencias),
          formatPercent(month.percentual_presenca)
        ]);
      });
    };

    addPageHeader();
    drawInfo();
    drawSummary();
    drawMonthlyTable();

    const totalPages = pdf.getNumberOfPages();
    for (let page = 1; page <= totalPages; page += 1) {
      pdf.setPage(page);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(120, 130, 140);
      pdf.text(
        `Relatório do Aluno • ${student.nome || 'Aluno'} • Página ${page}/${totalPages}`,
        margin,
        pageHeight - 8
      );
    }

    const fileName = `relatorio-aluno-${slugify(student.nome || 'aluno')}-${period.startDate || 'inicio'}-${period.endDate || 'fim'}.pdf`;
    pdf.save(fileName);
  }


  function isPdfGenerationDependencyError(error) {
    const message = String(error?.message || '').toLowerCase();
    return (
      typeof globalObject.jspdf?.jsPDF !== 'function' ||
      message.includes('preparar o arquivo do relatório')
    );
  }

  function generateFallbackPdf(report) {
    const student = report?.aluno || {};
    const summary = report?.resumo || {};
    const months = Array.isArray(report?.meses) ? report.meses : [];
    const period = report?.periodo || {};

    const lines = [
      'RELATORIO DO ALUNO',
      '',
      `Aluno: ${toPdfAscii(student.nome || 'Aluno')}`,
      `Classe: ${toPdfAscii(student.classe || '—')}`,
      `Periodo: ${formatDate(period.startDate)} ate ${formatDate(period.endDate)}`,
      '',
      `Presencas: ${formatInteger(summary.presencas)}`,
      `Atrasos: ${formatInteger(summary.atrasos)}`,
      `Ausencias: ${formatInteger(summary.ausencias)}`,
      `Percentual de presenca: ${formatPercent(summary.percentual_presenca)}`,
      '',
      'FREQUENCIA POR MES',
      'Mes | Chamadas | Presencas | Atrasos | Ausencias | %'
    ];

    months.forEach((month) => {
      lines.push(
        `${toPdfAscii(month.mes_nome || formatMonth(month.mes))} | ` +
        `${formatInteger(month.total_chamadas)} | ` +
        `${formatInteger(month.presencas)} | ` +
        `${formatInteger(month.atrasos)} | ` +
        `${formatInteger(month.ausencias)} | ` +
        `${formatPercent(month.percentual_presenca)}`
      );
    });

    const pageLines = paginateFallbackPdfLines(lines, 42);
    const objects = [];
    const fontId = 3;
    const pagesId = 2;

    objects[0] = null;
    objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objects[2] = '<< /Type /Pages /Kids [] /Count 0 >>';
    objects[fontId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

    const kids = [];
    pageLines.forEach((chunk, pageIndex) => {
      const pageId = 4 + pageIndex * 2;
      const contentId = pageId + 1;
      kids.push(`${pageId} 0 R`);

      const stream = buildFallbackPdfStream(chunk, pageIndex, pageLines.length);
      objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
      objects[pageId] =
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] ` +
        `/Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`;
    });

    objects[2] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${kids.length} >>`;

    const pdfBytes = buildPdfBinary(objects);
    downloadPdfBlob(
      pdfBytes,
      `relatorio-aluno-${slugify(student.nome || 'aluno')}-${period.startDate || 'inicio'}-${period.endDate || 'fim'}.pdf`
    );
  }

  function paginateFallbackPdfLines(lines, linesPerPage) {
    const chunks = [];
    for (let index = 0; index < lines.length; index += linesPerPage) {
      chunks.push(lines.slice(index, index + linesPerPage));
    }
    return chunks.length ? chunks : [[]];
  }

  function buildFallbackPdfStream(lines, pageIndex, totalPages) {
    const commands = [
      'BT',
      '/F1 11 Tf',
      '40 800 Td',
      '14 TL'
    ];

    lines.forEach((line) => {
      commands.push(`(${escapePdfText(line)}) Tj`);
      commands.push('0 -14 Td');
    });

    commands.push(
      '0 -6 Td',
      '/F1 8 Tf',
      `(${escapePdfText(`Relatorio do Aluno - Pagina ${pageIndex + 1}/${totalPages}`)}) Tj`,
      'ET'
    );

    return commands.join('\n');
  }

  function buildPdfBinary(objects) {
    const header = '%PDF-1.4\n%----\n';
    let pdf = header;
    const offsets = [0];
    let position = header.length;

    for (let index = 1; index < objects.length; index += 1) {
      if (!objects[index]) continue;
      offsets[index] = position;
      const objectText = `${index} 0 obj\n${objects[index]}\nendobj\n`;
      pdf += objectText;
      position += objectText.length;
    }

    const xrefOffset = position;
    const objectCount = objects.length;
    pdf += `xref\n0 ${objectCount}\n`;
    pdf += '0000000000 65535 f \n';

    for (let index = 1; index < objectCount; index += 1) {
      const offset = offsets[index] || 0;
      pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
    }

    pdf += `trailer\n<< /Size ${objectCount} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return new TextEncoder().encode(pdf);
  }

  function downloadPdfBlob(bytes, fileName) {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function escapePdfText(value) {
    return toPdfAscii(value)
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');
  }

  function toPdfAscii(value) {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7E]/g, '?');
  }

  function normalizeClasses(payload) {
    const source = payload?.data ?? payload;
    const candidates = Array.isArray(source?.classes)
      ? source.classes
      : Array.isArray(source?.items)
        ? source.items
        : Array.isArray(source?.itens)
          ? source.itens
          : Array.isArray(source)
            ? source
            : [];

    return candidates
      .map((item) => ({
        id: item?.id_classe ?? item?.id ?? item?.classId ?? item?.class_id,
        name: String(
          item?.nome ?? item?.name ?? item?.classe ?? item?.class_label ?? ''
        ).trim()
      }))
      .filter((item) => item.id !== undefined && item.id !== null && item.name);
  }

  function normalizeStudents(payload) {
    const source = payload?.data ?? payload;
    const candidates = Array.isArray(source?.students)
      ? source.students
      : Array.isArray(source?.alunos)
        ? source.alunos
        : Array.isArray(source?.items)
          ? source.items
          : Array.isArray(source?.itens)
            ? source.itens
            : Array.isArray(source)
              ? source
              : [];

    return candidates
      .map((item) => ({
        id: item?.id_aluno ?? item?.id ?? item?.studentId ?? item?.student_id,
        nome: String(
          item?.nome ?? item?.name ?? item?.aluno ?? item?.student_name ?? ''
        ).trim(),
        classe: String(
          item?.classe ?? item?.class ?? item?.nome_classe ?? item?.class_name ?? ''
        ).trim()
      }))
      .filter(
        (item) =>
          item.id !== undefined &&
          item.id !== null &&
          String(item.nome || '').trim()
      );
  }

  function getSelectedClassName(classId) {
    const normalizedId = String(classId || '').trim();
    return state.classes.find((item) => String(item.id) === normalizedId)?.name || '';
  }

  function setDefaultDates() {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - 7);
    startDateInput.value = toInputDate(start);
    endDateInput.value = toInputDate(today);
  }

  function toInputDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function setStatus(message) {
    statusMessage.textContent = message || '';
  }

  function handleError(error, fallback = {}) {
    if (Number(error?.status) === 403) {
      openAccessDeniedDialog(error);
      renderStudentsEmpty(
        fallback.fallbackTitle || 'Usuário sem permissão',
        fallback.fallbackMessage || 'Seu perfil não tem acesso a este relatório.'
      );
      reportPreview.hidden = true;
      return;
    }

    if (error?.requiresRelogin || Number(error?.status) === 401) {
      setStatus(error?.message || 'Sua sessão expirou. Faça login novamente.');
      window.setTimeout(goToLogin, 350);
      return;
    }

    setStatus(error?.message || fallback.fallbackMessage || 'Não foi possível concluir a operação.');
    renderStudentsEmpty(
      fallback.fallbackTitle || 'Não foi possível concluir',
      fallback.fallbackMessage || error?.message || 'Tente novamente.'
    );
  }

  function openAccessDeniedDialog(error) {
    const message =
      String(
        error?.backendMessage ||
        error?.primaryMessage ||
        error?.message ||
        'Usuário sem permissão'
      ).trim() || 'Usuário sem permissão';

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

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function isIsoDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
  }

  function formatDate(value) {
    if (!value) return '—';
    const parts = String(value).slice(0, 10).split('-');
    if (parts.length !== 3) return String(value);
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  function formatMonth(value) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})$/);
    if (!match) return String(value || '—');

    const names = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    return `${names[Number(match[2]) - 1] || match[2]} ${match[1]}`;
  }

  function formatInteger(value) {
    const numeric = Number(value || 0);
    return Number.isFinite(numeric)
      ? new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(numeric)
      : '0';
  }

  function formatPercent(value) {
    const numeric = Number(String(value ?? 0).replace(',', '.'));
    return Number.isFinite(numeric)
      ? `${new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
      }).format(numeric)}%`
      : '0,0%';
  }

  function slugify(value) {
    const normalized = String(value || 'aluno')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();

    return normalized || 'aluno';
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function goToLogin() {
    globalObject.location.replace('../../../../../index.html');
  }
})(typeof window !== 'undefined' ? window : globalThis);
