/**
 * Google Apps Script backend
 * Sistema de presença por turmas + histórico + Telegram
 *
 * Planilhas criadas/uso:
 * - turmas
 * - alunos
 * - chamadas
 * - presencas
 * - relatorios
 */

const SPREADSHEET_ID = '2077320455';
const TELEGRAM_BOT_TOKEN = '8675551330:AAH5G9TcjqoI-rjvCr-QBAlQ4Wsxkolu9hY';
const TELEGRAM_CHAT_ID = '-5138652770';

const SHEETS = {
  TURMAS: 'turmas',
  ALUNOS: 'alunos',
  CHAMADAS: 'chamadas',
  PRESENCAS: 'presencas',
  RELATORIOS: 'relatorios',
};

const HEADERS = {
  TURMAS: ['TurmaID', 'Nome', 'Ordem', 'Ativa', 'CriadoEm'],
  ALUNOS: [
    'AlunoID', 'Nome', 'CPF', 'TurmaID', 'Ativo',
    'FaltasConsecutivas', 'TotalPresencas', 'TotalFaltas',
    'Percentual', 'Status', 'UltimaPresenca', 'UltimaAusencia',
    'RealocadoDe', 'CriadoEm', 'AtualizadoEm'
  ],
  CHAMADAS: [
    'ChamadaID', 'Data', 'TurmaID', 'Oferta', 'Visitantes',
    'VisitantesTexto', 'TotalAlunos', 'Presentes', 'Ausentes', 'Percentual',
    'EnviadoTelegram', 'TelegramEnviadoEm', 'CriadoEm', 'AtualizadoEm'
  ],
  PRESENCAS: [
    'ChamadaID', 'Data', 'TurmaID', 'AlunoID', 'Nome',
    'Presenca', 'Observacao', 'StatusAluno', 'CriadoEm'
  ],
  RELATORIOS: [
    'RelatorioID', 'Tipo', 'Data', 'TurmaID', 'Hash',
    'Enviado', 'EnviadoEm', 'Texto', 'CriadoEm'
  ],
};

function doGet(e) {
  const action = String(e?.parameter?.action || 'init').toLowerCase();

  try {
    if (action === 'init') {
      return json_(init_(e?.parameter || {}));
    }

    if (action === 'health') {
      return json_({ ok: true, message: 'ok' });
    }

    return json_({ ok: false, message: 'Ação inválida.' });
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
    timestamps: {
      now: new Date().toISOString(),
    },
  };
}

function saveCall_(p) {
  ensureSheets_();

  const dateKey = normalizeDateKey_(p.date || todayKey_());
  const turmaId = String(p.turmaId || '').trim();
  const oferta = String(p.oferta || '').trim();
  const visitantes = Number(p.visitantes || 0) || 0;
  const visitantesTexto = String(p.visitantesTexto || '').trim();
  const chamadaId = String(p.chamadaId || `${turmaId}_${dateKey}`).trim();
  const rowsJson = String(p.rowsJson || '[]');

  if (!turmaId) throw new Error('Turma inválida.');
  const turma = getTurmaById_(turmaId);
  if (!turma) throw new Error('Turma não encontrada.');

  let rows;
  try {
    rows = JSON.parse(rowsJson);
  } catch (err) {
    throw new Error('rowsJson inválido.');
  }
  if (!Array.isArray(rows)) throw new Error('Lista de presenças inválida.');

  const allBefore = loadAllData_();
  const alunosDaTurma = allBefore.alunos.filter(a => String(a.TurmaID || '') === turmaId);

  // Garante que todos os alunos da turma tenham registro no payload.
  const byAlunoId = {};
  rows.forEach(item => {
    const alunoId = String(item.alunoId || '').trim();
    if (alunoId) byAlunoId[alunoId] = item;
  });

  const normalizedRows = alunosDaTurma.map(aluno => {
    const payload = byAlunoId[aluno.AlunoID] || {};
    const presenca = normalizePresence_(payload.presenca);
    return {
      alunoId: aluno.AlunoID,
      nome: aluno.Nome,
      presenca,
      observacao: String(payload.observacao || '').trim(),
      statusAluno: String(aluno.Status || 'ativo').trim(),
    };
  });

  const presentes = normalizedRows.filter(r => r.presenca === 'sim').length;
  const ausentes = normalizedRows.length - presentes;
  const percentual = normalizedRows.length ? round1_((presentes / normalizedRows.length) * 100) : 0;

  upsertCallRow_({
    chamadaId,
    dateKey,
    turmaId,
    oferta,
    visitantes,
    visitantesTexto,
    totalAlunos: normalizedRows.length,
    presentes,
    ausentes,
    percentual,
    enviadoTelegram: false,
  });

  replaceAttendanceRows_(chamadaId, dateKey, turmaId, normalizedRows);
  recalculateAndPersistStudentStats_();

  const allAfter = loadAllData_();
  const callsByTurma = buildCallsByTurmaForDate_(dateKey, allAfter);
  const geral = buildDailyGeneralSummary_(dateKey, allAfter, callsByTurma);
  const turmaCall = callsByTurma[turmaId];

  return {
    ok: true,
    message: 'Chamada salva com sucesso.',
    chamadaId,
    turmaId,
    dateKey,
    turmaCall,
    resumoGeral: geral,
  };
}

function sendReport_(p) {
  ensureSheets_();

  const dateKey = normalizeDateKey_(p.date || todayKey_());
  const turmaId = String(p.turmaId || '').trim();
  const scope = String(p.scope || 'turma').toLowerCase();

  const all = loadAllData_();
  const callsByTurma = buildCallsByTurmaForDate_(dateKey, all);
  const geral = buildDailyGeneralSummary_(dateKey, all, callsByTurma);

  if (scope === 'geral') {
    const text = buildGeneralReportText_(dateKey, geral, callsByTurma, all);
    const reportId = `GERAL_${dateKey}`;
    const hash = textHash_(text);
    const existing = getReportLogById_(reportId);

    if (existing && String(existing.Enviado || '').toLowerCase() === 'sim' && String(existing.Hash || '') === hash) {
      return {
        ok: true,
        sent: false,
        alreadySent: true,
        message: 'Relatório geral já havia sido enviado.',
        text,
      };
    }

    sendTelegram_(text);
    upsertReportLog_({
      reportId,
      tipo: 'geral',
      dateKey,
      turmaId: '',
      hash,
      enviado: 'sim',
      texto: text,
    });

    return {
      ok: true,
      sent: true,
      message: 'Relatório geral enviado ao Telegram.',
      text,
    };
  }

  if (!turmaId) throw new Error('Turma inválida.');
  const turma = getTurmaById_(turmaId);
  if (!turma) throw new Error('Turma não encontrada.');

  const turmaCall = callsByTurma[turmaId];
  if (!turmaCall) throw new Error('Não existe chamada salva para esta turma nesta data.');

  const text = buildTurmaReportText_(dateKey, turma, turmaCall, all);
  const reportId = `TURMA_${turmaId}_${dateKey}`;
  const hash = textHash_(text);
  const existing = getReportLogById_(reportId);

  if (existing && String(existing.Enviado || '').toLowerCase() === 'sim' && String(existing.Hash || '') === hash) {
    return {
      ok: true,
      sent: false,
      alreadySent: true,
      message: 'Relatório da turma já havia sido enviado.',
      text,
    };
  }

  sendTelegram_(text);
  markCallAsSent_(turmaCall.chamadaId, text);
  upsertReportLog_({
    reportId,
    tipo: 'turma',
    dateKey,
    turmaId,
    hash,
    enviado: 'sim',
    texto: text,
  });

  return {
    ok: true,
    sent: true,
    message: 'Relatório da turma enviado ao Telegram.',
    text,
  };
}

function addTurma_(p) {
  ensureSheets_();
  const nome = String(p.nome || '').trim();
  const ordem = Number(p.ordem || 0) || 0;
  if (!nome) throw new Error('Informe o nome da turma.');

  const planilha = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet_(planilha, SHEETS.TURMAS, HEADERS.TURMAS);
  const turmaId = buildId_('T');
  sheet.appendRow([turmaId, nome, ordem, 'sim', new Date().toISOString()]);

  return { ok: true, message: 'Turma cadastrada com sucesso.', turmaId };
}

function addAluno_(p) {
  ensureSheets_();
  const nome = String(p.nome || '').trim();
  const cpf = normalizeCpf_(p.cpf || '');
  const turmaId = String(p.turmaId || '').trim();
  if (!nome) throw new Error('Informe o nome do aluno.');
  if (!turmaId) throw new Error('Informe a turma.');

  if (!getTurmaById_(turmaId)) throw new Error('Turma não encontrada.');

  const planilha = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet_(planilha, SHEETS.ALUNOS, HEADERS.ALUNOS);
  const alunoId = buildId_('A');
  const now = new Date().toISOString();

  sheet.appendRow([
    alunoId, nome, cpf, turmaId, 'sim',
    0, 0, 0, 0, 'ativo',
    '', '', '', now, now
  ]);

  return { ok: true, message: 'Aluno cadastrado com sucesso.', alunoId };
}

function moveAluno_(p) {
  ensureSheets_();
  const alunoId = String(p.alunoId || '').trim();
  const turmaId = String(p.turmaId || '').trim();
  if (!alunoId) throw new Error('Aluno inválido.');
  if (!turmaId) throw new Error('Turma destino inválida.');
  if (!getTurmaById_(turmaId)) throw new Error('Turma destino não encontrada.');

  const planilha = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet_(planilha, SHEETS.ALUNOS, HEADERS.ALUNOS);
  const values = sheet.getDataRange().getValues();
  const header = values[0].map(String);
  const idxByName = {};
  header.forEach((name, idx) => idxByName[name] = idx);

  let found = false;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idxByName.AlunoID] || '') === alunoId) {
      values[i][idxByName.RealocadoDe] = String(values[i][idxByName.TurmaID] || '');
      values[i][idxByName.TurmaID] = turmaId;
      values[i][idxByName.AtualizadoEm] = new Date().toISOString();
      found = true;
      break;
    }
  }
  if (!found) throw new Error('Aluno não encontrado.');

  sheet.getRange(2, 1, values.length - 1, header.length).setValues(values.slice(1));
  return { ok: true, message: 'Aluno realocado com sucesso.' };
}

function toggleAluno_(p) {
  ensureSheets_();
  const alunoId = String(p.alunoId || '').trim();
  const ativo = normalizeBool_(p.ativo);
  if (!alunoId) throw new Error('Aluno inválido.');

  const planilha = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet_(planilha, SHEETS.ALUNOS, HEADERS.ALUNOS);
  const values = sheet.getDataRange().getValues();
  const header = values[0].map(String);
  const idxId = header.indexOf('AlunoID');
  const idxAtivo = header.indexOf('Ativo');
  const idxStatus = header.indexOf('Status');
  const idxAtualizadoEm = header.indexOf('AtualizadoEm');

  let found = false;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idxId]) === alunoId) {
      values[i][idxAtivo] = ativo ? 'sim' : 'nao';
      values[i][idxStatus] = ativo ? 'ativo' : 'inativo';
      values[i][idxAtualizadoEm] = new Date().toISOString();
      found = true;
      break;
    }
  }
  if (!found) throw new Error('Aluno não encontrado.');

  sheet.getRange(2, 1, values.length - 1, header.length).setValues(values.slice(1));
  return { ok: true, message: 'Status do aluno atualizado.' };
}

function loadAllData_() {
  const planilha = SpreadsheetApp.openById(SPREADSHEET_ID);

  const turmasSheet = getOrCreateSheet_(planilha, SHEETS.TURMAS, HEADERS.TURMAS);
  const alunosSheet = getOrCreateSheet_(planilha, SHEETS.ALUNOS, HEADERS.ALUNOS);
  const chamadasSheet = getOrCreateSheet_(planilha, SHEETS.CHAMADAS, HEADERS.CHAMADAS);
  const presencasSheet = getOrCreateSheet_(planilha, SHEETS.PRESENCAS, HEADERS.PRESENCAS);
  const relatoriosSheet = getOrCreateSheet_(planilha, SHEETS.RELATORIOS, HEADERS.RELATORIOS);

  const turmas = sheetToObjects_(turmasSheet);
  const alunos = sheetToObjects_(alunosSheet);
  const chamadas = sheetToObjects_(chamadasSheet);
  const presencas = sheetToObjects_(presencasSheet);
  const relatorios = sheetToObjects_(relatoriosSheet);

  const stats = computeStudentStats_(alunos, presencas, chamadas);

  return {
    turmas,
    alunos: stats.alunos,
    chamadas,
    presencas,
    relatorios,
    stats,
  };
}

function buildCallsByTurmaForDate_(dateKey, all) {
  const turmas = sortTurmas_(all.turmas);
  const alunos = all.alunos;
  const chamadasDoDia = all.chamadas.filter(c => normalizeDateKey_(c.Data) === dateKey);

  const presencasByCall = groupBy_(all.presencas, 'ChamadaID');
  const callsByTurma = {};

  turmas.forEach((turma, index) => {
    const turmaAlunos = alunos.filter(a => String(a.TurmaID || '') === String(turma.TurmaID || ''));
    const call = chamadasDoDia.find(c => String(c.TurmaID || '') === String(turma.TurmaID || ''));

    if (call) {
      const rows = (presencasByCall[call.ChamadaID] || []).map(row => ({
        alunoId: String(row.AlunoID || ''),
        nome: String(row.Nome || ''),
        presenca: normalizePresence_(row.Presenca),
        observacao: String(row.Observacao || ''),
        statusAluno: String(row.StatusAluno || ''),
      }));

      callsByTurma[turma.TurmaID] = {
        chamadaId: call.ChamadaID,
        data: normalizeDateKey_(call.Data),
        turmaId: String(call.TurmaID || ''),
        turmaNome: turma.Nome,
        oferta: String(call.Oferta || ''),
        visitantes: Number(call.Visitantes || 0) || 0,
        visitantesTexto: String(call.VisitantesTexto || ''),
        totalAlunos: Number(call.TotalAlunos || 0) || turmaAlunos.length,
        presentes: Number(call.Presentes || 0) || rows.filter(r => r.presenca === 'sim').length,
        ausentes: Number(call.Ausentes || 0) || (turmaAlunos.length - rows.filter(r => r.presenca === 'sim').length),
        percentual: Number(call.Percentual || 0) || 0,
        enviadoTelegram: String(call.EnviadoTelegram || '').toLowerCase() === 'sim',
        telegramEnviadoEm: String(call.TelegramEnviadoEm || ''),
        rows: fillRowsFromRoster_(turmaAlunos, rows),
        isSaved: true,
      };
    } else {
      callsByTurma[turma.TurmaID] = {
        chamadaId: `${turma.TurmaID}_${dateKey}`,
        data: dateKey,
        turmaId: String(turma.TurmaID || ''),
        turmaNome: turma.Nome,
        oferta: '',
        visitantes: 0,
        visitantesTexto: '',
        totalAlunos: turmaAlunos.length,
        presentes: 0,
        ausentes: turmaAlunos.length,
        percentual: 0,
        enviadoTelegram: false,
        telegramEnviadoEm: '',
        rows: fillRowsFromRoster_(turmaAlunos, []),
        isSaved: false,
      };
    }
  });

  return callsByTurma;
}

function buildDailyGeneralSummary_(dateKey, all, callsByTurma) {
  const turmas = sortTurmas_(all.turmas);
  const turmaSummaries = turmas.map(t => {
    const call = callsByTurma[t.TurmaID];
    return {
      turmaId: t.TurmaID,
      nome: t.Nome,
      totalAlunos: call?.totalAlunos || 0,
      presentes: call?.presentes || 0,
      ausentes: call?.ausentes || 0,
      percentual: call?.percentual || 0,
      oferta: call?.oferta || '',
      visitantes: call?.visitantes || 0,
      isSaved: !!call?.isSaved,
    };
  });

  const totalAlunos = turmaSummaries.reduce((acc, item) => acc + (item.totalAlunos || 0), 0);
  const presentes = turmaSummaries.reduce((acc, item) => acc + (item.presentes || 0), 0);
  const ausentes = turmaSummaries.reduce((acc, item) => acc + (item.ausentes || 0), 0);
  const percentual = totalAlunos ? round1_((presentes / totalAlunos) * 100) : 0;
  const turmasSalvas = turmaSummaries.filter(t => t.isSaved).length;
  const ofertaTotal = turmaSummaries.reduce((acc, item) => acc + parseMoney_(item.oferta), 0);
  const visitantesTotal = turmaSummaries.reduce((acc, item) => acc + (Number(item.visitantes || 0) || 0), 0);

  const melhores = all.stats.melhores || [];
  const inativos = all.stats.inativos || [];
  const faltandoMuito = all.stats.faltandoMuito || [];
  const reativados = all.stats.reativados || [];

  return {
    dateKey,
    totalTurmas: turmas.length,
    turmasSalvas,
    totalAlunos,
    presentes,
    ausentes,
    percentual,
    ofertaTotal,
    visitantesTotal,
    turmaSummaries,
    melhores,
    inativos,
    faltandoMuito,
    reativados,
  };
}

function buildTurmaReportText_(dateKey, turma, turmaCall, all) {
  const linhasPresentes = turmaCall.rows.filter(r => r.presenca === 'sim');
  const linhasAusentes = turmaCall.rows.filter(r => r.presenca !== 'sim');
  const melhor = getBestStudentForTurma_(turma.TurmaID, all);
  const inativos = turmaCall.rows.filter(r => {
    const aluno = findStudentById_(all.alunos, r.alunoId);
    return String(aluno?.Status || '') === 'inativo';
  });

  return [
    `📋 RELATÓRIO DA TURMA`,
    `Turma: ${turma.Nome}`,
    `Data: ${formatDateBR_(dateKey)}`,
    ``,
    `Total de alunos: ${turmaCall.totalAlunos}`,
    `Presentes: ${turmaCall.presentes}`,
    `Ausentes: ${turmaCall.ausentes}`,
    `Presença: ${formatPercent_(turmaCall.percentual)}`,
    `Oferta da classe: ${turmaCall.oferta || '-'}`,
    `Visitantes: ${turmaCall.visitantes > 0 ? turmaCall.visitantes : 'não informado'}`,
    turmaCall.visitantesTexto ? `Detalhe visitantes: ${turmaCall.visitantesTexto}` : '',
    ``,
    `Melhor aluno: ${melhor ? `${melhor.Nome} (${formatPercent_(melhor.Percentual)})` : '—'}`,
    `Inativos: ${inativos.length ? inativos.map(r => r.nome).join(', ') : 'nenhum'}`,
    `Faltando muito: ${all.stats.faltandoMuito.filter(a => String(a.TurmaID || '') === String(turma.TurmaID || '')).map(a => a.Nome).join(', ') || 'nenhum'}`,
    ``,
    `Presentes: ${linhasPresentes.map(r => r.nome).join(', ') || 'nenhum'}`,
    `Ausentes: ${linhasAusentes.map(r => r.nome).join(', ') || 'nenhum'}`,
  ].filter(Boolean).join('\n');
}

function buildGeneralReportText_(dateKey, geral, callsByTurma, all) {
  const partes = [];
  partes.push('📊 RELATÓRIO GERAL');
  partes.push(`Data: ${formatDateBR_(dateKey)}`);
  partes.push('');
  partes.push(`Turmas salvas: ${geral.turmasSalvas}/${geral.totalTurmas}`);
  partes.push(`Total de alunos: ${geral.totalAlunos}`);
  partes.push(`Presentes: ${geral.presentes}`);
  partes.push(`Ausentes: ${geral.ausentes}`);
  partes.push(`Presença geral: ${formatPercent_(geral.percentual)}`);
  partes.push(`Oferta total: ${formatMoney_(geral.ofertaTotal)}`);
  partes.push(`Visitantes: ${geral.visitantesTotal}`);
  partes.push('');
  partes.push('Resumo por turma:');

  geral.turmaSummaries.forEach(item => {
    partes.push(`- ${item.nome}: ${item.presentes}/${item.totalAlunos} (${formatPercent_(item.percentual)}) | Oferta ${item.oferta || '-'} | Visitantes ${item.visitantes || 0}`);
  });

  partes.push('');
  partes.push(`Melhores alunos: ${geral.melhores.length ? geral.melhores.map(a => `${a.Nome} (${formatPercent_(a.Percentual)})`).join(', ') : '—'}`);
  partes.push(`Inativos: ${geral.inativos.length ? geral.inativos.map(a => a.Nome).join(', ') : 'nenhum'}`);
  partes.push(`Faltando muito: ${geral.faltandoMuito.length ? geral.faltandoMuito.map(a => a.Nome).join(', ') : 'nenhum'}`);
  partes.push(`Reativados: ${geral.reativados.length ? geral.reativados.map(a => a.Nome).join(', ') : 'nenhum'}`);

  return partes.join('\n');
}

function getBestStudentForTurma_(turmaId, all) {
  const candidates = all.stats.alunos
    .filter(a => String(a.TurmaID || '') === String(turmaId || ''))
    .filter(a => Number(a.Percentual || 0) > 0)
    .sort((a, b) => Number(b.Percentual || 0) - Number(a.Percentual || 0) || String(a.Nome).localeCompare(String(b.Nome)));
  return candidates[0] || null;
}

function computeStudentStats_(alunos, presencas, chamadas) {
  const callById = {};
  chamadas.forEach(c => {
    callById[String(c.ChamadaID || '')] = c;
  });

  const recordsByAluno = {};
  presencas.forEach(p => {
    const alunoId = String(p.AlunoID || '').trim();
    if (!alunoId) return;
    if (!recordsByAluno[alunoId]) recordsByAluno[alunoId] = [];
    recordsByAluno[alunoId].push({
      data: normalizeDateKey_(p.Data),
      callId: String(p.ChamadaID || ''),
      presenca: normalizePresence_(p.Presenca),
      turmaId: String(p.TurmaID || ''),
      nome: String(p.Nome || ''),
    });
  });

  const alunosComStats = alunos.map((a, index) => {
    const alunoId = String(a.AlunoID || '').trim();
    const registros = (recordsByAluno[alunoId] || []).slice().sort((x, y) => {
      const dx = String(x.data || '');
      const dy = String(y.data || '');
      if (dx === dy) return String(x.callId || '').localeCompare(String(y.callId || ''));
      return dx.localeCompare(dy);
    });

    let presentes = 0;
    let ausentes = 0;
    let runAusentes = 0;
    let reativado = false;

    registros.forEach(r => {
      if (r.presenca === 'sim') {
        presentes += 1;
        if (runAusentes >= 4) reativado = true;
        runAusentes = 0;
      } else {
        ausentes += 1;
        runAusentes += 1;
      }
    });

    const faltasConsecutivas = runAusentes;
    const total = presentes + ausentes;
    const percentual = total ? round1_((presentes / total) * 100) : 0;
    const status = faltasConsecutivas >= 4 ? 'inativo' : 'ativo';
    const faltandoMuito = faltasConsecutivas >= 2 || (total >= 4 && percentual < 70);
    const ultimaPresenca = registros.length ? [...registros].reverse().find(r => r.presenca === 'sim')?.data || '' : '';
    const ultimaAusencia = registros.length ? [...registros].reverse().find(r => r.presenca !== 'sim')?.data || '' : '';

    return {
      ...a,
      PresenteTotal: presentes,
      AusenteTotal: ausentes,
      FaltasConsecutivas: faltasConsecutivas,
      Percentual: percentual,
      Status: status,
      FaltandoMuito: faltandoMuito ? 'sim' : 'nao',
      Reativado: reativado ? 'sim' : 'nao',
      UltimaPresenca: ultimaPresenca,
      UltimaAusencia: ultimaAusencia,
      __sourceRow: index + 2,
    };
  });

  return {
    alunos: alunosComStats,
    melhores: alunosComStats
      .filter(a => String(a.Ativo || 'sim').toLowerCase() !== 'nao')
      .filter(a => Number(a.Percentual || 0) > 0)
      .sort((a, b) => Number(b.Percentual || 0) - Number(a.Percentual || 0) || String(a.Nome).localeCompare(String(b.Nome)))
      .slice(0, 10),
    inativos: alunosComStats.filter(a => String(a.Status || '') === 'inativo'),
    faltandoMuito: alunosComStats.filter(a => String(a.FaltandoMuito || '') === 'sim'),
    reativados: alunosComStats.filter(a => String(a.Reativado || '') === 'sim'),
  };
}

function recalculateAndPersistStudentStats_() {
  const all = loadAllData_();
  const planilha = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet_(planilha, SHEETS.ALUNOS, HEADERS.ALUNOS);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return;

  const header = values[0].map(String);
  const idxByName = {};
  header.forEach((name, idx) => idxByName[name] = idx);

  const map = {};
  all.stats.alunos.forEach(a => {
    map[String(a.AlunoID || '')] = a;
  });

  for (let i = 1; i < values.length; i++) {
    const alunoId = String(values[i][idxByName.AlunoID] || '');
    const s = map[alunoId];
    if (!s) continue;
    values[i][idxByName.FaltasConsecutivas] = s.FaltasConsecutivas;
    values[i][idxByName.TotalPresencas] = s.PresenteTotal;
    values[i][idxByName.TotalFaltas] = s.AusenteTotal;
    values[i][idxByName.Percentual] = s.Percentual;
    values[i][idxByName.Status] = s.Status;
    values[i][idxByName.UltimaPresenca] = s.UltimaPresenca;
    values[i][idxByName.UltimaAusencia] = s.UltimaAusencia;
    values[i][idxByName.Ativo] = s.Status === 'inativo' ? 'nao' : (String(values[i][idxByName.Ativo] || 'sim').toLowerCase() === 'nao' ? 'nao' : 'sim');
    values[i][idxByName.AtualizadoEm] = new Date().toISOString();
  }

  sheet.getRange(2, 1, values.length - 1, header.length).setValues(values.slice(1));
}

function upsertCallRow_(call) {
  const planilha = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet_(planilha, SHEETS.CHAMADAS, HEADERS.CHAMADAS);
  const values = sheet.getDataRange().getValues();
  const header = values[0].map(String);
  const idxByName = {};
  header.forEach((name, idx) => idxByName[name] = idx);

  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idxByName.ChamadaID] || '') === String(call.chamadaId || '')) {
      rowIndex = i + 1;
      break;
    }
  }

  const row = [
    call.chamadaId,
    call.dateKey,
    call.turmaId,
    call.oferta,
    call.visitantes,
    call.visitantesTexto || '',
    call.totalAlunos,
    call.presentes,
    call.ausentes,
    call.percentual,
    call.enviadoTelegram ? 'sim' : 'nao',
    call.enviadoTelegram ? new Date().toISOString() : '',
    rowIndex === -1 ? new Date().toISOString() : String(values[rowIndex - 1][idxByName.CriadoEm] || new Date().toISOString()),
    new Date().toISOString(),
  ];

  if (rowIndex === -1) {
    sheet.appendRow(row);
  } else {
    sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  }
}

function replaceAttendanceRows_(chamadaId, dateKey, turmaId, rows) {
  const planilha = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet_(planilha, SHEETS.PRESENCAS, HEADERS.PRESENCAS);

  const values = sheet.getDataRange().getValues();
  if (values.length > 1) {
    const header = values[0].map(String);
    const idxChamada = header.indexOf('ChamadaID');
    const keep = [values[0]];
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][idxChamada] || '') !== String(chamadaId || '')) {
        keep.push(values[i]);
      }
    }
    sheet.clearContents();
    sheet.getRange(1, 1, keep.length, keep[0].length).setValues(keep);
  }

  const now = new Date().toISOString();
  const payload = rows.map(r => ([
    chamadaId,
    dateKey,
    turmaId,
    r.alunoId,
    r.nome,
    r.presenca,
    r.observacao || '',
    r.statusAluno || '',
    now,
  ]));

  if (payload.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, payload.length, payload[0].length).setValues(payload);
  }
}

function markCallAsSent_(chamadaId, text) {
  const planilha = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet_(planilha, SHEETS.CHAMADAS, HEADERS.CHAMADAS);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return;

  const header = values[0].map(String);
  const idxByName = {};
  header.forEach((name, idx) => idxByName[name] = idx);

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idxByName.ChamadaID] || '') === String(chamadaId || '')) {
      values[i][idxByName.EnviadoTelegram] = 'sim';
      values[i][idxByName.TelegramEnviadoEm] = new Date().toISOString();
      values[i][idxByName.AtualizadoEm] = new Date().toISOString();
      break;
    }
  }
  sheet.getRange(2, 1, values.length - 1, header.length).setValues(values.slice(1));
}

function upsertReportLog_(log) {
  const planilha = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet_(planilha, SHEETS.RELATORIOS, HEADERS.RELATORIOS);
  const values = sheet.getDataRange().getValues();
  const header = values[0].map(String);
  const idxByName = {};
  header.forEach((name, idx) => idxByName[name] = idx);

  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idxByName.RelatorioID] || '') === String(log.reportId || '')) {
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
    new Date().toISOString(),
    log.text,
    new Date().toISOString(),
  ];

  if (rowIndex === -1) {
    sheet.appendRow(row);
  } else {
    sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  }
}

function getReportLogById_(reportId) {
  const planilha = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet_(planilha, SHEETS.RELATORIOS, HEADERS.RELATORIOS);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return null;
  const header = values[0].map(String);
  const idxByName = {};
  header.forEach((name, idx) => idxByName[name] = idx);

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idxByName.RelatorioID] || '') === String(reportId || '')) {
      const obj = {};
      header.forEach((name, idx) => obj[name] = values[i][idx]);
      return obj;
    }
  }
  return null;
}

function getTurmaById_(turmaId) {
  const planilha = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet_(planilha, SHEETS.TURMAS, HEADERS.TURMAS);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return null;
  const header = values[0].map(String);
  const idxByName = {};
  header.forEach((name, idx) => idxByName[name] = idx);

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idxByName.TurmaID] || '') === String(turmaId || '')) {
      const obj = {};
      header.forEach((name, idx) => obj[name] = values[i][idx]);
      return obj;
    }
  }
  return null;
}

function getOrCreateSheet_(planilha, nome, headers) {
  let sheet = planilha.getSheetByName(nome);
  if (!sheet) sheet = planilha.insertSheet(nome);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return sheet;
  }

  const first = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const empty = first.every(cell => String(cell || '').trim() === '');
  if (empty) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function ensureSheets_() {
  const planilha = SpreadsheetApp.openById(SPREADSHEET_ID);
  Object.keys(SHEETS).forEach(key => {
    getOrCreateSheet_(planilha, SHEETS[key], HEADERS[key]);
  });
}

function sheetToObjects_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  const headers = values[0].map(String);
  return values.slice(1).filter(row => row.some(v => String(v || '').trim() !== '')).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function fillRowsFromRoster_(roster, savedRows) {
  const map = {};
  savedRows.forEach(row => {
    map[String(row.alunoId || '')] = row;
  });

  return sortAlunos_(roster).map(aluno => {
    const saved = map[String(aluno.AlunoID || '')] || {};
    return {
      alunoId: aluno.AlunoID,
      nome: aluno.Nome,
      presenca: normalizePresence_(saved.presenca || 'nao'),
      observacao: String(saved.observacao || ''),
      statusAluno: String(aluno.Status || 'ativo'),
    };
  });
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
    const turmaCmp = String(a.TurmaID || '').localeCompare(String(b.TurmaID || ''));
    if (turmaCmp !== 0) return turmaCmp;
    const activeA = String(a.Status || 'ativo') === 'inativo' ? 1 : 0;
    const activeB = String(b.Status || 'ativo') === 'inativo' ? 1 : 0;
    if (activeA !== activeB) return activeA - activeB;
    return String(a.Nome || '').localeCompare(String(b.Nome || ''));
  });
}

function groupBy_(items, key) {
  return (items || []).reduce((acc, item) => {
    const val = String(item[key] || '');
    if (!acc[val]) acc[val] = [];
    acc[val].push(item);
    return acc;
  }, {});
}

function normalizePresence_(value) {
  const v = String(value || '').toLowerCase().trim();
  return (v === 'sim' || v === 'presente' || v === 'p' || v === '1') ? 'sim' : 'nao';
}

function normalizeBool_(value) {
  const v = String(value || '').toLowerCase().trim();
  return v === 'sim' || v === 'true' || v === '1' || v === 'yes' || v === 'y';
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
  return `${round1_(Number(value || 0))}%`;
}

function round1_(n) {
  return Math.round((Number(n || 0) + Number.EPSILON) * 10) / 10;
}

function buildId_(prefix) {
  return `${prefix}_${Utilities.getUuid().slice(0, 8).toUpperCase()}`;
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

function todayKey_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function formatDateBR_(dateKey) {
  const d = new Date(`${dateKey}T00:00:00`);
  if (isNaN(d.getTime())) return dateKey;
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy');
}

function textHash_(text) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text);
  return bytes.map(b => {
    const v = (b + 256) % 256;
    return ('0' + v.toString(16)).slice(-2);
  }).join('');
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
    text: text,
    disable_web_page_preview: true,
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
