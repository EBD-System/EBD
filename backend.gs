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

const BASE_HEADERS = ['DATA', 'ANO', 'MÊS', 'ALUNO', 'CLASSE', 'PRESENÇA', 'ATRASO', 'AUSÊNCIA', 'OFERTA', 'VISITANTES', 'BÍBLIAS', 'REVISTAS'];
const META_STUDENTS_HEADERS = [
  'AlunoID', 'Nome', 'TurmaID', 'TurmaNome', 'Ativo',
  'FaltasConsecutivas', 'TotalPresencas', 'TotalFaltas', 'Percentual',
  'Status', 'StatusManual', 'UltimaPresenca', 'UltimaAusencia',
  'RealocadoDe', 'CriadoEm', 'AtualizadoEm'
];
const META_CLASSES_HEADERS = ['TurmaID', 'Nome', 'Ordem', 'Ativa', 'CriadoEm', 'AtualizadoEm'];
const REPORTS_HEADERS = ['RelatorioID', 'Tipo', 'Data', 'TurmaID', 'Hash', 'Enviado', 'EnviadoEm', 'Texto', 'CriadoEm'];

var __BACKEND_RUNTIME_CACHE__ = {
  allData: null,
  baseRowsAll: null,
  baseRowsByDate: {},
  metaStudents: null,
  metaClasses: null,
  reportLogsById: null,
  loadTurmasFromReadBase: null,
  loadRosterFromReadBase: null,
};

function invalidateRuntimeCache_() {
  __BACKEND_RUNTIME_CACHE__.allData = null;
  __BACKEND_RUNTIME_CACHE__.baseRowsAll = null;
  __BACKEND_RUNTIME_CACHE__.baseRowsByDate = {};
  __BACKEND_RUNTIME_CACHE__.metaStudents = null;
  __BACKEND_RUNTIME_CACHE__.metaClasses = null;
  __BACKEND_RUNTIME_CACHE__.reportLogsById = null;
  __BACKEND_RUNTIME_CACHE__.loadTurmasFromReadBase = null;
  __BACKEND_RUNTIME_CACHE__.loadRosterFromReadBase = null;
}

function deleteRowsByNumberDesc_(sheet, rowNumbers) {
  const unique = [...new Set((rowNumbers || []).filter(n => Number(n) > 1).map(n => Number(n)))].sort((a, b) => b - a);
  if (!unique.length) return;

  let i = 0;
  while (i < unique.length) {
    const start = unique[i];
    let count = 1;
    while (i + count < unique.length && unique[i + count] === unique[i + count - 1] - 1) {
      count++;
    }
    sheet.deleteRows(start - count + 1, count);
    i += count;
  }
}

function writeStudentMetaRows_(students) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet_(ss, META_STUDENTS_SHEET, META_STUDENTS_HEADERS, true);
  const rows = (students || []).map(student => ([
    String(student.AlunoID || '').trim(),
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
    student.CriadoEm || '',
    student.AtualizadoEm || new Date().toISOString(),
  ]));

  const desiredLastRow = rows.length + 1;
  const currentLastRow = sheet.getLastRow();

  if (currentLastRow > desiredLastRow) {
    sheet.getRange(desiredLastRow + 1, 1, currentLastRow - desiredLastRow, META_STUDENTS_HEADERS.length).clearContent();
  }

  sheet.getRange(1, 1, 1, META_STUDENTS_HEADERS.length).setValues([META_STUDENTS_HEADERS]);
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, META_STUDENTS_HEADERS.length).setValues(rows);
  }

  invalidateRuntimeCache_();
}



function doGet(e) {

     // debugRoundTripChamada_();
     // debugLerChamadaSalva_('2026-05-14', 'T_cordei_de_cristo');

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
    baseRowsCount: (all.baseRowsAll || []).length,
    timestamps: { now: new Date().toISOString() },
  };
}




function saveCall_(p) {
  ensureSheets_();

  const dateKey = normalizeDateKey_(p.date || todayKey_());
  const turmaId = String(p.turmaId || p.turmaNome || p.turma || '').trim();
  const oferta = parseMoney_(p.oferta);
  const visitantes = Number(p.visitantes || 0) || 0;
  const biblias = Number(p.biblias || 0) || 0;
  const revistas = Number(p.revistas || 0) || 0;
  //const visitantesTexto = String(p.visitantesTexto || '').trim();
  const chamadaId = String(p.chamadaId || `${turmaId}_${dateKey}`).trim();
  const rowsJson = String(p.rowsJson || '[]');
  const autoSend = normalizeBool_(p.sendTelegram ?? p.autoSend ?? 'sim');

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
      biblias,
      revistas,
    }
  );

  upsertCallMeta_(
    chamadaId,
    dateKey,
    turma.TurmaID,
    oferta,
    visitantes,
    biblias,
    revistas,
    normalizedRows.length,
    presentes,
    ausentes,
    percentual,
    false
  );

  recalculateAndPersistStudentStats_();

  invalidateRuntimeCache_();
  const allAfter = loadAllData_();
  const callsByTurma = buildCallsByTurmaForDate_(dateKey, allAfter);
  const geral = buildDailyGeneralSummary_(dateKey, allAfter, callsByTurma);
  const turmaCall = callsByTurma[turma.TurmaID];

  let telegram = { sent: false, alreadySent: false, message: '' };
  if (autoSend) {
    try {
      telegram = sendTelegramForTurma_(dateKey, turma.TurmaID, allAfter, callsByTurma[turma.TurmaID]);
      if (telegram && telegram.sent) {
        markCallAsSent_(turma.TurmaID, dateKey, telegram.text);
      }
    } catch (err) {
      telegram = {
        ok: false,
        sent: false,
        alreadySent: false,
        message: `Erro ao enviar ao Telegram: ${String(err && err.message ? err.message : err)}`,
        error: String(err && err.message ? err.message : err),
      };
    }
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
  invalidateRuntimeCache_();
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

  invalidateRuntimeCache_();
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

  invalidateRuntimeCache_();
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

  invalidateRuntimeCache_();
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

  const telegramResult = sendTelegram_(text);
  if (!telegramResult || !telegramResult.sent) {
    return {
      ok: false,
      sent: false,
      alreadySent: false,
      message: (telegramResult && telegramResult.message) || 'Telegram não configurado.',
      text,
      telegramResult,
    };
  }

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
    telegramResult,
  };
}


function getActiveCallRows_(rows) {
  return (rows || []).filter(r => String(r.statusAluno || '').trim().toLowerCase() !== 'inativo');
}


function buildTurmaReportText_(dateKey, turma, turmaCall, all) {
  const rows = Array.isArray(turmaCall?.rows) ? turmaCall.rows : [];
  const activeRows = getActiveCallRows_(rows);
  const inativos = rows.filter(r => String(r.statusAluno || '').trim().toLowerCase() === 'inativo').length;
  const matriculados = activeRows.length;
  const presentes = activeRows.filter(r => isPresenceLikeRow_(r)).length;
  const ausentes = matriculados - presentes;
  const visitantes = Number(turmaCall?.visitantes ?? 0) || 0;
  const totalAssistencia = presentes + visitantes;
  const biblias = Number(turmaCall?.biblias ?? 0) || 0;
  const revistas = Number(turmaCall?.revistas ?? 0) || 0;
  const ofertas = (turmaCall?.oferta === '' || turmaCall?.oferta === null || turmaCall?.oferta === undefined)
    ? null
    : turmaCall?.oferta;

  const topStats = getTopStatsForTurma_(turma.TurmaID, all);
  const lines = [];
  lines.push(`Relatório da turma`);
  lines.push(`Data: ${formatDateBR_(dateKey)}`);
  lines.push(`Turma: ${turma.Nome}`);
  lines.push('');
  buildReportMetricLines_({
    matriculados,
    ausentes,
    presentes,
    visitantes,
    totalAssistencia,
    biblias,
    revistas,
    ofertas,
  }).forEach(line => lines.push(line));
  lines.push('');
  lines.push(`Resumo interno`);
  lines.push(`- *MAIS FALTAS*: ${getMostAbsentLabel_(topStats)}`);
  lines.push(`- *INATIVOS*: ${formatReportValue_(inativos)}`);
  lines.push('');
  lines.push(`Lista de presença:`);
  if (rows.length) {
    rows.forEach(row => {
      lines.push(`${row.nome || 'Sem nome'}: *${getPresenceStatusLabel_(row)}*`);
    });
  } else {
    lines.push(`null`);
  }

  return lines.join('\n');
}



function buildGeneralReportText_(dateKey, geral, callsByTurma, all) {
  const inativos = (all.alunos || []).filter(a => String(a.Status || '').trim().toLowerCase() === 'inativo').length;
  const mostAbsentOverall = getMostAbsentStudentOverall_(all);
  const hasCalls = Object.values(callsByTurma || {}).some(call => !!call && (call.isSaved || Number(call.totalAlunos || 0) > 0));
  const ofertas = hasCalls ? geral.ofertaTotal : null;

  const lines = [];
  lines.push(`Relatório geral`);
  lines.push(`Data: ${formatDateBR_(dateKey)}`);
  lines.push('');
  buildReportMetricLines_({
    matriculados: geral.totalAlunos,
    ausentes: geral.ausentes,
    presentes: geral.presentes,
    visitantes: geral.visitantesTotal,
    totalAssistencia: Number(geral.presentes || 0) + Number(geral.visitantesTotal || 0),
    biblias: geral.bibliasTotal,
    revistas: geral.revistasTotal,
    ofertas,
  }).forEach(line => lines.push(line));
  lines.push('');
  lines.push(`Resumo interno`);
  lines.push(`- *MAIS FALTAS*: ${getMostAbsentLabel_({ mostAbsent: mostAbsentOverall })}`);
  lines.push(`- *INATIVOS*: ${formatReportValue_(inativos)}`);

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
  const bibliasTotal = calls.reduce((sum, c) => sum + Number(c.biblias || 0), 0);
  const revistasTotal = calls.reduce((sum, c) => sum + Number(c.revistas || 0), 0);
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
    bibliasTotal,
    revistasTotal
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
  const reportMetaCache = {};

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

    const callMeta = getCallMetaForTurmaAndDate_(turma.TurmaID, dateKey, reportMetaCache);
    const presentes = rows.filter(r => isPresenceLikeRow_(r)).length;
    const atrasos = rows.filter(r => isDelayedRow_(r)).length;
    const ausentes = rows.length - presentes;
    const percentual = rows.length ? round1_((presentes / rows.length) * 100) : 0;

    callsByTurma[turma.TurmaID] = {
      chamadaId: callMeta?.ChamadaID || `${turma.TurmaID}_${dateKey}`,
      data: dateKey,
      turmaId: turma.TurmaID,
      turmaNome: turma.Nome,
      oferta: callMeta?.Oferta ?? '',
      visitantes: Number(callMeta?.Visitantes ?? 0) || 0,
      biblias: Number(callMeta?.Biblias ?? 0) || 0,
      revistas: Number(callMeta?.Revistas ?? 0) || 0,
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

  (all.turmas || []).forEach(turma => {
    if (!callsByTurma[turma.TurmaID]) {
      callsByTurma[turma.TurmaID] = {
        chamadaId: `${turma.TurmaID}_${dateKey}`,
        data: dateKey,
        turmaId: turma.TurmaID,
        turmaNome: turma.Nome,
        oferta: '',
        visitantes: 0,
        biblias: 0,
        revistas: 0,
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
  if (__BACKEND_RUNTIME_CACHE__.allData) return __BACKEND_RUNTIME_CACHE__.allData;

  const turmas = mergeTurmas_(loadMetaClasses_(), loadTurmasFromReadBase_());
  const studentsMeta = loadMetaStudents_();
  const roster = loadRosterFromReadBase_();
  const alunos = mergeRosterWithMeta_(roster, studentsMeta, turmas);

  const data = {
    turmas,
    alunos,
    studentsMeta,
    baseRowsAll: getBaseRowsAll_(),
  };

  __BACKEND_RUNTIME_CACHE__.allData = data;
  return data;
}




function loadTurmasFromReadBase_() {
  const cached = __BACKEND_RUNTIME_CACHE__.loadTurmasFromReadBase;
  if (cached) return cached;

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(READ_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) {
    __BACKEND_RUNTIME_CACHE__.loadTurmasFromReadBase = [];
    return [];
  }

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(normalizeHeader_);
  const idxAluno = findHeaderIndex_(headers, ['ALUNO', 'NOME']);
  const idxClasse = findHeaderIndex_(headers, ['CLASSE', 'TURMA']);
  if (idxAluno === -1 || idxClasse === -1) {
    __BACKEND_RUNTIME_CACHE__.loadTurmasFromReadBase = [];
    return [];
  }

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

  const result = [...seen.values()];
  __BACKEND_RUNTIME_CACHE__.loadTurmasFromReadBase = result;
  return result;
}




function loadRosterFromReadBase_() {
  const cached = __BACKEND_RUNTIME_CACHE__.loadRosterFromReadBase;
  if (cached) return cached;

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(READ_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) {
    __BACKEND_RUNTIME_CACHE__.loadRosterFromReadBase = [];
    return [];
  }

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

  __BACKEND_RUNTIME_CACHE__.loadRosterFromReadBase = result;
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




function loadMetaStudents_(forceReload) {
  if (!forceReload && __BACKEND_RUNTIME_CACHE__.metaStudents) return __BACKEND_RUNTIME_CACHE__.metaStudents;

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(META_STUDENTS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) {
    __BACKEND_RUNTIME_CACHE__.metaStudents = [];
    return [];
  }

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const result = values.slice(1).filter(row => row.some(v => String(v || '').trim() !== '')).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });

  __BACKEND_RUNTIME_CACHE__.metaStudents = result;
  return result;
}




function loadMetaClasses_(forceReload) {
  if (!forceReload && __BACKEND_RUNTIME_CACHE__.metaClasses) return __BACKEND_RUNTIME_CACHE__.metaClasses;

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(META_CLASSES_SHEET);
  if (!sheet || sheet.getLastRow() < 2) {
    __BACKEND_RUNTIME_CACHE__.metaClasses = [];
    return [];
  }

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const result = values.slice(1).filter(row => row.some(v => String(v || '').trim() !== '')).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });

  __BACKEND_RUNTIME_CACHE__.metaClasses = result;
  return result;
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

  invalidateRuntimeCache_();
}




function recalculateAndPersistStudentStats_() {
  const baseRows = getBaseRowsAll_();
  const roster = loadRosterFromReadBase_();
  const studentsMeta = loadMetaStudents_();
  const metaById = new Map(studentsMeta.map(s => [String(s.AlunoID || ''), s]));

  const grouped = new Map();
  baseRows.forEach(row => {
    const alunoId = String(row.alunoId || '').trim();
    if (!alunoId) return;
    if (!grouped.has(alunoId)) grouped.set(alunoId, []);
    grouped.get(alunoId).push(row);
  });

  const mergedRoster = mergeRosterWithMeta_(roster, studentsMeta, loadTurmasFromReadBase_().concat(loadMetaClasses_()));
  const now = new Date().toISOString();
  const rowsToPersist = [];

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

    rowsToPersist.push({
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

  writeStudentMetaRows_(rowsToPersist);
}




function replaceBaseRowsForCall_(dateKey, turmaId, turmaNome, normalizedRows, extra) {
  Logger.log('INICIANDO SALVAMENTO');
  Logger.log('SPREADSHEET_ID: ' + SPREADSHEET_ID);

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet_(ss, BASE_SHEET_NAME, BASE_HEADERS, false);
  ensureBaseHeaders_(sheet, BASE_HEADERS);

  const turmaNomeFinal = String(turmaNome || getTurmaNameById_(turmaId) || '').trim();
  const beforeRows = Math.max(0, sheet.getLastRow() - 1);

  if (!normalizedRows || !normalizedRows.length) {
    throw new Error('Não há linhas para salvar.');
  }

  const values = sheet.getDataRange().getValues();
  const rowsToDelete = [];

  if (values.length > 1) {
    const headers = values[0].map(normalizeHeader_);
    const idx = indexByHeader_(headers);

    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const rowDateKey = normalizeDateFromBaseCell_(row[idx.DATA]);
      const rowTurma = String(row[idx.CLASSE] || '').trim();

      if (rowDateKey === dateKey && normalizeKey_(rowTurma) === normalizeKey_(turmaNomeFinal)) {
        rowsToDelete.push(i + 1);
      }
    }
  }

  deleteRowsByNumberDesc_(sheet, rowsToDelete);

  const [year, month] = String(dateKey).split('-');
  const dataBr = formatDateBR_(dateKey);
  const mesTxt = monthToAbbrev_(month);

  const rowsToAppend = normalizedRows.map((r) => ([
    dataBr,
    Number(year),
    mesTxt,
    r.nome,
    turmaNomeFinal,
    r.presenca === 'sim' ? 1 : 0,
    r.atraso ? 1 : 0,
    r.presenca === 'nao' ? 1 : 0,
    Number(extra?.oferta || 0),
    Number(extra?.visitantes || 0),
    Number(extra?.biblias || 0),
    Number(extra?.revistas || 0),
  ]));

  Logger.log('LINHAS PARA INSERIR:');
  Logger.log(JSON.stringify(rowsToAppend, null, 2));

  const startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, rowsToAppend.length, rowsToAppend[0].length).setValues(rowsToAppend);
  SpreadsheetApp.flush();

  invalidateRuntimeCache_();

  const afterRows = Math.max(0, sheet.getLastRow() - 1);

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


function getBaseRowsAll_(forceReload) {
  if (!forceReload && __BACKEND_RUNTIME_CACHE__.baseRowsAll) return __BACKEND_RUNTIME_CACHE__.baseRowsAll;

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(BASE_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) {
    __BACKEND_RUNTIME_CACHE__.baseRowsAll = [];
    return [];
  }

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
      oferta: row[idx.OFERTA] ?? '',
      visitantes: Number(row[idx.Visitantes] ?? row[idx.VISITANTES] ?? 0) || 0,
      biblias: Number(row[idx.Biblias] ?? row[idx.BIBLIAS] ?? 0) || 0,
      revistas: Number(row[idx.Revistas] ?? row[idx.REVISTAS] ?? 0) || 0,
      alunoId: buildStudentId_(aluno, turmaId, ''),
    });
  }

  __BACKEND_RUNTIME_CACHE__.baseRowsAll = result;
  return result;
}




function getBaseRowsForDate_(dateKey) {
  const key = String(dateKey || '');
  if (!__BACKEND_RUNTIME_CACHE__.baseRowsByDate[key]) {
    __BACKEND_RUNTIME_CACHE__.baseRowsByDate[key] = getBaseRowsAll_().filter(row => row.dateKey === dateKey);
  }
  return __BACKEND_RUNTIME_CACHE__.baseRowsByDate[key];
}




function getFirstNonEmpty_() {
  for (const value of arguments) {
    if (value === null || value === undefined) continue;
    const str = String(value).trim();
    if (str !== '') return value;
  }
  return '';
}

function parseCallMetaText_(text) {
  try {
    const obj = JSON.parse(String(text || '{}'));
    return obj && typeof obj === 'object' ? obj : null;
  } catch (err) {
    return null;
  }
}

function buildCallMetaFromBaseRows_(dateKey, turmaId) {
  const rows = getBaseRowsForDate_(dateKey)
    .filter(r => String(r.turmaId || '') === String(turmaId || ''));

  Logger.log('FALLBACK VIA BASE');
  Logger.log('ROWS BASE ENCONTRADAS:');
  Logger.log(JSON.stringify(rows, null, 2));

  if (!rows.length) return null;

  const oferta = getFirstNonEmpty_(
    ...rows.map(r => r.oferta)
  );

  const visitantes = (() => {
    for (const r of rows) {
      const n = Number(r.visitantes || 0) || 0;
      if (n > 0) return n;
    }
    return 0;
  })();

  const biblias = (() => {
    for (const r of rows) {
      const n = Number(r.biblias || 0) || 0;
      if (n > 0) return n;
    }
    return 0;
  })();

  const revistas = (() => {
    for (const r of rows) {
      const n = Number(r.revistas || 0) || 0;
      if (n > 0) return n;
    }
    return 0;
  })();

  Logger.log('META VIA BASE:');
  Logger.log(JSON.stringify({ oferta, visitantes, biblias, revistas }, null, 2));

  return {
    ChamadaID: `CALL_${turmaId}_${dateKey}`,
    Data: formatDateBR_(dateKey),
    TurmaID: turmaId,
    Oferta: String(oferta || '').trim(),
    Visitantes: Number(visitantes || 0) || 0,
    Biblias: Number(biblias || 0) || 0,
    Revistas: Number(revistas || 0) || 0,
    EnviadoTelegram: 'nao',
    TelegramEnviadoEm: '',
  };
}

function findCallMeta_(turmaId, dateKey) {
  const reportId = `CALL_${turmaId}_${dateKey}`;
  const log = getReportLogById_(reportId);

  if (log) {
    const parsed = parseCallMetaText_(log.Texto);

    Logger.log('META VIA __RELATORIOS (RAW):');
    Logger.log(JSON.stringify(log, null, 2));

    if (parsed) {
      Logger.log('META VIA __RELATORIOS (PARSED):');
      Logger.log(JSON.stringify(parsed, null, 2));

      const parsedOferta = getFirstNonEmpty_(parsed.oferta, parsed.Oferta, log.Oferta, log.OFERTA);
      const parsedVisitantes = getFirstNonEmpty_(parsed.visitantes, parsed.Visitantes, log.Visitantes, log.VISITANTES);
      const parsedBiblias = getFirstNonEmpty_(parsed.biblias, parsed.Biblias, log.Biblias, log.BIBLIAS);
      const parsedRevistas = getFirstNonEmpty_(parsed.revistas, parsed.Revistas, log.Revistas, log.REVISTAS);
      //const parsedVisitantesTexto = getFirstNonEmpty_(parsed.visitantesTexto, parsed.VisitantesTexto, log.VisitantesTexto, log.VISITANTESTEXTO);

      return {
        ChamadaID: reportId,
        Data: formatDateBR_(dateKey),
        TurmaID: turmaId,
        Oferta: parsedOferta ?? '',
        Visitantes: Number(parsedVisitantes ?? 0) || 0,
        Biblias: Number(parsedBiblias ?? 0) || 0,
        Revistas: Number(parsedRevistas ?? 0) || 0,
        EnviadoTelegram: String(getFirstNonEmpty_(log.Enviado, parsed.enviadoTelegram, parsed.EnviadoTelegram) || 'nao'),
        TelegramEnviadoEm: String(getFirstNonEmpty_(log.EnviadoEm, parsed.telegramEnviadoEm, parsed.TelegramEnviadoEm) || ''),
      };
    }

    const directFallback = {
      ChamadaID: reportId,
      Data: formatDateBR_(dateKey),
      TurmaID: turmaId,
      Oferta: getFirstNonEmpty_(log.Oferta, log.oferta, log.OFERTA) ?? '',
      Visitantes: Number(getFirstNonEmpty_(log.Visitantes, log.visitantes, log.VISITANTES) ?? 0) || 0,
      Biblias: Number(getFirstNonEmpty_(log.Biblias, log.biblias, log.BIBLIAS) ?? 0) || 0,
      Revistas: Number(getFirstNonEmpty_(log.Revistas, log.revistas, log.REVISTAS) ?? 0) || 0,
      EnviadoTelegram: String(getFirstNonEmpty_(log.Enviado, 'nao') || 'nao'),
      TelegramEnviadoEm: String(getFirstNonEmpty_(log.EnviadoEm, '') || ''),
    };

    Logger.log('META VIA __RELATORIOS (DIRECT FALLBACK):');
    Logger.log(JSON.stringify(directFallback, null, 2));

    return directFallback;
  }

  return buildCallMetaFromBaseRows_(dateKey, turmaId);
}


function getCallMetaForTurmaAndDate_(turmaId, dateKey, cache) {
  const key = `${turmaId}_${dateKey}`;
  if (cache && Object.prototype.hasOwnProperty.call(cache, key)) {
    return cache[key];
  }

  const value = findCallMeta_(turmaId, dateKey);
  if (cache) cache[key] = value;
  return value;
}




function upsertCallMeta_(chamadaId, dateKey, turmaId, oferta, visitantes, visitantesTexto, totalAlunos, presentes, ausentes, percentual, enviadoTelegram) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet_(ss, REPORTS_SHEET, REPORTS_HEADERS, true);
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

  invalidateRuntimeCache_();
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
      invalidateRuntimeCache_();
      return;
    }
  }
}




function getReportLogById_(reportId) {
  if (!__BACKEND_RUNTIME_CACHE__.reportLogsById) {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(REPORTS_SHEET);
    const map = {};

    if (sheet && sheet.getLastRow() >= 2) {
      const values = sheet.getDataRange().getValues();
      const headers = values[0].map(String);
      const idx = indexByHeader_(headers);

      for (let i = 1; i < values.length; i++) {
        const obj = {};
        headers.forEach((h, j) => obj[h] = values[i][j]);
        const id = String(values[i][idx.RelatorioID] || '');
        if (id) map[id] = obj;
      }
    }

    __BACKEND_RUNTIME_CACHE__.reportLogsById = map;
  }

  return __BACKEND_RUNTIME_CACHE__.reportLogsById[String(reportId || '')] || null;
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
    invalidateRuntimeCache_();
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
      invalidateRuntimeCache_();
      return;
    }
  }
  sheet.appendRow([turmaId, patch.Nome || '', patch.Ordem || 0, patch.Ativa || 'sim', patch.CriadoEm || now, patch.AtualizadoEm || now]);
  invalidateRuntimeCache_();
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

  invalidateRuntimeCache_();
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

  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return 0;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? value
      : 0;
  }

  let str = String(value).trim();

  // formato BR
  if (str.includes(',')) {

    str = str.replace(/\./g, '');
    str = str.replace(',', '.');
  }

  const num = Number(str);

  return Number.isFinite(num)
    ? num
    : 0;
}



function formatReportValue_(value) {
  if (value === null || value === undefined) return 'null';

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || trimmed.toLowerCase() === 'null') return 'null';
    return trimmed;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 'null';
    return Number.isInteger(value)
      ? String(value)
      : String(round1_(value)).replace('.', ',');
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric) && String(value).trim() !== '') {
    return Number.isInteger(numeric)
      ? String(numeric)
      : String(round1_(numeric)).replace('.', ',');
  }

  const fallback = String(value).trim();
  return fallback ? fallback : 'null';
}

function getPresenceStatusLabel_(row) {
  if (String(row?.statusAluno || '').trim().toLowerCase() === 'inativo') {
    return 'INATIVO';
  }

  if (isPresenceLikeRow_(row)) {
    return 'PRESENTE';
  }

  return 'Falta';
}

function buildReportMetricLines_(dados) {
  return [
    `- *MATRICULADOS*: ${formatReportValue_(dados.matriculados)}`,
    `- *AUSENTES*: ${formatReportValue_(dados.ausentes)}`,
    `- *PRESENTES*: ${formatReportValue_(dados.presentes)}`,
    `- *VISITANTES*: ${formatReportValue_(dados.visitantes)}`,
    `- *TOTAL DE ASSISTÊNCIA*: ${formatReportValue_(dados.totalAssistencia)}`,
    `- *BÍBLIAS*: ${formatReportValue_(dados.biblias)}`,
    `- *REVISTAS*: ${formatReportValue_(dados.revistas)}`,
    `- *OFERTAS*: ${formatReportValue_(dados.ofertas)}`,
  ];
}

function getMostAbsentLabel_(topStats) {
  if (!topStats || !topStats.mostAbsent) return 'null';
  const faltas = Number(topStats.mostAbsent.TotalFaltas || 0);
  return `${topStats.mostAbsent.Nome} (${formatReportValue_(faltas)})`;
}

function getMostAbsentStudentOverall_(all) {
  const alunos = (all.alunos || []).slice();
  if (!alunos.length) return null;
  return alunos.sort((a, b) => Number(b.TotalFaltas || 0) - Number(a.TotalFaltas || 0))[0] || null;
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

function chunkTextForTelegram_(text, maxLen) {
  const limit = Math.max(1, Number(maxLen || 3800));
  const source = String(text || '');
  if (source.length <= limit) return [source];

  const lines = source.split('\n');
  const chunks = [];
  let current = '';

  const pushCurrent = () => {
    if (current) chunks.push(current);
    current = '';
  };

  lines.forEach(line => {
    const candidate = current ? `${current}\n${line}` : line;
    if (candidate.length <= limit) {
      current = candidate;
      return;
    }

    pushCurrent();

    if (line.length <= limit) {
      current = line;
      return;
    }

    for (let i = 0; i < line.length; i += limit) {
      const slice = line.slice(i, i + limit);
      if (slice.length === limit) {
        chunks.push(slice);
      } else {
        current = slice;
      }
    }
  });

  pushCurrent();
  return chunks.filter(Boolean);
}

function sendTelegram_(text) {
  if (
    !TELEGRAM_BOT_TOKEN ||
    !TELEGRAM_CHAT_ID ||
    String(TELEGRAM_BOT_TOKEN).includes('COLE_SEU_TOKEN_AQUI') ||
    String(TELEGRAM_CHAT_ID).includes('COLE_SEU_CHAT_ID_AQUI')
  ) {
    return { ok: false, skipped: true, sentCount: 0, message: 'Telegram não configurado.' };
  }

  const chunks = chunkTextForTelegram_(String(text || ''), 3800);
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  let lastResponse = null;

  chunks.forEach((chunk, index) => {
    const payload = {
      chat_id: TELEGRAM_CHAT_ID,
      text: chunk,
      disable_web_page_preview: true,
    };

    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    const code = response.getResponseCode();
    const body = response.getContentText();
    if (code < 200 || code >= 300) {
      throw new Error(`Falha ao enviar ao Telegram (parte ${index + 1}/${chunks.length}, HTTP ${code}): ${body}`);
    }

    lastResponse = { code, body };
  });

  return { ok: true, sent: true, sentCount: chunks.length, lastResponse };
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// debugRoundTripChamada_();
function debugRoundTripChamada_() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error('Não foi possível obter lock para o teste.');
  }

  try {
    ensureSheets_();

    const dateKey = todayKey_();
    const all = loadAllData_();

    const turma =
      getTurmaByIdOrName_('T_cordei_de_cristo', all.turmas) ||
      all.turmas[0] ||
      null;

    if (!turma) {
      throw new Error('Nenhuma turma encontrada para o teste.');
    }

    const roster = getRosterForTurma_(turma.TurmaID, all);
    if (!roster.length) {
      throw new Error(`A turma ${turma.Nome} não tem alunos para testar.`);
    }

    const sampleRows = roster.slice(0, Math.min(4, roster.length)).map((aluno, index) => ({
      alunoId: aluno.AlunoID,
      nome: aluno.Nome,
      presenca: index === 0 ? 'sim' : (index === 1 ? 'atrasado' : 'nao'),
      atraso: index === 1,
      observacao: `teste_${new Date().toISOString()}`,
      statusAluno: String(aluno.Status || 'ativo'),
    }));

    const chamadaId = `CALL_${turma.TurmaID}_${dateKey}`;
    const oferta = 'R$ 4,00';
    const visitantes = 4;
    const visitantesTexto = '4 visitantes';

    Logger.log('========== TESTE ROUND-TRIP ==========');
    Logger.log('TURMA: ' + JSON.stringify({
      turmaId: turma.TurmaID,
      turmaNome: turma.Nome,
      dateKey,
      chamadaId,
    }, null, 2));

    Logger.log('PAYLOAD DE TESTE: ' + JSON.stringify({
      action: 'saveCall',
      date: dateKey,
      turmaId: turma.TurmaID,
      chamadaId,
      oferta,
      visitantes,
      visitantesTexto,
      rowsJson: sampleRows,
    }, null, 2));

    const saveResult = saveCall_({
      date: dateKey,
      turmaId: turma.TurmaID,
      chamadaId,
      oferta,
      visitantes: String(visitantes),
      visitantesTexto,
      rowsJson: JSON.stringify(sampleRows),
      sendTelegram: 'nao',
      autoSend: 'nao',
    });

    SpreadsheetApp.flush();

    const reportId = `CALL_${turma.TurmaID}_${dateKey}`;
    const rawLog = getReportLogById_(reportId);
    const parsedMeta = findCallMeta_(turma.TurmaID, dateKey);
    const initResult = init_({ date: dateKey });
    const frontendCall = initResult?.callsByTurma?.[turma.TurmaID] || null;

    Logger.log('========== SAVE RESULT ==========');
    Logger.log(JSON.stringify(saveResult, null, 2));

    Logger.log('========== REPORT LOG RAW ==========');
    Logger.log(JSON.stringify(rawLog, null, 2));

    Logger.log('========== PARSED META ==========');
    Logger.log(JSON.stringify(parsedMeta, null, 2));

    Logger.log('========== FRONTEND JSON ==========');
    Logger.log(JSON.stringify(frontendCall, null, 2));

    Logger.log('========== INIT INTEIRO ==========');
    Logger.log(JSON.stringify({
      dateKey: initResult.dateKey,
      baseRowsCount: initResult.baseRowsCount,
      call: frontendCall,
    }, null, 2));

    return {
      ok: true,
      dateKey,
      turmaId: turma.TurmaID,
      chamadaId,
      saveResult,
      rawLog,
      parsedMeta,
      frontendCall,
    };
  } finally {
    lock.releaseLock();
  }
}

// debugLerChamadaSalva_('2026-05-14', 'T_cordei_de_cristo');
function debugLerChamadaSalva_(dateKey, turmaId) {
  ensureSheets_();

  const all = loadAllData_();
  const turma = getTurmaByIdOrName_(turmaId, all.turmas);

  if (!turma) {
    throw new Error('Turma não encontrada.');
  }

  const reportId = `CALL_${turma.TurmaID}_${dateKey}`;
  const rawLog = getReportLogById_(reportId);
  const parsedMeta = findCallMeta_(turma.TurmaID, dateKey);
  const initResult = init_({ date: dateKey });
  const frontendCall = initResult?.callsByTurma?.[turma.TurmaID] || null;

  Logger.log('========== LEITURA SALVA ==========');
  Logger.log(JSON.stringify({
    reportId,
    rawLog,
    parsedMeta,
    frontendCall,
  }, null, 2));

  return {
    ok: true,
    reportId,
    rawLog,
    parsedMeta,
    frontendCall,
  };
}


























