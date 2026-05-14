/**
 * Backend Google Apps Script para o seu cenário:
 * - Lê alunos da aba "ReadBase"
 * - Grava chamadas na aba "Base"
 * - Mantém histórico, resumo e relatório para Telegram
 * - Suporta o front da versão por turmas
 *
 * Estrutura esperada da planilha do usuário:
 *  - ReadBase: base de leitura / cadastro dos alunos
 *  - Base: histórico de presença gravado por data e turma
 *
 * O script também cria abas auxiliares ocultas para controle interno:
 *  - __ALUNOS_META
 *  - __TURMAS_META
 *  - __RELATORIOS
 */

const SPREADSHEET_ID = '1bB3SJnkDnjOb-Ro7d7fxWBzMoTp1DzAPHLQcR6LGysM';
const TELEGRAM_BOT_TOKEN = '8675551330:AAH5G9TcjqoI-rjvCr-QBAlQ4Wsxkolu9hY';
const TELEGRAM_CHAT_ID = '-5138652770';

const READ_SHEET_NAME = 'ReadBase';
const BASE_SHEET_NAME = 'Base';
const META_STUDENTS_SHEET = '__ALUNOS_META';
const META_CLASSES_SHEET = '__TURMAS_META';
const REPORTS_SHEET = '__RELATORIOS';

const BASE_HEADERS = ['DATA', 'ANO', 'MÊS', 'ALUNO', 'CLASSE', 'PRESENÇA', 'ATRASO', 'AUSÊNCIA', 'OFERTA', 'VISITANTES'];
const META_STUDENTS_HEADERS = [
  'AlunoID', 'Nome', 'TurmaID', 'TurmaNome', 'Ativo',
  'FaltasConsecutivas', 'TotalPresencas', 'TotalFaltas', 'Percentual',
  'Status', 'StatusManual', 'UltimaPresenca', 'UltimaAusencia',
  'RealocadoDe', 'CriadoEm', 'AtualizadoEm'
];
const META_CLASSES_HEADERS = ['TurmaID', 'Nome', 'Ordem', 'Ativa', 'CriadoEm', 'AtualizadoEm'];
const REPORTS_HEADERS = ['RelatorioID', 'Tipo', 'Data', 'TurmaID', 'Hash', 'Enviado', 'EnviadoEm', 'Texto', 'CriadoEm'];

function doGet(e) {
  const action = String(e?.parameter?.action || 'init').toLowerCase();

  try {
    switch (action) {
      case 'init':
        return json_(init_(e?.parameter || {}));
      case 'health':
        return json_({ ok: true, message: 'ok' });
      case 'reporttext':
        return json_(getReportText_(e?.parameter || {}));
      default:
        return json_({ ok: false, message: 'Ação inválida.' });
    }
  } catch (err) {
    return json_({ ok: false, message: err.message || String(err) });
  }
}

function doPost(e) {
  const p = e?.parameter || {};
  const action = String(p.action || '').toLowerCase();

  try {
    switch (action) {
      case 'savecall':
        return json_(saveCall_(p));
      case 'sendreport':
        return json_(sendReport_(p));
      case 'addturma':
        return json_(addTurma_(p));
      case 'addaluno':
        return json_(addAluno_(p));
      case 'movealuno':
        return json_(moveAluno_(p));
      case 'togglealuno':
        return json_(toggleAluno_(p));
      default:
        return json_({ ok: false, message: 'Ação inválida.' });
    }
  } catch (err) {
    return json_({ ok: false, message: err.message || String(err) });
  }
}

function init_(params) {
  ensureSheets_();

  const dateKey = normalizeDateKey_(params.date || todayKey_());
  const all = loadAllData_();
  const callsByTurma = buildCallsByTurmaForDate_(dateKey, all);
  const geral = buildDailyGeneralSummary_(dateKey, all, callsByTurma);

  return {
    ok: true,
    dateKey,
    turmas: sortTurmas_(all.turmas),
    alunos: sortAlunos_(all.alunos),
    callsByTurma,
    resumoGeral: geral,
    baseRowsCount: getBaseRowsCount_(),
    timestamps: { now: new Date().toISOString() },
  };
}

function saveCall_(p) {
  ensureSheets_();

  const dateKey = normalizeDateKey_(p.date || todayKey_());
  const turmaId = String(p.turmaId || p.turmaNome || p.turma || '').trim();
  const oferta = String(p.oferta || '').trim();
  const visitantes = Number(p.visitantes || 0) || 0;
  const visitantesTexto = String(p.visitantesTexto || '').trim();
  const chamadaId = String(p.chamadaId || `${turmaId}_${dateKey}`).trim();
  const rowsJson = String(p.rowsJson || '[]');
  const autoSend = normalizeBool_(p.sendTelegram || p.autoSend || 'nao');

  if (!turmaId) throw new Error('Turma inválida.');

  let rows;
  try {
    rows = JSON.parse(rowsJson);
  } catch (err) {
    throw new Error('rowsJson inválido.');
  }
  if (!Array.isArray(rows)) throw new Error('Lista de presenças inválida.');

  const allBefore = loadAllData_();
  const turma = getTurmaByIdOrName_(turmaId, allBefore.turmas);
  if (!turma) throw new Error('Turma não encontrada.');

  const roster = getRosterForTurma_(turma.TurmaID, allBefore);
  const byAlunoId = {};
  rows.forEach(item => {
    const alunoId = String(item.alunoId || item.AlunoID || '').trim();
    if (alunoId) byAlunoId[alunoId] = item;
  });

  const normalizedRows = roster.map(aluno => {
    const payload = byAlunoId[aluno.AlunoID] || {};
    const presencaRaw = normalizePresence_(payload.presenca ?? payload.PRESENCA ?? payload.presencaStatus);
    const atraso = normalizeBool_(payload.atraso ?? payload.Atraso) || String(payload.presenca || '').toLowerCase().trim() === 'atrasado';
    const presenca = atraso ? 'nao' : presencaRaw;
    return {
      alunoId: aluno.AlunoID,
      nome: aluno.Nome,
      turmaId: aluno.TurmaID,
      turmaNome: aluno.TurmaNome,
      presenca,
      atraso,
      observacao: String(payload.observacao || payload.obs || '').trim(),
      statusAluno: String(aluno.Status || 'ativo').trim(),
    };
  });

  const presentes = normalizedRows.filter(r => isPresenceLikeRow_(r)).length;
  const ausentes = normalizedRows.length - presentes;
  const percentual = normalizedRows.length ? round1_((presentes / normalizedRows.length) * 100) : 0;

  const baseWrite = replaceBaseRowsForCall_(
    dateKey,
    turma.TurmaID,
    turma.Nome,
    normalizedRows,
    {
      oferta,
      visitantes,
      visitantesTexto,
    }
  );

  upsertCallMeta_(
    chamadaId,
    dateKey,
    turma.TurmaID,
    oferta,
    visitantes,
    visitantesTexto,
    normalizedRows.length,
    presentes,
    ausentes,
    percentual,
    false
  );

  recalculateAndPersistStudentStats_(); // PESADO

  const allAfter = loadAllData_();
  const callsByTurma = buildCallsByTurmaForDate_(dateKey, allAfter);
  const geral = buildDailyGeneralSummary_(dateKey, allAfter, callsByTurma);
  const turmaCall = callsByTurma[turma.TurmaID];

  let telegram = { sent: false, alreadySent: false, message: '' };
  if (autoSend) {
    telegram = sendTelegramForTurma_(dateKey, turma.TurmaID, allAfter, callsByTurma[turma.TurmaID]);
  }

  return {
    ok: true,
    message: 'Chamada salva com sucesso.',
    chamadaId,
    turmaId: turma.TurmaID,
    dateKey,
    turmaCall,
    resumoGeral: geral,
    telegram,
    baseWrite,
  };
}

function sendReport_(p) {
  ensureSheets_();

  const dateKey = normalizeDateKey_(p.date || todayKey_());
  const scope = String(p.scope || 'turma').toLowerCase();
  const turmaId = String(p.turmaId || '').trim();

  const all = loadAllData_();
  const callsByTurma = buildCallsByTurmaForDate_(dateKey, all);
  const geral = buildDailyGeneralSummary_(dateKey, all, callsByTurma);

  if (scope === 'geral') {
    const text = buildGeneralReportText_(dateKey, geral, callsByTurma, all);
    return sendTelegramByText_({
      reportId: `GERAL_${dateKey}`,
      tipo: 'geral',
      dateKey,
      turmaId: '',
      text,
    });
  }

  const turma = getTurmaByIdOrName_(turmaId, all.turmas);
  if (!turma) throw new Error('Turma inválida.');

  const turmaCall = callsByTurma[turma.TurmaID];
  if (!turmaCall) throw new Error('Não existe chamada salva para esta turma nesta data.');

  const text = buildTurmaReportText_(dateKey, turma, turmaCall, all);
  const result = sendTelegramByText_({
    reportId: `TURMA_${turma.TurmaID}_${dateKey}`,
    tipo: 'turma',
    dateKey,
    turmaId: turma.TurmaID,
    text,
  });

  if (result.sent) {
    markCallAsSent_(turma.TurmaID, dateKey, text);
  }

  return result;
}

function addTurma_(p) {
  ensureSheets_();
  const nome = String(p.nome || '').trim();
  const ordem = Number(p.ordem || 0) || 0;
  if (!nome) throw new Error('Informe o nome da turma.');

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet_(ss, META_CLASSES_SHEET, META_CLASSES_HEADERS, true);
  const turmaId = buildTurmaId_(nome);

  const existing = findMetaClassById_(turmaId);
  const now = new Date().toISOString();
  if (existing) {
    updateMetaClass_(turmaId, { Nome: nome, Ordem: ordem, Ativa: 'sim', AtualizadoEm: now });
    return { ok: true, message: 'Turma atualizada com sucesso.', turmaId };
  }

  sheet.appendRow([turmaId, nome, ordem, 'sim', now, now]);
  return { ok: true, message: 'Turma cadastrada com sucesso.', turmaId };
}

function addAluno_(p) {
  ensureSheets_();
  const nome = String(p.nome || '').trim();
  const cpf = normalizeCpf_(p.cpf || '');
  const turmaId = String(p.turmaId || p.turma || '').trim();
  if (!nome) throw new Error('Informe o nome do aluno.');
  if (!turmaId) throw new Error('Informe a turma.');

  const all = loadAllData_();
  const turma = getTurmaByIdOrName_(turmaId, all.turmas);
  if (!turma) throw new Error('Turma não encontrada.');

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const readSheet = getOrCreateSheet_(ss, READ_SHEET_NAME, getReadBaseHeaders_(), false);
  const now = new Date().toISOString();
  const alunoId = buildStudentId_(nome, turma.TurmaID, cpf);

  appendReadBaseStudent_(readSheet, nome, turma.Nome, cpf, alunoId, now);
  upsertStudentMeta_({
    AlunoID: alunoId,
    Nome: nome,
    TurmaID: turma.TurmaID,
    TurmaNome: turma.Nome,
    Ativo: 'sim',
    FaltasConsecutivas: 0,
    TotalPresencas: 0,
    TotalFaltas: 0,
    Percentual: 0,
    Status: 'ativo',
    StatusManual: '',
    UltimaPresenca: '',
    UltimaAusencia: '',
    RealocadoDe: '',
    CriadoEm: now,
    AtualizadoEm: now,
  });

  return { ok: true, message: 'Aluno cadastrado com sucesso.', alunoId };
}

function moveAluno_(p) {
  ensureSheets_();
  const alunoId = String(p.alunoId || '').trim();
  const turmaId = String(p.turmaId || p.novaTurmaId || '').trim();
  if (!alunoId) throw new Error('Aluno inválido.');
  if (!turmaId) throw new Error('Turma destino inválida.');

  const all = loadAllData_();
  const turma = getTurmaByIdOrName_(turmaId, all.turmas);
  if (!turma) throw new Error('Turma destino não encontrada.');

  const meta = findStudentMetaById_(alunoId);
  if (!meta) throw new Error('Aluno não encontrado no controle interno.');

  const now = new Date().toISOString();
  upsertStudentMeta_({
    ...meta,
    TurmaID: turma.TurmaID,
    TurmaNome: turma.Nome,
    RealocadoDe: meta.TurmaNome || meta.TurmaID || '',
    AtualizadoEm: now,
  });

  return { ok: true, message: 'Aluno realocado com sucesso.', alunoId, turmaId: turma.TurmaID };
}

function toggleAluno_(p) {
  ensureSheets_();
  const alunoId = String(p.alunoId || '').trim();
  const ativo = normalizeBool_(p.ativo ?? p.status ?? '');
  if (!alunoId) throw new Error('Aluno inválido.');

  const meta = findStudentMetaById_(alunoId);
  if (!meta) throw new Error('Aluno não encontrado no controle interno.');

  const now = new Date().toISOString();
  const statusManual = ativo ? 'ativo' : 'inativo';
  upsertStudentMeta_({
    ...meta,
    Ativo: ativo ? 'sim' : 'nao',
    StatusManual: statusManual,
    Status: ativo ? 'ativo' : 'inativo',
    AtualizadoEm: now,
  });

  return { ok: true, message: `Aluno marcado como ${ativo ? 'ativo' : 'inativo'}.`, alunoId, ativo };
}

function getReportText_(p) {
  const dateKey = normalizeDateKey_(p.date || todayKey_());
  const scope = String(p.scope || 'turma').toLowerCase();
  const turmaId = String(p.turmaId || '').trim();

  const all = loadAllData_();
  const callsByTurma = buildCallsByTurmaForDate_(dateKey, all);
  const geral = buildDailyGeneralSummary_(dateKey, all, callsByTurma);

  if (scope === 'geral') {
    return {
      ok: true,
      text: buildGeneralReportText_(dateKey, geral, callsByTurma, all),
    };
  }

  const turma = getTurmaByIdOrName_(turmaId, all.turmas);
  if (!turma) throw new Error('Turma inválida.');
  const turmaCall = callsByTurma[turma.TurmaID];
  if (!turmaCall) throw new Error('Não existe chamada salva para esta turma nesta data.');

  return {
    ok: true,
    text: buildTurmaReportText_(dateKey, turma, turmaCall, all),
  };
}

function sendTelegramForTurma_(dateKey, turmaId, all, turmaCall) {
  const turma = getTurmaByIdOrName_(turmaId, all.turmas);
  if (!turma) throw new Error('Turma não encontrada.');
  if (!turmaCall) throw new Error('Não existe chamada salva para esta turma nesta data.');

  const text = buildTurmaReportText_(dateKey, turma, turmaCall, all);
  return sendTelegramByText_({
    reportId: `TURMA_${turma.TurmaID}_${dateKey}`,
    tipo: 'turma',
    dateKey,
    turmaId: turma.TurmaID,
    text,
  });
}

function sendTelegramByText_({ reportId, tipo, dateKey, turmaId, text }) {
  const hash = textHash_(text);
  const existing = getReportLogById_(reportId);

  if (existing && String(existing.Enviado || '').toLowerCase() === 'sim' && String(existing.Hash || '') === hash) {
    return {
      ok: true,
      sent: false,
      alreadySent: true,
      message: 'Relatório já havia sido enviado.',
      text,
    };
  }

  sendTelegram_(text);
  upsertReportLog_({
    reportId,
    tipo,
    dateKey,
    turmaId,
    hash,
    enviado: 'sim',
    texto: text,
  });

  return {
    ok: true,
    sent: true,
    alreadySent: false,
    message: tipo === 'geral' ? 'Relatório geral enviado ao Telegram.' : 'Relatório da turma enviado ao Telegram.',
    text,
  };
}


function getActiveCallRows_(rows) {
  return (rows || []).filter(r => String(r.statusAluno || '').trim().toLowerCase() !== 'inativo');
}

function buildTurmaReportText_(dateKey, turma, turmaCall, all) {
  const lines = [];
  lines.push(`*Relatório da turma*`);
  lines.push(`Data: ${formatDateBR_(dateKey)}`);
  lines.push(`Turma: ${turma.Nome}`);
  const activeRows = getActiveCallRows_(turmaCall.rows);
  const totalAtivos = activeRows.length;
  const presentesAtivos = activeRows.filter(r => isPresenceLikeRow_(r)).length;
  const atrasosAtivos = activeRows.filter(r => isDelayedRow_(r)).length;
  const ausentesAtivos = totalAtivos - presentesAtivos;
  const percentualAtivos = totalAtivos ? round1_((presentesAtivos / totalAtivos) * 100) : 0;

  lines.push(`Total de alunos: ${totalAtivos}`);
  lines.push(`Presentes: ${presentesAtivos}`);
  lines.push(`Ausentes: ${ausentesAtivos}`);
  lines.push(`Presença: ${formatPercent_(percentualAtivos)}`);
  lines.push(`Oferta: ${formatMoney_(parseMoney_(turmaCall.oferta))}`);
  if (Number(turmaCall.visitantes || 0) > 0) lines.push(`Visitantes: ${turmaCall.visitantes}`);
  if (String(turmaCall.visitantesTexto || '').trim()) lines.push(`Detalhe visitantes: ${turmaCall.visitantesTexto}`);

  const stats = getTopStatsForTurma_(turma.TurmaID, all);
  if (stats.bestStudent) lines.push(`Melhor aluno: ${stats.bestStudent.Nome} (${formatPercent_(stats.bestStudent.Percentual)})`);
  if (stats.mostAbsent) lines.push(`Mais faltas: ${stats.mostAbsent.Nome} (${stats.mostAbsent.TotalFaltas})`);
  if (stats.inactiveCount) lines.push(`Inativos: ${stats.inactiveCount}`);

  const presentNames = activeRows.filter(r => isPresenceLikeRow_(r)).map(r => r.nome);
  const delayedNames = activeRows.filter(r => isDelayedRow_(r)).map(r => r.nome);
  const absentNames = activeRows.filter(r => !isPresenceLikeRow_(r)).map(r => r.nome);
  if (presentNames.length) lines.push('');
  if (presentNames.length) lines.push(`Presentes: ${presentNames.join(', ')}`);
  if (delayedNames.length) lines.push(`Atrasados: ${delayedNames.join(', ')}`);
  if (absentNames.length) lines.push(`Ausentes: ${absentNames.join(', ')}`);

  return lines.join('\n');
}

function buildGeneralReportText_(dateKey, geral, callsByTurma, all) {
  const lines = [];
  lines.push(`*Relatório geral*`);
  lines.push(`Data: ${formatDateBR_(dateKey)}`);
  lines.push(`Turmas com chamada: ${geral.totalTurmas}`);
  lines.push(`Total de alunos: ${geral.totalAlunos}`);
  lines.push(`Presentes: ${geral.presentes}`);
  lines.push(`Ausentes: ${geral.ausentes}`);
  lines.push(`Presença geral: ${formatPercent_(geral.percentual)}`);
  lines.push(`Oferta total: ${formatMoney_(geral.ofertaTotal)}`);
  if (geral.visitantesTotal > 0) lines.push(`Visitantes: ${geral.visitantesTotal}`);
  lines.push('');
  lines.push('*Resumo por turma:*');

  const turmasOrdenadas = sortTurmas_(all.turmas).filter(t => callsByTurma[t.TurmaID]);
  turmasOrdenadas.forEach(turma => {
    const call = callsByTurma[turma.TurmaID];
    const activeRows = getActiveCallRows_(call.rows);
    const totalAtivos = activeRows.length;
    const presentesAtivos = activeRows.filter(r => isPresenceLikeRow_(r)).length;
    const atrasosAtivos = activeRows.filter(r => isDelayedRow_(r)).length;
    const percentualAtivos = totalAtivos ? round1_((presentesAtivos / totalAtivos) * 100) : 0;
    lines.push(`• ${turma.Nome}: ${presentesAtivos}/${totalAtivos} presentes (${formatPercent_(percentualAtivos)}) | atrasos ${atrasosAtivos}`);
  });

  const top = getTopStudentsOverall_(all);
  if (top.length) {
    lines.push('');
    lines.push('*Melhores alunos no período:*');
    top.slice(0, 5).forEach((s, idx) => {
      lines.push(`${idx + 1}. ${s.Nome} — ${s.TurmaNome} — ${formatPercent_(s.Percentual)}`);
    });
  }

  return lines.join('\n');
}

function buildDailyGeneralSummary_(dateKey, all, callsByTurma) {
  const calls = Object.values(callsByTurma || {});
  const totalAlunos = calls.reduce((sum, c) => sum + getActiveCallRows_(c.rows).length, 0);
  const presentes = calls.reduce((sum, c) => sum + getActiveCallRows_(c.rows).filter(r => isPresenceLikeRow_(r)).length, 0);
  const atrasos = calls.reduce((sum, c) => sum + getActiveCallRows_(c.rows).filter(r => isDelayedRow_(r)).length, 0);
  const ausentes = totalAlunos - presentes;
  const ofertaTotal = calls.reduce((sum, c) => sum + parseMoney_(c.oferta), 0);
  const visitantesTotal = calls.reduce((sum, c) => sum + Number(c.visitantes || 0), 0);
  const percentual = totalAlunos ? round1_((presentes / totalAlunos) * 100) : 0;

  return {
    dateKey,
    totalTurmas: calls.length,
    totalAlunos,
    presentes,
    ausentes,
    percentual,
    atrasos,
    ofertaTotal,
    visitantesTotal,
  };
}

function getTopStatsForTurma_(turmaId, all) {
  const turmaAlunos = (all.alunos || []).filter(a => String(a.TurmaID || '') === String(turmaId || ''));
  if (!turmaAlunos.length) {
    return { bestStudent: null, mostAbsent: null, inactiveCount: 0 };
  }

  const sortedByPercent = turmaAlunos.slice().sort((a, b) => Number(b.Percentual || 0) - Number(a.Percentual || 0));
  const sortedByAbsences = turmaAlunos.slice().sort((a, b) => Number(b.TotalFaltas || 0) - Number(a.TotalFaltas || 0));
  const inactiveCount = turmaAlunos.filter(a => String(a.Status || '').toLowerCase() === 'inativo').length;
  return {
    bestStudent: sortedByPercent[0] || null,
    mostAbsent: sortedByAbsences[0] || null,
    inactiveCount,
  };
}

function getTopStudentsOverall_(all) {
  return (all.alunos || [])
    .filter(a => Number(a.TotalPresencas || 0) + Number(a.TotalFaltas || 0) > 0)
    .slice()
    .sort((a, b) => Number(b.Percentual || 0) - Number(a.Percentual || 0));
}

function buildCallsByTurmaForDate_(dateKey, all) {
  const roster = all.alunos || [];
  const groupedRoster = groupBy_(roster, 'TurmaID');
  const savedRows = getBaseRowsForDate_(dateKey);
  const savedGrouped = groupBy_(savedRows, 'turmaId');

  const callsByTurma = {};
  const turmas = sortTurmas_(all.turmas);

  turmas.forEach(turma => {
    const turmaRoster = sortAlunos_(groupedRoster[turma.TurmaID] || []);
    const saved = savedGrouped[turma.TurmaID] || [];
    const savedMap = {};
    saved.forEach(row => {
      const key = String(row.alunoId || row.AlunoID || row.nome || '').trim();
      if (key) savedMap[key] = row;
    });

    const rows = turmaRoster.map(aluno => {
      const key = String(aluno.AlunoID || aluno.Nome || '').trim();
      const found = savedMap[key] || savedMap[normalizeKey_(aluno.Nome)] || {};
      const atraso = normalizeBool_(found.atraso || found.Atraso);
      const presenca = atraso ? 'atrasado' : normalizePresence_(found.presenca || found.Presenca || found.PRESENCA || (found.ausencia ? 'nao' : 'nao'));
      return {
        alunoId: aluno.AlunoID,
        nome: aluno.Nome,
        presenca,
        atraso,
        observacao: String(found.observacao || found.Observacao || '').trim(),
        statusAluno: String(aluno.Status || 'ativo').trim(),
      };
    });

    const callMeta = findCallMeta_(turma.TurmaID, dateKey);
    const presentes = rows.filter(r => isPresenceLikeRow_(r)).length;
    const atrasos = rows.filter(r => isDelayedRow_(r)).length;
    const ausentes = rows.length - presentes;
    const percentual = rows.length ? round1_((presentes / rows.length) * 100) : 0;

  
    callsByTurma[turma.TurmaID] = {
      chamadaId: callMeta?.ChamadaID || `${turma.TurmaID}_${dateKey}`,
      data: dateKey,
      turmaId: turma.TurmaID,
      turmaNome: turma.Nome,
      oferta: callMeta?.Oferta || '',
      visitantes: Number(callMeta?.Visitantes || 0) || 0,
      visitantesTexto: callMeta?.VisitantesTexto || '',
      totalAlunos: rows.length,
      presentes,
      atrasos,
      ausentes,
      percentual,
      enviadoTelegram: normalizeBool_(callMeta?.EnviadoTelegram),
      telegramEnviadoEm: callMeta?.TelegramEnviadoEm || '',
      rows,
      isSaved: !!callMeta,
    };
  });

  // Garante turmas cadastradas somente em meta, mesmo sem alunos na ReadBase.
  (all.turmas || []).forEach(turma => {
    if (!callsByTurma[turma.TurmaID]) {
      callsByTurma[turma.TurmaID] = {
        chamadaId: `${turma.TurmaID}_${dateKey}`,
        data: dateKey,
        turmaId: turma.TurmaID,
        turmaNome: turma.Nome,
        oferta: '',
        visitantes: 0,
        visitantesTexto: '',
        totalAlunos: 0,
        presentes: 0,
        atrasos: 0,
        ausentes: 0,
        percentual: 0,
        enviadoTelegram: false,
        telegramEnviadoEm: '',
        rows: [],
        isSaved: false,
      };
    }
  });

  return callsByTurma;
}

function getRosterForTurma_(turmaId, all) {
  const alunos = (all.alunos || []).filter(a => String(a.TurmaID || '') === String(turmaId || ''));
  return sortAlunos_(alunos);
}

function loadAllData_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const turmas = mergeTurmas_(loadMetaClasses_(), loadTurmasFromReadBase_());
  const studentsMeta = loadMetaStudents_();
  const roster = loadRosterFromReadBase_();
  const alunos = mergeRosterWithMeta_(roster, studentsMeta, turmas);
  return {
    turmas,
    alunos,
    studentsMeta,
  };
}

function loadTurmasFromReadBase_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(READ_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(normalizeHeader_);
  const idxAluno = findHeaderIndex_(headers, ['ALUNO', 'NOME']);
  const idxClasse = findHeaderIndex_(headers, ['CLASSE', 'TURMA']);
  if (idxAluno === -1 || idxClasse === -1) return [];

  const seen = new Map();
  let order = 1;
  for (let i = 1; i < values.length; i++) {
    const nome = String(values[i][idxAluno] || '').trim();
    const classe = String(values[i][idxClasse] || '').trim();
    if (!nome || !classe) continue;
    const turmaId = buildTurmaId_(classe);
    if (!seen.has(turmaId)) {
      seen.set(turmaId, {
        TurmaID: turmaId,
        Nome: classe,
        Ordem: order++,
        Ativa: 'sim',
        CriadoEm: '',
        AtualizadoEm: '',
      });
    }
  }
  return [...seen.values()];
}

function loadRosterFromReadBase_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(READ_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(normalizeHeader_);
  const idxAluno = findHeaderIndex_(headers, ['ALUNO', 'NOME']);
  const idxClasse = findHeaderIndex_(headers, ['CLASSE', 'TURMA']);
  const idxCpf = findHeaderIndex_(headers, ['CPF', 'DOCUMENTO']);
  if (idxAluno === -1 || idxClasse === -1) {
    throw new Error('Aba ReadBase precisa ter pelo menos as colunas ALUNO e CLASSE.');
  }

  const seen = new Map();
  const result = [];

  for (let i = 1; i < values.length; i++) {
    const nome = String(values[i][idxAluno] || '').trim();
    const classe = String(values[i][idxClasse] || '').trim();
    if (!nome || !classe) continue;

    const cpf = idxCpf !== -1 ? normalizeCpf_(values[i][idxCpf]) : '';
    const turmaId = buildTurmaId_(classe);
    const alunoId = buildStudentId_(nome, turmaId, cpf, i + 1);
    const key = `${alunoId}`;

    if (!seen.has(key)) {
      const item = {
        AlunoID: alunoId,
        Nome: nome,
        CPF: cpf,
        TurmaID: turmaId,
        TurmaNome: classe,
        Ativo: 'sim',
        FaltasConsecutivas: 0,
        TotalPresencas: 0,
        TotalFaltas: 0,
        Percentual: 0,
        Status: 'ativo',
        StatusManual: '',
        UltimaPresenca: '',
        UltimaAusencia: '',
        RealocadoDe: '',
        CriadoEm: '',
        AtualizadoEm: '',
      };
      seen.set(key, item);
      result.push(item);
    }
  }

  return result;
}

function mergeTurmas_(metaTurmas, readTurmas) {
  const map = new Map();
  [...(readTurmas || []), ...(metaTurmas || [])].forEach((turma, index) => {
    const turmaId = String(turma.TurmaID || buildTurmaId_(turma.Nome || '')).trim();
    if (!turmaId) return;
    if (!map.has(turmaId)) {
      map.set(turmaId, {
        TurmaID: turmaId,
        Nome: String(turma.Nome || '').trim(),
        Ordem: Number(turma.Ordem || index + 1) || index + 1,
        Ativa: normalizeBool_(turma.Ativa) ? 'sim' : String(turma.Ativa || 'sim'),
        CriadoEm: turma.CriadoEm || '',
        AtualizadoEm: turma.AtualizadoEm || '',
      });
    } else {
      const existing = map.get(turmaId);
      existing.Nome = existing.Nome || String(turma.Nome || '').trim();
      existing.Ordem = Number(existing.Ordem || turma.Ordem || index + 1) || index + 1;
      existing.Ativa = existing.Ativa || (normalizeBool_(turma.Ativa) ? 'sim' : 'sim');
    }
  });
  return [...map.values()];
}

function mergeRosterWithMeta_(roster, studentsMeta, turmas) {
  const metaById = new Map((studentsMeta || []).map(s => [String(s.AlunoID || ''), s]));
  const turmaById = new Map((turmas || []).map(t => [String(t.TurmaID || ''), t]));

  const merged = (roster || []).map(st => {
    const meta = metaById.get(String(st.AlunoID || '')) || {};
    const turmaId = String(meta.TurmaID || st.TurmaID || '').trim();
    const turma = turmaById.get(turmaId) || { Nome: st.TurmaNome || meta.TurmaNome || '', TurmaID: turmaId };

    return {
      AlunoID: String(st.AlunoID || meta.AlunoID || buildStudentId_(st.Nome, turmaId, st.CPF)),
      Nome: String(st.Nome || meta.Nome || '').trim(),
      CPF: String(st.CPF || meta.CPF || '').trim(),
      TurmaID: turmaId,
      TurmaNome: String(turma.Nome || st.TurmaNome || meta.TurmaNome || '').trim(),
      Ativo: String(meta.Ativo || st.Ativo || 'sim'),
      FaltasConsecutivas: Number(meta.FaltasConsecutivas ?? st.FaltasConsecutivas ?? 0) || 0,
      TotalPresencas: Number(meta.TotalPresencas ?? st.TotalPresencas ?? 0) || 0,
      TotalFaltas: Number(meta.TotalFaltas ?? st.TotalFaltas ?? 0) || 0,
      Percentual: Number(meta.Percentual ?? st.Percentual ?? 0) || 0,
      Status: String(meta.Status || st.Status || 'ativo').trim(),
      StatusManual: String(meta.StatusManual || st.StatusManual || '').trim(),
      UltimaPresenca: String(meta.UltimaPresenca || st.UltimaPresenca || '').trim(),
      UltimaAusencia: String(meta.UltimaAusencia || st.UltimaAusencia || '').trim(),
      RealocadoDe: String(meta.RealocadoDe || st.RealocadoDe || '').trim(),
      CriadoEm: String(meta.CriadoEm || st.CriadoEm || '').trim(),
      AtualizadoEm: String(meta.AtualizadoEm || st.AtualizadoEm || '').trim(),
    };
  });

  // Garante que novos alunos da ReadBase entrem mesmo sem meta prévia.
  const existingIds = new Set(merged.map(a => String(a.AlunoID || '')));
  (studentsMeta || []).forEach(meta => {
    const id = String(meta.AlunoID || '');
    if (!id || existingIds.has(id)) return;
    merged.push({
      AlunoID: id,
      Nome: String(meta.Nome || '').trim(),
      CPF: String(meta.CPF || '').trim(),
      TurmaID: String(meta.TurmaID || '').trim(),
      TurmaNome: String(meta.TurmaNome || '').trim(),
      Ativo: String(meta.Ativo || 'sim'),
      FaltasConsecutivas: Number(meta.FaltasConsecutivas || 0) || 0,
      TotalPresencas: Number(meta.TotalPresencas || 0) || 0,
      TotalFaltas: Number(meta.TotalFaltas || 0) || 0,
      Percentual: Number(meta.Percentual || 0) || 0,
      Status: String(meta.Status || 'ativo').trim(),
      StatusManual: String(meta.StatusManual || '').trim(),
      UltimaPresenca: String(meta.UltimaPresenca || '').trim(),
      UltimaAusencia: String(meta.UltimaAusencia || '').trim(),
      RealocadoDe: String(meta.RealocadoDe || '').trim(),
      CriadoEm: String(meta.CriadoEm || '').trim(),
      AtualizadoEm: String(meta.AtualizadoEm || '').trim(),
    });
  });

  return sortAlunos_(merged);
}

function loadMetaStudents_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(META_STUDENTS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  return values.slice(1).filter(row => row.some(v => String(v || '').trim() !== '')).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function loadMetaClasses_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(META_CLASSES_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  return values.slice(1).filter(row => row.some(v => String(v || '').trim() !== '')).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function upsertStudentMeta_(student) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet_(ss, META_STUDENTS_SHEET, META_STUDENTS_HEADERS, true);
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const idx = indexByHeader_(headers);
  const id = String(student.AlunoID || '').trim();
  const now = new Date().toISOString();

  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idx.AlunoID] || '') === id) {
      rowIndex = i + 1;
      break;
    }
  }

  const row = [
    id,
    student.Nome || '',
    student.TurmaID || '',
    student.TurmaNome || '',
    student.Ativo || 'sim',
    Number(student.FaltasConsecutivas || 0) || 0,
    Number(student.TotalPresencas || 0) || 0,
    Number(student.TotalFaltas || 0) || 0,
    Number(student.Percentual || 0) || 0,
    student.Status || 'ativo',
    student.StatusManual || '',
    student.UltimaPresenca || '',
    student.UltimaAusencia || '',
    student.RealocadoDe || '',
    student.CriadoEm || now,
    now,
  ];

  if (rowIndex === -1) {
    sheet.appendRow(row);
  } else {
    sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  }
}

function recalculateAndPersistStudentStats_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const baseRows = getBaseRowsAll_();
  const roster = loadRosterFromReadBase_();
  const studentsMeta = loadMetaStudents_();
  const metaById = new Map(studentsMeta.map(s => [String(s.AlunoID || ''), s]));

  // Organiza as ocorrências por aluno+turma.
  const grouped = new Map();
  baseRows.forEach(row => {
    const alunoId = String(row.alunoId || '').trim();
    if (!alunoId) return;
    const key = `${alunoId}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  });

  // Recalcula para o que já existe na base.
  const now = new Date().toISOString();
  const mergedRoster = mergeRosterWithMeta_(roster, studentsMeta, loadTurmasFromReadBase_().concat(loadMetaClasses_()));

  mergedRoster.forEach(st => {
    const meta = metaById.get(String(st.AlunoID || '')) || {};
    const studentRows = grouped.get(String(st.AlunoID || '')) || [];
    studentRows.sort((a, b) => compareDateKey_(a.dateKey, b.dateKey));

    let totalPresencas = 0;
    let totalFaltas = 0;
    let faltasConsecutivas = 0;
    let ultimaPresenca = '';
    let ultimaAusencia = '';

    studentRows.forEach(item => {
      if (isPresenceLikeRow_(item)) {
        totalPresencas++;
        faltasConsecutivas = 0;
        ultimaPresenca = item.dateKey;
      } else {
        totalFaltas++;
        faltasConsecutivas++;
        ultimaAusencia = item.dateKey;
      }
    });

    const total = totalPresencas + totalFaltas;
    const percentual = total ? round1_((totalPresencas / total) * 100) : 0;
    const autoStatus = faltasConsecutivas >= 4 ? 'inativo' : 'ativo';
    const finalStatus = String(meta.StatusManual || '').trim() || autoStatus;

    upsertStudentMeta_({
      AlunoID: st.AlunoID,
      Nome: st.Nome,
      TurmaID: st.TurmaID,
      TurmaNome: st.TurmaNome,
      Ativo: finalStatus === 'ativo' ? 'sim' : 'nao',
      FaltasConsecutivas: faltasConsecutivas,
      TotalPresencas: totalPresencas,
      TotalFaltas: totalFaltas,
      Percentual: percentual,
      Status: finalStatus,
      StatusManual: String(meta.StatusManual || '').trim(),
      UltimaPresenca: ultimaPresenca,
      UltimaAusencia: ultimaAusencia,
      RealocadoDe: String(meta.RealocadoDe || '').trim(),
      CriadoEm: String(meta.CriadoEm || now).trim(),
      AtualizadoEm: now,
    });
  });
}

function replaceBaseRowsForCall_(dateKey, turmaId, turmaNome, normalizedRows, extra) {
  Logger.log('INICIANDO SALVAMENTO');
  Logger.log('SPREADSHEET_ID: ' + SPREADSHEET_ID);

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  Logger.log('PLANILHA ABERTA: ' + ss.getName());

  const sheet = getOrCreateSheet_(ss, BASE_SHEET_NAME, BASE_HEADERS, false);
  Logger.log('ABA ENCONTRADA: ' + sheet.getName());

  const beforeRows = Math.max(0, sheet.getLastRow() - 1);
  Logger.log('ÚLTIMA LINHA ANTES: ' + sheet.getLastRow());

  if (!normalizedRows || !normalizedRows.length) {
    throw new Error('Não há linhas para salvar.');
  }

  const [year, month] = String(dateKey).split('-');
  const dataBr = formatDateBR_(dateKey);
  const mesTxt = monthToAbbrev_(month);

  const rowsToAppend = normalizedRows.map((r) => ([
  dataBr,
  Number(year),
  mesTxt,
  r.nome,
  turmaNome || getTurmaNameById_(turmaId),
  r.presenca === 'sim' ? 1 : 0,
  r.atraso ? 1 : 0,
  r.presenca === 'nao' ? 1 : 0,
  extra?.oferta || 'R$ 0,00',
  Number(extra?.visitantes || 0),
]));

  Logger.log('LINHAS PARA INSERIR:');
  Logger.log(JSON.stringify(rowsToAppend, null, 2));

  const startRow = sheet.getLastRow() + 1;
  Logger.log('START ROW: ' + startRow);

  sheet.getRange(startRow, 1, rowsToAppend.length, rowsToAppend[0].length).setValues(rowsToAppend);
  SpreadsheetApp.flush();

  const afterRows = Math.max(0, sheet.getLastRow() - 1);
  Logger.log('ÚLTIMA LINHA DEPOIS: ' + sheet.getLastRow());
  Logger.log('SALVAMENTO FINALIZADO');

  return {
    beforeRows,
    afterRows,
    insertedRows: Math.max(0, afterRows - beforeRows),
  };
}

function getBaseRowsCount_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(BASE_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return 0;
  return sheet.getLastRow() - 1;
}
function getBaseRowsAll_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(BASE_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(normalizeHeader_);
  const idx = indexByHeader_(headers);
  const result = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const aluno = String(row[idx.ALUNO] || '').trim();
    const classe = String(row[idx.CLASSE] || '').trim();
    if (!aluno || !classe) continue;

    const turmaId = buildTurmaId_(classe);
    const atraso = normalizeBool_(row[idx.ATRASO]);
    const presenca = atraso ? 'atrasado' : normalizePresence_(row[idx.PRESENCA]);
    result.push({
      dateKey: normalizeDateFromBaseCell_(row[idx.DATA]),
      ano: row[idx.ANO],
      mes: row[idx.MES],
      nome: aluno,
      turmaId,
      turmaNome: classe,
      presenca,
      atraso,
      ausencia: normalizeBool_(row[idx.AUSENCIA]),
      oferta: row[idx.OFERTA] || '',
      alunoId: buildStudentId_(aluno, turmaId, ''),
    });
  }

  return result;
}

function getBaseRowsForDate_(dateKey) {
  return getBaseRowsAll_().filter(row => row.dateKey === dateKey);
}

function findCallMeta_(turmaId, dateKey) {
  const reportId = `CALL_${turmaId}_${dateKey}`;
  const log = getReportLogById_(reportId);
  if (!log) return null;
  return {
    ChamadaID: reportId,
    Data: formatDateBR_(dateKey),
    TurmaID: turmaId,
    Oferta: extractCallMetaField_(log.Texto, 'oferta') || '',
    Visitantes: Number(extractCallMetaField_(log.Texto, 'visitantes') || 0) || 0,
    VisitantesTexto: extractCallMetaField_(log.Texto, 'visitantesTexto') || '',
    EnviadoTelegram: String(log.Enviado || 'nao'),
    TelegramEnviadoEm: String(log.EnviadoEm || ''),
  };
}

function upsertCallMeta_(chamadaId, dateKey, turmaId, oferta, visitantes, visitantesTexto, totalAlunos, presentes, ausentes, percentual, enviadoTelegram) {
  


const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet_(ss, REPORTS_SHEET, REPORTS_HEADERS, true);
  const existing = getCallMetaRows_(sheet);
  const reportId = `CALL_${turmaId}_${dateKey}`;
  const hash = textHash_([dateKey, turmaId, oferta, visitantes, visitantesTexto, totalAlunos, presentes, ausentes, percentual].join('|'));
  const now = new Date().toISOString();
  const text = JSON.stringify({ chamadaId, dateKey, turmaId, oferta, visitantes, visitantesTexto, totalAlunos, presentes, ausentes, percentual });

  let rowIndex = -1;
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const idx = indexByHeader_(headers);
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idx.RelatorioID] || '') === reportId) {
      rowIndex = i + 1;
      break;
    }
  }

  const row = [
    reportId,
    'chamada',
    dateKey,
    turmaId,
    hash,
    enviadoTelegram ? 'sim' : 'nao',
    enviadoTelegram ? now : '',
    text,
    now,
  ];

  if (rowIndex === -1) {
    sheet.appendRow(row);
  } else {
    sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  }
}

function getCallMetaRows_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  return values.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function markCallAsSent_(turmaId, dateKey, text) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet_(ss, REPORTS_SHEET, REPORTS_HEADERS, true);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return;

  const headers = values[0].map(String);
  const idx = indexByHeader_(headers);
  const reportId = `CALL_${turmaId}_${dateKey}`;
  const now = new Date().toISOString();

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idx.RelatorioID] || '') === reportId) {
      values[i][idx.Enviado] = 'sim';
      values[i][idx.EnviadoEm] = now;
      values[i][idx.Texto] = text || values[i][idx.Texto] || '';
      sheet.getRange(i + 1, 1, 1, headers.length).setValues([values[i]]);
      return;
    }
  }
}

function getReportLogById_(reportId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(REPORTS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return null;

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const idx = indexByHeader_(headers);
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idx.RelatorioID] || '') === String(reportId || '')) {
      const obj = {};
      headers.forEach((h, j) => obj[h] = values[i][j]);
      return obj;
    }
  }
  return null;
}

function extractCallMetaField_(text, field) {
  try {
    const obj = JSON.parse(String(text || '{}'));
    return obj ? obj[field] : '';
  } catch (err) {
    return '';
  }
}

function appendReadBaseStudent_(sheet, nome, turmaNome, cpf, alunoId, now) {
  const headers = getReadBaseHeaders_();
  const values = sheet.getDataRange().getValues();
  if (values.length === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  const cols = getReadBaseHeaderIndexes_(sheet);
  const row = new Array(Math.max(headers.length, cols.maxLen)).fill('');
  if (cols.ALUNO !== -1) row[cols.ALUNO] = nome;
  if (cols.NOME !== -1 && cols.ALUNO === -1) row[cols.NOME] = nome;
  if (cols.CLASSE !== -1) row[cols.CLASSE] = turmaNome;
  if (cols.TURMA !== -1 && cols.CLASSE === -1) row[cols.TURMA] = turmaNome;
  if (cols.CPF !== -1) row[cols.CPF] = cpf;
  if (cols.ALUNOID !== -1) row[cols.ALUNOID] = alunoId;
  if (cols.CRiadoEm !== -1) row[cols.CRiadoEm] = now;

  sheet.appendRow(row.slice(0, Math.max(headers.length, cols.maxLen)));
}

function getReadBaseHeaders_() {
  return ['ALUNO', 'CLASSE', 'CPF', 'ALUNOID', 'CRIADOEM'];
}

function getReadBaseHeaderIndexes_(sheet) {
  const values = sheet.getDataRange().getValues();
  const headerRow = values.length ? values[0].map(normalizeHeader_) : [];
  const find = (aliases) => findHeaderIndex_(headerRow, aliases);
  const maxLen = Math.max(headerRow.length, 5);
  return {
    ALUNO: find(['ALUNO', 'NOME']),
    NOME: find(['NOME']),
    CLASSE: find(['CLASSE']),
    TURMA: find(['TURMA']),
    CPF: find(['CPF']),
    ALUNOID: find(['ALUNOID', 'ALUNO_ID', 'ID']),
    CRiadoEm: find(['CRIADOEM', 'CRIADO_EM', 'DATACRIACAO']),
    maxLen,
  };
}

function getTurmaNameById_(turmaId) {
  const all = loadAllData_();
  const turma = (all.turmas || []).find(t => String(t.TurmaID || '') === String(turmaId || ''));
  return turma ? turma.Nome : String(turmaId || '');
}

function getTurmaByIdOrName_(turmaIdOrName, turmas) {
  const target = String(turmaIdOrName || '').trim();
  if (!target) return null;
  const normalizedTarget = normalizeKey_(target);
  return (turmas || []).find(t => normalizeKey_(String(t.TurmaID || '')) === normalizedTarget || normalizeKey_(String(t.Nome || '')) === normalizedTarget) || null;
}

function findStudentMetaById_(alunoId) {
  return loadMetaStudents_().find(s => String(s.AlunoID || '') === String(alunoId || '')) || null;
}

function findMetaClassById_(turmaId) {
  return loadMetaClasses_().find(t => String(t.TurmaID || '') === String(turmaId || '')) || null;
}

function updateMetaClass_(turmaId, patch) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet_(ss, META_CLASSES_SHEET, META_CLASSES_HEADERS, true);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    sheet.appendRow([turmaId, patch.Nome || '', patch.Ordem || 0, patch.Ativa || 'sim', patch.CriadoEm || new Date().toISOString(), patch.AtualizadoEm || new Date().toISOString()]);
    return;
  }

  const headers = values[0].map(String);
  const idx = indexByHeader_(headers);
  const now = new Date().toISOString();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idx.TurmaID] || '') === String(turmaId || '')) {
      values[i][idx.Nome] = patch.Nome ?? values[i][idx.Nome];
      values[i][idx.Ordem] = patch.Ordem ?? values[i][idx.Ordem];
      values[i][idx.Ativa] = patch.Ativa ?? values[i][idx.Ativa];
      values[i][idx.AtualizadoEm] = patch.AtualizadoEm ?? now;
      sheet.getRange(i + 1, 1, 1, headers.length).setValues([values[i]]);
      return;
    }
  }
  sheet.appendRow([turmaId, patch.Nome || '', patch.Ordem || 0, patch.Ativa || 'sim', patch.CriadoEm || now, patch.AtualizadoEm || now]);
}

function upsertReportLog_(log) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet_(ss, REPORTS_SHEET, REPORTS_HEADERS, true);
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const idx = indexByHeader_(headers);
  const now = new Date().toISOString();
  let rowIndex = -1;

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idx.RelatorioID] || '') === String(log.reportId || '')) {
      rowIndex = i + 1;
      break;
    }
  }

  const row = [
    log.reportId,
    log.tipo,
    log.dateKey,
    log.turmaId || '',
    log.hash,
    log.enviado,
    now,
    log.text || '',
    now,
  ];

  if (rowIndex === -1) {
    sheet.appendRow(row);
  } else {
    sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  }
}

function ensureSheets_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  getOrCreateSheet_(ss, READ_SHEET_NAME, getReadBaseHeaders_(), false);

  const baseSheet = getOrCreateSheet_(ss, BASE_SHEET_NAME, BASE_HEADERS, false);

  ensureBaseHeaders_(baseSheet, BASE_HEADERS);

  getOrCreateSheet_(ss, META_STUDENTS_SHEET, META_STUDENTS_HEADERS, true);
  getOrCreateSheet_(ss, META_CLASSES_SHEET, META_CLASSES_HEADERS, true);
  getOrCreateSheet_(ss, REPORTS_SHEET, REPORTS_HEADERS, true);
}

function ensureBaseHeaders_(sheet, headers) {
  if (!sheet) return;

  const currentCols = sheet.getLastColumn();

  if (currentCols < headers.length) {
    sheet.insertColumnsAfter(
      Math.max(currentCols, 1),
      headers.length - currentCols
    );

    const missingHeaders = headers.slice(currentCols);

    if (missingHeaders.length) {
      sheet
        .getRange(1, currentCols + 1, 1, missingHeaders.length)
        .setValues([missingHeaders]);
    }
  }

  if (sheet.getFrozenRows() < 1) {
    sheet.setFrozenRows(1);
  }
}

function getOrCreateSheet_(ss, name, headers, hidden) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);

  const maxCols = Math.max(headers.length, sheet.getMaxColumns());
  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
  }

  const firstRow = sheet.getLastRow() > 0 ? sheet.getRange(1, 1, 1, headers.length).getValues()[0] : [];
  const isEmptyHeader = !firstRow.length || firstRow.every(v => String(v || '').trim() === '');
  if (isEmptyHeader) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }

  if (hidden) {
    try { sheet.hideSheet(); } catch (e) {}
  }

  return sheet;
}

function sortTurmas_(turmas) {
  return (turmas || []).slice().sort((a, b) => {
    const oa = Number(a.Ordem || 0) || 0;
    const ob = Number(b.Ordem || 0) || 0;
    if (oa !== ob) return oa - ob;
    return String(a.Nome || '').localeCompare(String(b.Nome || ''));
  });
}

function sortAlunos_(alunos) {
  return (alunos || []).slice().sort((a, b) => {
    const ta = String(a.TurmaNome || a.TurmaID || '').localeCompare(String(b.TurmaNome || b.TurmaID || ''));
    if (ta !== 0) return ta;
    const ia = String(a.Status || 'ativo').toLowerCase() === 'inativo' ? 1 : 0;
    const ib = String(b.Status || 'ativo').toLowerCase() === 'inativo' ? 1 : 0;
    if (ia !== ib) return ia - ib;
    return String(a.Nome || '').localeCompare(String(b.Nome || ''));
  });
}

function groupBy_(items, key) {
  return (items || []).reduce((acc, item) => {
    const val = String(item?.[key] || '');
    if (!acc[val]) acc[val] = [];
    acc[val].push(item);
    return acc;
  }, {});
}

function normalizeHeader_(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
}

function findHeaderIndex_(headers, aliases) {
  const list = (aliases || []).map(normalizeHeader_);
  for (let i = 0; i < headers.length; i++) {
    if (list.includes(headers[i])) return i;
  }
  return -1;
}

function indexByHeader_(headers) {
  const idx = {};
  const lookup = (aliases) => findHeaderIndex_(headers, aliases);
  idx.DATA = lookup(['DATA', 'DATE']);
  idx.ANO = lookup(['ANO', 'YEAR']);
  idx.MES = lookup(['MES', 'MÊS', 'MONTH']);
  idx.ALUNO = lookup(['ALUNO', 'NOME', 'STUDENT']);
  idx.CLASSE = lookup(['CLASSE', 'TURMA', 'CLASS']);
  idx.PRESENCA = lookup(['PRESENCA', 'PRESENÇA', 'PRESENTE']);
  idx.ATRASO = lookup(['ATRASO', 'LATE']);
  idx.AUSENCIA = lookup(['AUSENCIA', 'AUSÊNCIA', 'FALTA']);
  idx.OFERTA = lookup(['OFERTA', 'VALOR', 'R', 'R$']);

  idx.AlunoID = lookup(['ALUNOID', 'ALUNO_ID', 'ID']);
  idx.Nome = lookup(['NOME', 'ALUNO']);
  idx.TurmaID = lookup(['TURMAID', 'TURMA_ID', 'CLASSE']);
  idx.TurmaNome = lookup(['TURMANOME', 'TURMA_NOME', 'CLASSE']);
  idx.Ativo = lookup(['ATIVO']);
  idx.FaltasConsecutivas = lookup(['FALTASCONSECUTIVAS']);
  idx.TotalPresencas = lookup(['TOTALPRESENCAS']);
  idx.TotalFaltas = lookup(['TOTALFALTAS']);
  idx.Percentual = lookup(['PERCENTUAL']);
  idx.Status = lookup(['STATUS']);
  idx.StatusManual = lookup(['STATUSMANUAL']);
  idx.UltimaPresenca = lookup(['ULTIMAPRESENCA']);
  idx.UltimaAusencia = lookup(['ULTIMAAUSENCIA']);
  idx.RealocadoDe = lookup(['REALOCADODE']);
  idx.CriadoEm = lookup(['CRIADOEM']);
  idx.AtualizadoEm = lookup(['ATUALIZADOEM']);
  idx.Visitantes = lookup(['VISITANTES']);
  idx.VisitantesTexto = lookup(['VISITANTESTEXTO']);
  idx.Enviado = lookup(['ENVIADO']);
  idx.EnviadoEm = lookup(['ENVIADOEM']);
  idx.Texto = lookup(['TEXTO']);
  idx.RelatorioID = lookup(['RELATORIOID']);
  idx.maxLen = headers.length;
  return idx;
}



function isDelayedRow_(row) {
  return String(row?.presenca || '').toLowerCase().trim() === 'atrasado' || normalizeBool_(row?.atraso);
}

function isPresenceLikeRow_(row) {
  const presenca = String(row?.presenca || '').toLowerCase().trim();
  return presenca === 'sim' || presenca === 'atrasado' || normalizeBool_(row?.atraso);
}
function normalizePresence_(value) {
  const v = String(value || '').toLowerCase().trim();
  return (v === 'sim' || v === 'presente' || v === '1' || v === 'p' || v === 'true') ? 'sim' : 'nao';
}

function normalizeBool_(value) {
  const v = String(value || '').toLowerCase().trim();
  return v === 'sim' || v === 'true' || v === '1' || v === 'yes' || v === 'y';
}

function normalizeCpf_(value) {
  return String(value || '').replace(/\D/g, '').padStart(11, '0').slice(-11);
}

function normalizeDateKey_(value) {
  const str = String(value || '').trim();
  if (!str) return todayKey_();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const d = new Date(str);
  if (isNaN(d.getTime())) return todayKey_();
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function normalizeDateFromBaseCell_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  const str = String(value || '').trim();
  if (!str) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    const [dd, mm, yyyy] = str.split('/');
    return `${yyyy}-${mm}-${dd}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const d = new Date(str);
  if (isNaN(d.getTime())) return '';
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function todayKey_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function formatDateBR_(dateKey) {
  const d = new Date(`${dateKey}T00:00:00`);
  if (isNaN(d.getTime())) return dateKey;
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy');
}

function monthToAbbrev_(month) {
  const map = {
    '01': 'JAN.', '02': 'FEV.', '03': 'MAR.', '04': 'ABR.', '05': 'MAI.', '06': 'JUN.',
    '07': 'JUL.', '08': 'AGO.', '09': 'SET.', '10': 'OUT.', '11': 'NOV.', '12': 'DEZ.'
  };
  return map[String(month || '').padStart(2, '0')] || String(month || '');
}

function parseMoney_(value) {
  const raw = String(value || '').trim();
  if (!raw) return 0;
  const n = Number(raw.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, ''));
  return isFinite(n) ? n : 0;
}

function formatMoney_(value) {
  try {
    return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  } catch (err) {
    return 'R$ 0,00';
  }
}

function formatPercent_(value) {
  return `${round1_(Number(value || 0)).toFixed(1).replace('.', ',')}%`;
}

function round1_(n) {
  return Math.round((Number(n || 0) + Number.EPSILON) * 10) / 10;
}

function textHash_(text) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text || ''));
  return bytes.map(b => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join('');
}

function buildTurmaId_(nome) {
  return `T_${normalizeKey_(nome) || Utilities.getUuid().slice(0, 8).toUpperCase()}`;
}

function buildStudentId_(nome, turmaId, cpf, rowNumber) {
  const base = [nome, turmaId, cpf || '']
    .map(v => normalizeKey_(String(v || '')))
    .filter(Boolean)
    .join('_');
  return `A_${base || normalizeKey_(String(rowNumber || Utilities.getUuid())).slice(0, 20).toUpperCase()}`;
}

function normalizeKey_(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

function compareDateKey_(a, b) {
  return String(a || '').localeCompare(String(b || ''));
}

function sendTelegram_(text) {
  if (
    !TELEGRAM_BOT_TOKEN ||
    !TELEGRAM_CHAT_ID ||
    String(TELEGRAM_BOT_TOKEN).includes('COLE_SEU_TOKEN_AQUI') ||
    String(TELEGRAM_CHAT_ID).includes('COLE_SEU_CHAT_ID_AQUI')
  ) {
    return;
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const payload = {
    chat_id: TELEGRAM_CHAT_ID,
    text: String(text || ''),
    disable_web_page_preview: true,
    parse_mode: 'Markdown',
  };

  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}














