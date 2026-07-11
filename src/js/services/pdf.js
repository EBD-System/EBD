async function sendReport(scope) {
  if (isRestrictedMode() && !canShareRestrictedReports()) {
    throw new Error('Ação indisponível neste modo.');
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    throw new Error('Biblioteca de PDF não carregada.');
  }

  const turma = getCurrentTurma();
  if (scope === 'turma' && !turma) {
    throw new Error('Selecione uma turma.');
  }

  if (state.dirty) {
    await saveCurrentCall({ silent: true });
  }

  const scopeLabel = scope === 'geral' ? 'relatório geral' : 'relatório da turma';
  showLoading(`Gerando ${scopeLabel} em PDF...`, 40000);

  try {
    const report = buildPdfReportModel(scope);
    const doc = new window.jspdf.jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    doc.setProperties({
      title: report.fileName.replace(/\.pdf$/i, ''),
      subject: report.title,
      author: 'EBD',
      creator: 'EBD',
    });

    report.pages.forEach((page, index) => {
      if (index > 0) doc.addPage();
      drawReportPage(doc, page, {
        pageNumber: index + 1,
        totalPages: report.pages.length,
      });
    });

    const blob = doc.output('blob');
    const file = new File([blob], report.fileName, { type: 'application/pdf' });

    await sharePdfFile(file, {
      title: report.title,
      text: report.shareText,
    });

    showSuccess(report.successMessage);
  } finally {
    hideLoading();
  }
}

function buildPdfReportModel(scope) {
  const selectedDate = String(state.dateKey || todayKey());
  const dateLabel = formatDateBR(selectedDate);
  const turmas = getTurmasSorted();

  if (scope === 'turma') {
    const turma = getCurrentTurma();
    const call = getCurrentCall();
    if (!turma) throw new Error('Selecione uma turma.');

    return {
      title: `Relatório da turma • ${turma.Nome}`,
      fileName: `relatorio-turma-${slugifyForFileName(turma.Nome)}-${selectedDate}.pdf`,
      shareText: `Relatório em PDF da turma ${turma.Nome} (${dateLabel}).`,
      successMessage: 'PDF da turma pronto para compartilhar.',
      pages: [
        buildPdfTurmaPage(turma, call, dateLabel),
        ...buildPdfTurmaRosterPages(turma, call, dateLabel),
      ],
    };
  }

  const pages = turmas.map((turma) => buildPdfTurmaPage(turma, state.chamadasByTurma?.[turma.TurmaID] || null, dateLabel));
  pages.push(buildPdfGeneralPage(dateLabel));
  pages.push(buildPdfRankingsPage(dateLabel));

  return {
    title: 'Relatório geral consolidado',
    fileName: `relatorio-geral-${selectedDate}.pdf`,
    shareText: `Relatório geral consolidado em PDF (${dateLabel}).`,
    successMessage: 'PDF geral pronto para compartilhar.',
    pages,
  };
}

function buildPdfTurmaPage(turma, call, dateLabel) {
  const stats = getTurmaPresenceStats_(turma, call);
  const biblias = Number(call?.biblias || 0);
  const revistas = Number(call?.revistas || 0);
  const oferta = parseCurrencyBR(call?.oferta || 0);
  const total = stats.presentes + stats.visitantes;

  return {
    type: 'turma',
    title: turma?.Nome || 'Turma',
    subtitle: `Data: ${dateLabel}`,
    note: 'Total = Presentes + Visitantes',
    metrics: [
      { label: 'Matriculados', value: formatIntegerBR(stats.matriculados) },
      { label: 'Ausentes', value: formatIntegerBR(stats.ausentes) },
      { label: 'Presentes', value: formatIntegerBR(stats.presentes) },
      { label: 'Visitantes', value: formatIntegerBR(stats.visitantes) },
      { label: 'Total', value: formatIntegerBR(total) },
      { label: 'Presença da turma', value: formatPresencePercentBR(stats.percentual) },
      { label: 'Bíblicas', value: formatIntegerBR(biblias) },
      { label: 'Revistas', value: formatIntegerBR(revistas) },
      { label: 'Ofertas', value: formatMoney(oferta) },
    ],
  };
}

function normalizePdfStatusText(value) {
  const raw = String(value || '').trim();
  if (!raw) return 'Sem registro';

  const lower = raw.toLowerCase();
  if (['sim', 'presente', 'presença', 'presenca'].includes(lower)) return 'Presente';
  if (['nao', 'não', 'ausente'].includes(lower)) return 'Ausente';
  if (['atrasado', 'atrasada', 'late', 'delay'].includes(lower)) return 'Atrasado(a)';
  if (['visitante', 'visitor'].includes(lower)) return 'Visitante';
  if (['inativo', 'ativo', 'reativado', 'faltando muito', 'auto-presença', 'auto-presenca', 'auto-atraso'].includes(lower)) {
    return lower
      .replace(/-/g, ' ')
      .split(/\s+/)
      .map((part) => part ? part.charAt(0).toUpperCase() + part.slice(1) : part)
      .join(' ');
  }

  return raw
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((part) => part ? part.charAt(0).toUpperCase() + part.slice(1) : part)
    .join(' ');
}

function getPdfStudentStatusLabel(row, aluno) {
  const statusAluno = String(aluno?.Status ?? row?.statusAluno ?? '').trim().toLowerCase();
  if (statusAluno === 'inativo') return 'Inativo';

  const rawPresence = String(row?.presenca ?? row?.PRESENCA ?? '').trim().toLowerCase();
  if (['visitante', 'visitor'].includes(rawPresence)) return 'Visitante';
  if (rawPresence === 'atrasado' || rawPresence === 'atrasada' || rawPresence === 'late' || rawPresence === 'delay') return 'Atrasado(a)';
  if (rawPresence === 'sim' || rawPresence === 'presente' || rawPresence === '1' || rawPresence === 'p' || rawPresence === 'true') return 'Presente';
  if (rawPresence === 'nao' || rawPresence === 'não' || rawPresence === 'ausente' || rawPresence === '0' || rawPresence === 'f' || rawPresence === 'false') return 'Ausente';

  const custom = String(row?.situacao ?? row?.status ?? row?.statusAluno ?? '').trim();
  if (custom) return normalizePdfStatusText(custom);

  if (!isSavedRow(row)) return 'Sem registro';
  return 'Sem registro';
}

function buildPdfTurmaRosterPages(turma, call, dateLabel) {
  const roster = getAlunosForTurma(turma.TurmaID);
  const callRows = Array.isArray(call?.rows) ? call.rows : [];
  const rowsMap = new Map(callRows.map((row) => [String(row?.alunoId ?? ''), row]));

  const items = roster.map((aluno) => {
    const row = rowsMap.get(String(aluno.AlunoID || '')) || {
      alunoId: aluno.AlunoID,
      nome: aluno.Nome,
      statusAluno: aluno.Status || 'ativo',
      presenca: '',
      salvo: 0,
    };

    return {
      name: String(row.nome || aluno.Nome || '').trim() || 'Sem nome',
      status: getPdfStudentStatusLabel(row, aluno),
    };
  });

  const title = `Lista de alunos • ${turma?.Nome || 'Turma'}`;
  const subtitle = `Data: ${dateLabel}`;
  const note = `Lista completa dos alunos da turma • ${formatIntegerBR(items.length)} registros`;

  if (!items.length) {
    return [{
      type: 'turma-roster',
      title,
      subtitle,
      note,
      items: [],
      layout: { columns: 1, fontSize: 9, lineGap: 1.4, mode: 'single' },
    }];
  }

  const candidate = pickBestRosterSinglePageLayout(items);
  if (candidate) {
    return [{
      type: 'turma-roster',
      title,
      subtitle,
      note,
      items,
      layout: candidate.layout,
      placements: candidate.placements,
    }];
  }

  return paginateRosterItems(items, { title, subtitle, note });
}

function pickBestRosterSinglePageLayout(items) {
  const width = 210;
  const height = 297;
  const margin = 12;
  const contentWidth = width - margin * 2;
  const listTop = margin + 44;
  const listBottom = height - 18;
  const fontSizes = [10.5, 10, 9.5, 9, 8.5, 8, 7.5];
  const columnOptions = [1, 2, 3];
  let best = null;

  const doc = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });

  for (const columns of columnOptions) {
    const gapX = columns > 1 ? 4 : 0;
    const colWidth = (contentWidth - gapX * (columns - 1)) / columns;

    for (const fontSize of fontSizes) {
      const plan = planRosterPlacements(doc, items, {
        columns,
        fontSize,
        gapX,
        colWidth,
        listTop,
        listBottom,
      });

      if (!plan) continue;

      const score = fontSize * 100 - columns * 3;
      if (!best || score > best.score) {
        best = { score, layout: { columns, fontSize, lineGap: 1.4, gapX, colWidth, mode: 'single' }, placements: plan.placements };
      }
    }
  }

  return best;
}

function planRosterPlacements(doc, items, { columns, fontSize, gapX, colWidth, listTop, listBottom }) {
  const lineHeight = fontSize * 0.36 + 1.45;
  const statusWidth = Math.max(
    ...items.map((item) => doc.getTextWidth(String(item.status || '')))
  ) + 4;
  const nameWidth = Math.max(18, colWidth - statusWidth - 4);
  const placements = [];

  let col = 0;
  let y = listTop;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fontSize);

  for (const item of items) {
    const name = String(item.name || '').trim() || 'Sem nome';
    const status = String(item.status || 'Sem registro').trim() || 'Sem registro';
    const nameLines = doc.splitTextToSize(name, nameWidth) || [name];
    const rowHeight = Math.max(nameLines.length, 1) * lineHeight + 1.7;

    if (y + rowHeight > listBottom) {
      col += 1;
      if (col >= columns) return null;
      y = listTop;
    }

    placements.push({ col, y, rowHeight, nameLines, name, status });
    y += rowHeight;
  }

  return { placements, statusWidth, nameWidth, lineHeight };
}

function paginateRosterItems(items, basePage) {
  const width = 210;
  const height = 297;
  const margin = 12;
  const contentWidth = width - margin * 2;
  const listTop = margin + 44;
  const listBottom = height - 18;
  const availableHeight = listBottom - listTop;
  const fontSizes = [9.5, 9, 8.5, 8];
  const doc = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });

  let chosen = null;

  for (const fontSize of fontSizes) {
    const lineHeight = fontSize * 0.36 + 1.45;
    const statusWidth = Math.max(
      ...items.map((item) => doc.getTextWidth(String(item.status || '')))
    ) + 4;
    const nameWidth = Math.max(18, contentWidth - statusWidth - 4);
    let currentHeight = 0;
    let pageCount = 1;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fontSize);

    for (const item of items) {
      const nameLines = doc.splitTextToSize(String(item.name || '').trim() || 'Sem nome', nameWidth) || [String(item.name || 'Sem nome')];
      const rowHeight = Math.max(nameLines.length, 1) * lineHeight + 1.7;
      if (currentHeight + rowHeight > availableHeight) {
        pageCount += 1;
        currentHeight = 0;
      }
      currentHeight += rowHeight;
    }

    const score = -pageCount * 1000 + fontSize * 100;
    if (!chosen || score > chosen.score) {
      chosen = { score, fontSize, lineHeight, statusWidth, nameWidth, pageCount };
    }
  }

  const fontSize = chosen?.fontSize || 9;
  const lineHeight = chosen?.lineHeight || (fontSize * 0.36 + 1.45);
  const statusWidth = chosen?.statusWidth || 30;
  const nameWidth = chosen?.nameWidth || Math.max(18, contentWidth - statusWidth - 4);
  const pages = [];
  let current = [];
  let currentHeight = 0;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fontSize);

  for (const item of items) {
    const nameLines = doc.splitTextToSize(String(item.name || '').trim() || 'Sem nome', nameWidth) || [String(item.name || 'Sem nome')];
    const rowHeight = Math.max(nameLines.length, 1) * lineHeight + 1.7;

    if (current.length && currentHeight + rowHeight > availableHeight) {
      pages.push({
        type: 'turma-roster',
        title: basePage.title,
        subtitle: basePage.subtitle,
        note: basePage.note,
        items: current,
        layout: { columns: 1, fontSize, lineGap: 1.45, gapX: 0, colWidth: contentWidth, mode: 'multi' },
      });
      current = [];
      currentHeight = 0;
    }

    current.push({ name: item.name, status: item.status, nameLines });
    currentHeight += rowHeight;
  }

  if (current.length || !pages.length) {
    pages.push({
      type: 'turma-roster',
      title: basePage.title,
      subtitle: basePage.subtitle,
      note: basePage.note,
      items: current,
      layout: { columns: 1, fontSize, lineGap: 1.45, gapX: 0, colWidth: contentWidth, mode: 'multi' },
    });
  }

  return pages;
}

function buildPdfGeneralPage(dateLabel) {
  const turmas = getTurmasSorted();
  const calls = Object.values(state.chamadasByTurma || {});
  const resumido = state.resumoGeral || {};

  const totalMatriculados = turmas.reduce((acc, turma) => {
    const roster = getAlunosForTurma(turma.TurmaID);
    const ativos = roster.filter((aluno) => String(aluno.Status || 'ativo').trim().toLowerCase() !== 'inativo').length;
    return acc + ativos;
  }, 0);

  const presentes = calls.reduce((acc, call) => acc + getTurmaPresenceStats_(getTurmasSorted().find((t) => String(t.TurmaID) === String(call?.turmaId)), call).presentes, 0);
  const visitantes = calls.reduce((acc, call) => acc + Number(call?.visitantes || 0), 0);
  const ausentes = calls.reduce((acc, call) => acc + getTurmaPresenceStats_(getTurmasSorted().find((t) => String(t.TurmaID) === String(call?.turmaId)), call).ausentes, 0);
  const biblias = calls.reduce((acc, call) => acc + Number(call?.biblias || 0), 0);
  const revistas = calls.reduce((acc, call) => acc + Number(call?.revistas || 0), 0);
  const oferta = calls.reduce((acc, call) => acc + parseCurrencyBR(call?.oferta || 0), 0);
  const total = presentes + visitantes;
  const percentualGeral = totalMatriculados ? (presentes / totalMatriculados) * 100 : 0;

  const turmasSalvas = Number(resumido?.turmasSalvas ?? calls.filter((c) => c && c.isSaved).length);
  const totalTurmas = Number(resumido?.totalTurmas ?? turmas.length);

  return {
    type: 'geral',
    title: 'Relatório geral consolidado',
    subtitle: `Data: ${dateLabel}`,
    note: `Turmas salvas: ${turmasSalvas}/${totalTurmas}`,
    metrics: [
      { label: 'Matriculados', value: formatIntegerBR(totalMatriculados) },
      { label: 'Ausentes', value: formatIntegerBR(ausentes) },
      { label: 'Presentes', value: formatIntegerBR(presentes) },
      { label: 'Visitantes', value: formatIntegerBR(visitantes) },
      { label: 'Total', value: formatIntegerBR(total) },
      { label: 'Presença geral', value: formatPresencePercentBR(percentualGeral) },
      { label: 'Bíblicas', value: formatIntegerBR(biblias) },
      { label: 'Revistas', value: formatIntegerBR(revistas) },
      { label: 'Ofertas', value: formatMoney(oferta) },
    ],
  };
}

function getTurmaPresenceStats_(turma, call) {
  const roster = turma ? getAlunosForTurma(turma.TurmaID) : [];
  const matriculados = roster.filter((aluno) => String(aluno.Status || 'ativo').trim().toLowerCase() !== 'inativo').length;
  const rows = getAllActiveRows(call);
  const presentes = rows.filter((row) => isPresentLikeValue(row.presenca)).length;
  const ausentes = rows.filter((row) => normalizePresenceValue(row.presenca) === 'nao').length;
  const visitantes = Number(call?.visitantes || 0);
  const percentual = matriculados ? (presentes / matriculados) * 100 : 0;
  return {
    matriculados,
    presentes,
    ausentes,
    visitantes,
    percentual,
  };
}

function formatPresencePercentBR(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return '0%';
  const rounded = Math.round(number * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded.toFixed(0)}%` : `${rounded.toFixed(1).replace('.', ',')}%`;
}

function buildPdfRankingsPage(dateLabel) {
  const turmas = getTurmasSorted();
  const rankings = buildReportRankings_(turmas);

  return {
    type: 'rankings',
    title: 'Rankings das turmas',
    subtitle: `Data: ${dateLabel}`,
    note: 'Os 3 primeiros colocados de cada ranking estão destacados. Empates são agrupados.',
    sections: [
      { title: 'Ranking em Presença', rows: rankings.presenca },
      { title: 'Ranking em Oferta', rows: rankings.oferta },
      { title: 'Ranking em Visitantes', rows: rankings.visitantes },
    ],
  };
}

function buildReportRankings_(turmas) {
  const source = turmas.map((turma) => {
    const call = state.chamadasByTurma?.[turma.TurmaID] || null;
    const stats = getTurmaPresenceStats_(turma, call);
    return {
      turmaId: turma.TurmaID,
      name: String(turma.Nome || 'Turma').trim() || 'Turma',
      presenceValue: stats.percentual,
      offerValue: parseCurrencyBR(call?.oferta || 0),
      visitorsValue: Number(call?.visitantes || 0),
    };
  });

  return {
    presenca: buildRankingGroups_(source, 'presenceValue', (value) => formatPresencePercentBR(value)),
    oferta: buildRankingGroups_(source, 'offerValue', (value) => formatMoney(value)),
    visitantes: buildRankingGroups_(source, 'visitorsValue', (value) => `${formatIntegerBR(value)} visitantes`),
  };
}

function buildRankingGroups_(items, valueKey, formatValue) {
  const sorted = [...items].sort((a, b) => {
    const diff = Number(b[valueKey] || 0) - Number(a[valueKey] || 0);
    if (diff !== 0) return diff;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });

  const groups = [];
  const epsilon = 1e-9;

  sorted.forEach((item) => {
    const value = Number(item[valueKey] || 0);
    const last = groups[groups.length - 1];
    if (last && Math.abs(last.value - value) < epsilon) {
      last.names.push(item.name);
      return;
    }
    groups.push({
      value,
      names: [item.name],
      display: formatValue(value, item),
    });
  });

  return groups.map((group, index) => ({
    rank: index + 1,
    highlight: index < 3,
    isTie: group.names.length > 1,
    namesList: group.names,
    names: group.names.join(' & '),
    value: group.display,
  }));
}


function getRankingLabel_(row) {
  const names = Array.isArray(row?.namesList) && row.namesList.length
    ? row.namesList.map((name) => String(name || '').trim()).filter(Boolean)
    : [String(row?.names || '').trim()].filter(Boolean);

  if (!names.length) return '—';
  if (row?.isTie && names.length > 1) {
    return `(EMPATE) => ${names.join('  &  ')}`;
  }
  return names[0];
}

function drawRankingLabel_(doc, x, y, row) {
  const names = Array.isArray(row?.namesList) && row.namesList.length
    ? row.namesList.map((name) => String(name || '').trim()).filter(Boolean)
    : [String(row?.names || '').trim()].filter(Boolean);

  if (!names.length) {
    doc.text('—', x, y);
    return;
  }

  const isTie = row?.isTie && names.length > 1;
  if (!isTie) {
    doc.setFont('helvetica', row?.highlight ? 'bold' : 'normal');
    doc.text(names[0], x, y);
    return;
  }

  const prefix = '(EMPATE) => ';
  const connector = '  &  ';
  const prefixWidth = doc.getTextWidth(prefix);
  const nameWidths = names.map((name) => doc.getTextWidth(name));
  const connectorWidth = doc.getTextWidth(connector);

  doc.setFont('helvetica', 'bold');
  doc.text(prefix, x, y);

  let cursorX = x + prefixWidth;
  names.forEach((name, index) => {
    doc.setFont('helvetica', 'normal');
    doc.text(name, cursorX, y);
    cursorX += nameWidths[index];
    if (index < names.length - 1) {
      doc.setFont('helvetica', 'bold');
      doc.text(connector, cursorX, y);
      cursorX += connectorWidth;
    }
  });
}

function drawReportPage(doc, page, meta) {
  if (page?.items) {
    drawRosterPage(doc, page, meta);
    return;
  }

  if (page?.sections) {
    drawRankingPage(doc, page, meta);
    return;
  }

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
  doc.setFontSize(17);
  const titleLines = doc.splitTextToSize(String(page.title || ''), contentWidth - 24);
  doc.text(titleLines, margin + 8, margin + 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.text(String(page.subtitle || ''), margin + 8, margin + 20);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(`Página ${meta.pageNumber}/${meta.totalPages}`, width - margin - 3, margin + 9, { align: 'right' });

  doc.setTextColor(45, 55, 72);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(String(page.note || ''), margin, margin + 38);

  const cardW = (contentWidth - 6) / 2;
  const cardH = 24;
  const startY = margin + 44;
  const gapY = 6;
  const gapX = 6;
  const metrics = Array.isArray(page.metrics) ? page.metrics : [];
  const positions = metrics.map((_, index) => {
    const isSpecialLast = metrics.length === 9 && index === 8;
    if (isSpecialLast) {
      return [margin, startY + 4 * (cardH + gapY), contentWidth];
    }
    const row = Math.floor(index / 2);
    const col = index % 2;
    const x = col === 0 ? margin : margin + cardW + gapX;
    const y = startY + row * (cardH + gapY);
    return [x, y, cardW];
  });

  metrics.forEach((metric, index) => {
    const pos = positions[index];
    if (!pos) return;
    drawMetricCard(doc, pos[0], pos[1], pos[2], cardH, metric.label, metric.value, index < 3);
  });

  doc.setDrawColor(221, 228, 239);
  doc.line(margin, height - 16, width - margin, height - 16);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.text('O maior entre vocês é aquele que serve. - Mateus 23:11', margin, height - 10);
}

function drawRosterPage(doc, page, meta) {
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = width - margin * 2;
  const layout = page.layout || { columns: 1, fontSize: 9, lineGap: 1.45, gapX: 0, colWidth: contentWidth, mode: 'multi' };
  const columns = Math.max(1, Number(layout.columns || 1));
  const gapX = Number(layout.gapX || 0);
  const colWidth = Number(layout.colWidth || ((contentWidth - gapX * (columns - 1)) / columns));
  const fontSize = Number(layout.fontSize || 9);
  const lineGap = Number(layout.lineGap || 1.45);
  const listTop = margin + 44;
  const listBottom = height - 18;
  const lineHeight = fontSize * 0.36 + lineGap;

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
  doc.setFontSize(10.5);
  doc.text(String(page.subtitle || ''), margin + 8, margin + 20);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(`Página ${meta.pageNumber}/${meta.totalPages}`, width - margin - 3, margin + 9, { align: 'right' });

  doc.setTextColor(45, 55, 72);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(String(page.note || ''), margin, margin + 38);

  const statusWidth = Math.max(24, ...((page.items || []).map((item) => doc.getTextWidth(String(item.status || ''))))) + 3;
  const nameWidth = Math.max(18, colWidth - statusWidth - 5);
  const headerY = listTop - 4;

  doc.setDrawColor(217, 224, 235);
  doc.setLineWidth(0.2);
  doc.line(margin, headerY, width - margin, headerY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(Math.max(8, fontSize - 0.5));
  doc.setTextColor(91, 102, 122);
  doc.text('Aluno', margin, headerY - 1.5);
  doc.text('Situação', width - margin, headerY - 1.5, { align: 'right' });
  doc.line(margin, headerY + 2, width - margin, headerY + 2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fontSize);
  doc.setTextColor(23, 43, 77);

  const pageMarginBottom = listBottom;
  const rows = Array.isArray(page.items) ? page.items : [];
  const placements = page.placements && page.placements.length ? page.placements : null;

  if (placements) {
    placements.forEach((placement) => {
      const x = margin + placement.col * (colWidth + gapX);
      const rowTop = placement.y;
      const rowBottom = rowTop + placement.rowHeight;
      const name = String(placement.name || '').trim();
      const status = String(placement.status || '').trim();
      const nameLines = placement.nameLines || doc.splitTextToSize(name, nameWidth) || [name];

      doc.text(nameLines, x, rowTop + 3.2);
      doc.text(status, x + colWidth, rowTop + 3.2, { align: 'right' });
      doc.setDrawColor(230, 236, 244);
      doc.line(x, Math.min(rowBottom, pageMarginBottom), x + colWidth, Math.min(rowBottom, pageMarginBottom));
    });
  } else {
    let y = listTop;
    rows.forEach((item) => {
      const name = String(item.name || '').trim() || 'Sem nome';
      const status = String(item.status || 'Sem registro').trim() || 'Sem registro';
      const nameLines = item.nameLines || doc.splitTextToSize(name, nameWidth) || [name];
      const rowHeight = Math.max(nameLines.length, 1) * lineHeight + 1.7;
      if (y + rowHeight > pageMarginBottom) return;
      doc.text(nameLines, margin, y + 3.2);
      doc.text(status, width - margin, y + 3.2, { align: 'right' });
      doc.setDrawColor(230, 236, 244);
      doc.line(margin, y + rowHeight, width - margin, y + rowHeight);
      y += rowHeight;
    });
  }

  doc.setDrawColor(221, 228, 239);
  doc.line(margin, height - 16, width - margin, height - 16);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.text('O maior entre vocês é aquele que serve. - Mateus 23:11', margin, height - 10);
}


function drawRankingPage(doc, page, meta) {
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = width - margin * 2;
  const sections = Array.isArray(page.sections) ? page.sections : [];
  const sectionGap = 5;
  const sectionHeaderH = 8;
  const sectionTitleH = 6.5;
  const rowGap = 1.2;
  const rowFontSize = 8.4;
  const rowLineHeight = rowFontSize * 0.36 + rowGap;
  const rowPadY = 1.8;
  const separatorHeight = 10.5;

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
  doc.setFontSize(10.5);
  doc.text(String(page.subtitle || ''), margin + 8, margin + 20);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(`Página ${meta.pageNumber}/${meta.totalPages}`, width - margin - 3, margin + 9, { align: 'right' });

  doc.setTextColor(45, 55, 72);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(String(page.note || ''), margin, margin + 38);

  const startY = margin + 44;
  const availableHeight = height - 16 - startY;
  const baseMaxRows = Math.max(1, ...sections.map((section) => (section.rows || []).length), 1);
  const baseEstimated = sections.reduce((sum, section) => {
    const rowCount = (section.rows || []).length;
    const hasSeparator = rowCount > 3 ? separatorHeight : 0;
    return sum + sectionTitleH + sectionHeaderH + rowCount * (rowLineHeight + rowPadY) + hasSeparator + 4;
  }, sectionGap * Math.max(0, sections.length - 1));
  const scale = baseEstimated > availableHeight ? Math.max(0.84, availableHeight / baseEstimated) : 1;
  const effectiveFontSize = Math.max(7.2, rowFontSize * scale);
  const effectiveLineHeight = effectiveFontSize * 0.36 + rowGap;
  let currentY = startY;

  sections.forEach((section, sectionIndex) => {
    const rows = Array.isArray(section.rows) ? section.rows : [];
    const boxX = margin;
    const boxW = contentWidth;
    const labelWidth = boxW - 26;
    const rowHeights = rows.map((row) => {
      const labelText = getRankingLabel_(row);
      const labelLines = doc.splitTextToSize(String(labelText || ''), labelWidth) || [String(labelText || '')];
      return Math.max(1, labelLines.length) * effectiveLineHeight + rowPadY;
    });
    const sectionHeight = sectionTitleH + sectionHeaderH + rowHeights.reduce((a, b) => a + b, 0) + 4 + (rows.length > 3 ? separatorHeight : 0);

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(216, 224, 236);
    doc.roundedRect(boxX, currentY, boxW, sectionHeight, 4, 4, 'FD');

    doc.setFillColor(23, 43, 77);
    doc.roundedRect(boxX, currentY, boxW, sectionTitleH + 1.3, 4, 4, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.8);
    doc.text(String(section.title || ''), boxX + 4, currentY + 4.3);

    doc.setTextColor(91, 102, 122);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.1);
    doc.text('Turma', boxX + 4, currentY + sectionTitleH + 4.2);
    doc.text('Valor', boxW + boxX - 4, currentY + sectionTitleH + 4.2, { align: 'right' });

    let rowY = currentY + sectionTitleH + sectionHeaderH - 0.2;
    rows.forEach((row, rowIndex) => {
      const label = getRankingLabel_(row);
      const value = String(row.value || '').trim() || '—';
      const labelLines = doc.splitTextToSize(label, labelWidth) || [label];
      const rowHeight = rowHeights[rowIndex] || (effectiveLineHeight + rowPadY);
      const highlight = row.highlight === true;
      const tint = row.rank === 1 ? [255, 247, 214] : row.rank === 2 ? [240, 243, 247] : row.rank === 3 ? [255, 237, 224] : [255, 255, 255];

      doc.setFillColor(tint[0], tint[1], tint[2]);
      doc.rect(boxX + 1, rowY - 0.8, boxW - 2, rowHeight, 'F');

      if (highlight) {
        doc.setDrawColor(23, 43, 77);
        doc.setLineWidth(0.45);
      } else {
        doc.setDrawColor(232, 237, 244);
        doc.setLineWidth(0.2);
      }
      doc.line(boxX + 1, rowY + rowHeight - 0.1, boxX + boxW - 1, rowY + rowHeight - 0.1);

      doc.setTextColor(23, 43, 77);
      doc.setFontSize(8.6);
      if (row.isTie && Array.isArray(row.namesList) && row.namesList.length > 1) {
        drawRankingLabel_(doc, boxX + 4, rowY + 2.7, row);
      } else {
        doc.setFont('helvetica', highlight ? 'bold' : 'normal');
        doc.text(labelLines, boxX + 4, rowY + 2.7);
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.8);
      doc.text(value, boxX + boxW - 4, rowY + 2.7, { align: 'right' });

      rowY += rowHeight;

      if (rowIndex === 2 && rows.length > 3) {
        doc.setDrawColor(210, 218, 230);
        doc.setLineWidth(0.25);
        doc.line(boxX + 4, rowY + 2.5, boxX + boxW - 4, rowY + 2.5);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.1);
        doc.setTextColor(91, 102, 122);
        doc.text('- - - - - - - - - - - - - - - - - - - - - - - - - -', boxX + 4, rowY + 5.0);
        doc.text('Demais turmas:', boxX + 4, rowY + 8.5);

        rowY += separatorHeight;
      }
    });

    currentY += sectionHeight + sectionGap;
  });

  doc.setDrawColor(221, 228, 239);
  doc.line(margin, height - 16, width - margin, height - 16);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.text('O maior entre vocês é aquele que serve. - Mateus 23:11', margin, height - 10);
}

function drawMetricCard(doc, x, y, w, h, label, value, accent = false) {
  doc.setDrawColor(215, 223, 236);
  doc.setFillColor(accent ? 255 : 255, accent ? 248 : 255, accent ? 244 : 255);
  doc.roundedRect(x, y, w, h, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(91, 102, 122);
  doc.text(String(label || ''), x + 4, y + 7);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(23, 43, 77);
  const valueText = String(value || '');
  const lines = doc.splitTextToSize(valueText, w - 8);
  doc.text(lines, x + 4, y + 16);
}

function formatIntegerBR(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? String(Math.trunc(number)) : '0';
}

function slugifyForFileName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'turma';
}

async function sharePdfFile(file, { title = 'Relatório em PDF', text = '' } = {}) {
  if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
    await navigator.share({
      title,
      text,
      files: [file],
    });
    return;
  }

  const url = URL.createObjectURL(file);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name || 'relatorio.pdf';
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  }
}


