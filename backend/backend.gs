
/**
 * Backend novo para Google Apps Script
 * Estrutura usada:
 *  - Cadastro
 *  - Chamada
 *  - Base
 *
 * Sem ReadBase, sem SelfBase e sem caches ocultos.
 * A Chamada funciona como cache do dia.
 * A Base guarda o histórico definitivo.
 */

const SPREADSHEET_ID = '1bB3SJnkDnjOb-Ro7d7fxWBzMoTp1DzAPHLQcR6LGysM';

const SHEETS = {
  CADASTRO: 'Cadastro',
  CHAMADA: 'Chamada',
  BASE: 'Base',
};

const CADASTRO_HEADERS = ['DATA_NASCIMENTO', 'MÊS', 'ALUNO', 'CLASSE', 'CELULAR', 'STATUS'];
const CHAMADA_HEADERS = [
  'DATA_CHAMADA',
  'ALUNO',
  'CLASSE',
  'AUTO_PRESENÇA',
  'PRESENÇA',
  'AUTO_ATRASO',
  'ATRASO',
  'AUSÊNCIA',
  'AUS_SEGUIDA',
  'OFERTA',
  'VISITANTES',
  'BÍBLIAS',
  'REVISTAS',
  'RESPONSÁVEL',
  'SALVO',
];
const BASE_HEADERS = [
  'DATA',
  'ANO',
  'MÊS',
  'ALUNO',
  'CLASSE',
  'PRESENÇA',
  'ATRASO',
  'AUSÊNCIA',
  'OFERTA',
  'VISITANTES',
  'BÍBLIAS',
  'REVISTAS',
];

const LEGACY_SHEETS = [
  'ReadBase',
  'SelfBase',
  '__ALUNOS_META',
  '__TURMAS_META',
  '__RELATORIOS',
  '__ULTIMA_CHAMADA',
];

const AUTO_CUTOFF_MINUTES = 9 * 60 + 25;
const BACKEND_VERSION = '2026.07.11-1';
const BACKEND_DEPLOYED_AT = '2026-07-11T00:00:00-03:00';

function normalizeStudentStatus_(value) {
  const v = String(value || '').trim().toLowerCase();
  if (['inativo', 'nao', 'não', 'false', '0', 'off', 'desativado'].includes(v)) return 'inativo';
  if (['ativo', 'sim', 'true', '1', 'on', 'ativado'].includes(v)) return 'ativo';
  return 'ativo';
}

function doGet(e) {
  return routeRequest_(e?.parameter || {}, true);
}

function doPost(e) {
  return routeRequest_(e?.parameter || {}, false);
}

function routeRequest_(params, allowReadActions = false) {
  const p = params || {};
  const action = String(p.action || p.acao || '').trim().toLowerCase();

  try {
    switch (action) {
      case 'init':
        return json_(init_(p));
      case 'health':
        return json_(backendHealth_());
      case 'reporttext':
        return json_(getReportText_(p));
      case 'savecall':
        return json_(saveCall_(p));
      case 'selfpresence':
        return json_(selfPresence_(p));
      case 'addturma':
        return json_(addTurma_(p));
      case 'addaluno':
        return json_(addAluno_(p));
      case 'movealuno':
        return json_(moveAluno_(p));
      case 'togglealuno':
        return json_(toggleAluno_(p));
      case 'updatealuno':
      case 'updatealuno_':
      case 'updatealunoform':
      case 'updatealunopayload':
      case 'updatealunoedit':
      case 'editaluno':
      case 'editalunoform':
        return json_(updateAluno_(p));
      case 'sendreport':
        return json_(sendReport_(p));
      default:
        if (looksLikeAlunoUpdate_(p)) {
          return json_(updateAluno_(p));
        }
        return json_({ ok: false, message: `Ação inválida. (${action || 'vazia'})` });
    }
  } catch (err) {
    return json_({ ok: false, message: err?.message || String(err) });
  }
}

function init_(params) {
  ensureSheets_();

  const dateKey = normalizeDateKey_(params.date || todayKey_());
  const cadastro = loadSheetObjects_(SHEETS.CADASTRO, CADASTRO_HEADERS);
  const chamada = loadSheetObjects_(SHEETS.CHAMADA, CHAMADA_HEADERS);
  const base = loadSheetObjects_(SHEETS.BASE, BASE_HEADERS);

  const turmas = buildTurmasFromCadastro_(cadastro);
  const alunos = buildAlunosFromCadastro_(cadastro, base);

  const callsByTurma = {};
  for (const turma of turmas) {
    callsByTurma[turma.TurmaID] = buildCallForTurma_(dateKey, turma, alunos, chamada, base);
  }

  const resumoGeral = buildResumoGeral_(dateKey, turmas, alunos, callsByTurma, chamada);
  const memory = buildMemorySeed_(dateKey, turmas, alunos, callsByTurma, resumoGeral);

  return {
    ok: true,
    dateKey,
    turmas,
    alunos,
    callsByTurma,
    resumoGeral,
    memory,
    baseRowsCount: countDataRows_(SHEETS.BASE),
    timestamps: { now: new Date().toISOString() },
  };
}

function saveCall_(p) {
  ensureSheets_();

  const dateKey = normalizeDateKey_(p.date || todayKey_());
  const turmaId = String(p.turmaId || p.turmaNome || p.turma || '').trim();
  const chamadaId = String(p.chamadaId || `${turmaId}_${dateKey}`).trim();
  const rowsJson = String(p.rowsJson || '[]');
  const responsavel = String(p.responsavel || p.code || '').trim().toLowerCase();
  const oferta = parseMoney_(p.oferta);

  if (!turmaId) throw new Error('Turma inválida.');

  let rows = [];
  try {
    rows = JSON.parse(rowsJson);
  } catch (err) {
    throw new Error('rowsJson inválido.');
  }
  if (!Array.isArray(rows)) throw new Error('Lista de presença inválida.');

  const cadastro = loadSheetObjects_(SHEETS.CADASTRO, CADASTRO_HEADERS);
  const turmas = buildTurmasFromCadastro_(cadastro);
  const turma = turmas.find(t => String(t.TurmaID) === String(turmaId));
  if (!turma) throw new Error('Turma não encontrada.');

  const alunos = buildAlunosFromCadastro_(cadastro);
  const turmaAlunos = alunos
    .filter(a => String(a.TurmaID) === String(turmaId));
  const frontByAlunoId = new Map();

  const activeRows = rows.filter(row => String(row?.statusAluno || row?.STATUS || 'ativo').trim().toLowerCase() !== 'inativo');
  const incompleteRows = activeRows.filter(row => toInt_(row?.salvo ?? row?.SALVO ?? 0) !== 1);
  if (incompleteRows.length) {
    throw new Error('Existe aluno sem registro de presença, ausência ou atraso. Marque todos antes de salvar.');
  }
  const presentesCount = countPresentesFromRows_(activeRows);
  const visitantes = clampInt_(p.visitantes, 0, 50);
  const maxBibliasRevistas = Math.max(0, presentesCount + visitantes);
  const biblias = clampInt_(p.biblias, 0, maxBibliasRevistas);
  const revistas = clampInt_(p.revistas, 0, maxBibliasRevistas);
  for (const row of rows) {
    const key = normalizeKey_(row?.alunoId || row?.nome || '');
    if (key) frontByAlunoId.set(key, row);
  }

  const currentChamada = loadSheetObjects_(SHEETS.CHAMADA, CHAMADA_HEADERS);
  const currentBase = loadSheetObjects_(SHEETS.BASE, BASE_HEADERS);

  const existingCache = currentChamada.filter(r =>
    normalizeKey_(r.CLASSE) === normalizeKey_(turma.Nome)
  );

  const existingByAluno = new Map();
  for (const row of existingCache) {
    const key = normalizeKey_(row.ALUNO);
    if (key && !existingByAluno.has(key)) {
      existingByAluno.set(key, row);
    }
  }

  const existingBaseCache = currentBase.filter(r =>
    normalizeKey_(r.CLASSE) === normalizeKey_(turma.Nome) &&
    normalizeDateKey_(r.DATA) === dateKey
  );

  const existingBaseByAluno = new Map();
  for (const row of existingBaseCache) {
    const key = normalizeKey_(row.ALUNO);
    if (key && !existingBaseByAluno.has(key)) {
      existingBaseByAluno.set(key, row);
    }
  }

  const prepared = turmaAlunos.map(aluno => {
    const payload = frontByAlunoId.get(normalizeKey_(aluno.AlunoID)) || frontByAlunoId.get(normalizeKey_(aluno.Nome)) || null;
    if (!payload) return null;

    const previous = existingByAluno.get(normalizeKey_(aluno.Nome)) || null;
    const previousBase = existingBaseByAluno.get(normalizeKey_(aluno.Nome)) || null;
    const mergedPayload = previous ? { ...previous, ...payload } : { ...payload };

    const rowSalvo = toInt_(mergedPayload.salvo ?? mergedPayload.SALVO ?? previous?.SALVO ?? 0);
    if (rowSalvo !== 1) return null;

    const effectiveStatus = resolveEffectiveStatus_(mergedPayload, previous);
    const ausSeguidas = computeConsecutiveAbsences_(currentBase, aluno, dateKey, turma.Nome, effectiveStatus);

    const chamadaRow = buildChamadaRow_({
      dateKey,
      aluno,
      turmaNome: turma.Nome,
      // CORREÇÃO: usa os valores de nível de chamada vindos diretamente dos
      // parâmetros top-level do POST (p.oferta / p.visitantes / p.biblias /
      // p.revistas), já parseados no início de saveCall_.
      // Antes, eram lidos de mergedPayload (linha por aluno), que nunca contém
      // esses campos → sempre salvava como 0.
      oferta,
      visitantes,
      biblias,
      revistas,
      effectiveStatus,
      autoPresence: mergedPayload.autoPresenca ?? mergedPayload.autoPresença,
      autoDelay: mergedPayload.autoAtraso,
      ausSeguidas,
      // CORREÇÃO: o responsável enviado pelo frontend deve sempre substituir o
      // anterior, não ser sobrescrito pelo valor já gravado na planilha.
      responsavel,
      salvo: rowSalvo,
      previousRow: previous,
    });

    const baseRow = buildBaseRow_({
      dateKey,
      aluno,
      turmaNome: turma.Nome,
      // CORREÇÃO: mesma origem que buildChamadaRow_ acima — valores top-level
      // do POST, não do payload por-aluno que não os contém.
      oferta,
      visitantes,
      biblias,
      revistas,
      effectiveStatus,
      previousRow: previousBase,
    });

    return { chamadaRow, baseRow };
  }).filter(Boolean);

  const chamadaRows = prepared.map(x => x.chamadaRow);
  const baseRows = prepared.map(x => x.baseRow);

  for (const row of chamadaRows) {
    upsertChamadaRow_(SHEETS.CHAMADA, CHAMADA_HEADERS, currentChamada, dateKey, turma.Nome, row.ALUNO, row);
  }
  upsertBaseRows_(SHEETS.BASE, BASE_HEADERS, currentBase, baseRows);

  const refreshedChamada = loadSheetObjects_(SHEETS.CHAMADA, CHAMADA_HEADERS);
  const refreshedBase = loadSheetObjects_(SHEETS.BASE, BASE_HEADERS);

  const turmaCall = buildCallForTurma_(dateKey, turma, alunos, refreshedChamada, refreshedBase);
  const resumoGeral = buildResumoGeral_(dateKey, turmas, alunos, { [turma.TurmaID]: turmaCall }, refreshedChamada);

  return {
    ok: true,
    message: 'Chamada salva com sucesso.',
    chamadaId,
    turmaId: turma.TurmaID,
    dateKey,
    turmaCall,
    resumoGeral,
    baseWrite: {
      afterRows: countDataRows_(SHEETS.BASE),
      insertedRows: baseRows.length,
    },
  };
}

function selfPresence_(p) {
  ensureSheets_();

  const dateKey = normalizeDateKey_(p.date || todayKey_());
  const celularSuffix = String(p.celularSuffix || '').replace(/\D/g, '').slice(0, 4);
  if (celularSuffix.length !== 4) {
    throw new Error('Digite os 4 últimos números do celular.');
  }

  const cadastro = loadSheetObjects_(SHEETS.CADASTRO, CADASTRO_HEADERS);
  const match = findCadastroByCelularSuffix_(cadastro, celularSuffix);
  if (!match) {
    throw new Error('Celular não encontrado no Cadastro.');
  }

  const turmaNome = String(match.CLASSE || '').trim();
  const alunoNome = String(match.ALUNO || '').trim();
  if (!turmaNome || !alunoNome) {
    throw new Error('Cadastro incompleto para auto presença.');
  }

  const isLate = isAfterAutoCutoff_();
  const effectiveStatus = isLate ? 'atraso' : 'presenca';

  const turmas = buildTurmasFromCadastro_(cadastro);
  const turma = turmas.find(t => String(t.Nome) === String(turmaNome)) || { TurmaID: turmaNome, Nome: turmaNome, Ordem: 0 };
  const alunos = buildAlunosFromCadastro_(cadastro);
  const aluno = alunos.find(a => normalizeKey_(a.Nome) === normalizeKey_(alunoNome) && normalizeKey_(a.TurmaNome) === normalizeKey_(turmaNome)) || {
    AlunoID: buildAlunoId_(alunoNome, turmaNome, match.CELULAR),
    Nome: alunoNome,
    TurmaID: turmaNome,
    TurmaNome: turmaNome,
    CELULAR: digitsOnly_(match.CELULAR),
    Status: 'ativo',
  };

  const oferta = 0;
  const visitantes = 0;
  const biblias = 0;
  const revistas = 0;

  const currentChamada = loadSheetObjects_(SHEETS.CHAMADA, CHAMADA_HEADERS);
  const currentBase = loadSheetObjects_(SHEETS.BASE, BASE_HEADERS);

  const existingCache = currentChamada.filter(r =>
    normalizeKey_(r.CLASSE) === normalizeKey_(turmaNome)
  );
  const previous = existingCache.find(r => normalizeKey_(r.ALUNO) === normalizeKey_(alunoNome)) || null;

  const ausSeguidas = computeConsecutiveAbsences_(currentBase, aluno, dateKey, turmaNome, effectiveStatus);

  const chamadaRow = buildChamadaRow_({
    dateKey,
    aluno,
    turmaNome,
    oferta,
    visitantes,
    biblias,
    revistas,
    effectiveStatus,
    autoPresence: !isLate,
    autoDelay: isLate,
    ausSeguidas,
    salvo: 1,
  });

  const baseRow = buildBaseRow_({
    dateKey,
    aluno,
    turmaNome,
    oferta,
    visitantes,
    biblias,
    revistas,
    effectiveStatus,
  });

  upsertChamadaRow_(SHEETS.CHAMADA, CHAMADA_HEADERS, currentChamada, dateKey, turmaNome, aluno.Nome, chamadaRow);
  upsertBaseRow_(SHEETS.BASE, BASE_HEADERS, currentBase, dateKey, turmaNome, aluno.Nome, baseRow);

  const refreshedChamada = loadSheetObjects_(SHEETS.CHAMADA, CHAMADA_HEADERS);
  const refreshedBase = loadSheetObjects_(SHEETS.BASE, BASE_HEADERS);

  const turmaCall = buildCallForTurma_(dateKey, turma, alunos, refreshedChamada, refreshedBase);

  return {
    ok: true,
    message: isLate ? 'Auto atraso registrado com sucesso.' : 'Auto presença registrada com sucesso.',
    data: {
      dateKey,
      aluno: aluno.Nome,
      turma: turmaNome,
      auto: isLate ? 'atraso' : 'presenca',
    },
    turmaCall,
    baseWrite: {
      afterRows: countDataRows_(SHEETS.BASE),
      insertedRows: 1,
    },
  };
}

function addTurma_(p) {
  ensureSheets_();

  const nome = String(p.nome || '').trim();
  if (!nome) throw new Error('Informe o nome da classe.');

  const cadastroSheet = getOrCreateSheet_(SHEETS.CADASTRO, CADASTRO_HEADERS);
  const cadastro = loadSheetObjects_(SHEETS.CADASTRO, CADASTRO_HEADERS);
  const exists = cadastro.some(r => normalizeKey_(r.CLASSE) === normalizeKey_(nome));
  if (exists) {
    return { ok: true, message: 'Classe já existe.', turmaId: nome };
  }

  // Classe sem alunos: entra como linha vazia para manter a turma disponível no front.
  appendObjects_(cadastroSheet, CADASTRO_HEADERS, [{
    DATA_NASCIMENTO: '',
    MÊS: '',
    ALUNO: '',
    CLASSE: nome,
    CELULAR: '',
    STATUS: 'ativo',
  }]);

  return { ok: true, message: 'Classe cadastrada com sucesso.', turmaId: nome };
}

function addAluno_(p) {
  ensureSheets_();

  const nome = String(p.nome || '').trim();
  const celular = digitsOnly_(p.celular || '').slice(0, 11);
  const turmaId = String(p.turmaId || '').trim();

  if (!nome) throw new Error('Informe o nome do aluno.');
  if (!turmaId) throw new Error('Selecione uma classe.');

  const cadastroSheet = getOrCreateSheet_(SHEETS.CADASTRO, CADASTRO_HEADERS);
  const cadastro = loadSheetObjects_(SHEETS.CADASTRO, CADASTRO_HEADERS);

  const duplicate = cadastro.some(r =>
    normalizeKey_(r.ALUNO) === normalizeKey_(nome) &&
    normalizeKey_(r.CLASSE) === normalizeKey_(turmaId)
  );
  if (duplicate) {
    return { ok: true, message: 'Aluno já cadastrado nesta classe.' };
  }

  appendObjects_(cadastroSheet, CADASTRO_HEADERS, [{
    DATA_NASCIMENTO: '',
    MÊS: '',
    ALUNO: nome,
    CLASSE: turmaId,
    CELULAR: celular,
    STATUS: 'ativo',
  }]);

  return { ok: true, message: 'Aluno cadastrado com sucesso.' };
}

function updateAluno(alunoId, nome, celular, turmaId, status) {
  return updateAluno_({
    alunoId,
    nome,
    celular,
    turmaId,
    status,
  });
}

function updateAluno_(p) {
  ensureSheets_();

  const sheet = getOrCreateSheet_(SHEETS.CADASTRO, CADASTRO_HEADERS);
  const rows = readAllRows_(sheet, CADASTRO_HEADERS);

  const alunoId = String(p.alunoId || p.nome || '').trim();
  const nome = String(p.nome || '').trim();
  const desiredStatus = String(p.status ?? p.ativo ?? '').trim();

  if (!alunoId) throw new Error('Aluno inválido.');
  if (!nome) throw new Error('Informe o nome do aluno.');

  const row = findCadastroAlunoByIdentifier_(rows, alunoId);
  if (!row) throw new Error('Aluno não encontrado no Cadastro.');

  const turmaId = String(p.turmaId || row.CLASSE || '').trim();
  if (!turmaId) throw new Error('Selecione uma classe.');

  const celular = digitsOnly_(
    Object.prototype.hasOwnProperty.call(p, 'celular')
      ? p.celular
      : row.CELULAR || ''
  ).slice(0, 11);

  const duplicate = rows.some(other =>
    other !== row &&
    normalizeKey_(other.ALUNO) === normalizeKey_(nome) &&
    normalizeKey_(other.CLASSE) === normalizeKey_(turmaId)
  );
  if (duplicate) {
    throw new Error('Já existe outro aluno com esse nome nesta classe.');
  }

  row.ALUNO = nome;
  row.CLASSE = turmaId;
  row.CELULAR = celular;
  row.STATUS = desiredStatus ? normalizeStudentStatus_(desiredStatus) : normalizeStudentStatus_(row.STATUS || 'ativo');

  writeAllRows_(sheet, CADASTRO_HEADERS, rows);
  return { ok: true, message: 'Aluno atualizado com sucesso.' };
}

function moveAluno_(p) {
  ensureSheets_();

  const alunoId = String(p.alunoId || p.nome || '').trim();
  const turmaId = String(p.turmaId || p.destino || '').trim();
  if (!alunoId) throw new Error('Aluno inválido.');
  if (!turmaId) throw new Error('Classe de destino inválida.');

  const sheet = getOrCreateSheet_(SHEETS.CADASTRO, CADASTRO_HEADERS);
  const rows = readAllRows_(sheet, CADASTRO_HEADERS);

  const row = findCadastroAlunoByIdentifier_(rows, alunoId);
  if (!row) throw new Error('Aluno não encontrado no Cadastro.');

  row.CLASSE = turmaId;

  writeAllRows_(sheet, CADASTRO_HEADERS, rows);
  return { ok: true, message: 'Aluno movido com sucesso.' };
}

function toggleAluno_(p) {
  ensureSheets_();

  const alunoId = String(p.alunoId || p.nome || '').trim();
  if (!alunoId) throw new Error('Aluno inválido.');

  const desiredStatus = String(p.status || p.ativo || '').trim().toLowerCase();
  const sheet = getOrCreateSheet_(SHEETS.CADASTRO, CADASTRO_HEADERS);
  const rows = readAllRows_(sheet, CADASTRO_HEADERS);

  const row = findCadastroAlunoByIdentifier_(rows, alunoId);
  if (!row) throw new Error('Aluno não encontrado no Cadastro.');

  const currentStatus = normalizeStudentStatus_(row.STATUS || row.Ativo || 'ativo');
  const nextStatus = ['ativo', 'inativo'].includes(desiredStatus)
    ? desiredStatus
    : (currentStatus === 'inativo' ? 'ativo' : 'inativo');

  row.STATUS = nextStatus;

  writeAllRows_(sheet, CADASTRO_HEADERS, rows);
  return {
    ok: true,
    message: 'Status atualizado com sucesso.',
  };
}

function sendReport_(p) {
  ensureSheets_();

  const dateKey = normalizeDateKey_(p.date || todayKey_());
  const scope = String(p.scope || 'geral').trim().toLowerCase();
  const turmaId = String(p.turmaId || '').trim();

  const cadastro = loadSheetObjects_(SHEETS.CADASTRO, CADASTRO_HEADERS);
  const turmas = buildTurmasFromCadastro_(cadastro);
  const alunos = buildAlunosFromCadastro_(cadastro);
  const chamada = loadSheetObjects_(SHEETS.CHAMADA, CHAMADA_HEADERS);
  const base = loadSheetObjects_(SHEETS.BASE, BASE_HEADERS);

  const callsByTurma = {};
  for (const turma of turmas) {
    if (scope === 'turma' && turmaId && String(turma.TurmaID) !== String(turmaId)) continue;
    callsByTurma[turma.TurmaID] = buildCallForTurma_(dateKey, turma, alunos, chamada, base);
  }

  const text = scope === 'turma' && turmaId
    ? buildTurmaReportText_(dateKey, turmas.find(t => String(t.TurmaID) === String(turmaId)), callsByTurma[turmaId], alunos)
    : buildGeneralReportText_(dateKey, turmas, alunos, callsByTurma);

  return {
    ok: true,
    message: 'Relatório gerado.',
    text,
  };
}

function getReportText_(params) {
  ensureSheets_();

  const scope = String(params.scope || 'geral').trim().toLowerCase();
  const dateKey = normalizeDateKey_(params.date || todayKey_());

  const cadastro = loadSheetObjects_(SHEETS.CADASTRO, CADASTRO_HEADERS);
  const turmas = buildTurmasFromCadastro_(cadastro);
  const alunos = buildAlunosFromCadastro_(cadastro);
  const chamada = loadSheetObjects_(SHEETS.CHAMADA, CHAMADA_HEADERS);
  const base = loadSheetObjects_(SHEETS.BASE, BASE_HEADERS);

  const callsByTurma = {};
  for (const turma of turmas) {
    callsByTurma[turma.TurmaID] = buildCallForTurma_(dateKey, turma, alunos, chamada, base);
  }

  if (scope === 'turma' && params.turmaId) {
    const turma = turmas.find(t => String(t.TurmaID) === String(params.turmaId));
    return { ok: true, text: buildTurmaReportText_(dateKey, turma, callsByTurma[params.turmaId], alunos) };
  }

  return { ok: true, text: buildGeneralReportText_(dateKey, turmas, alunos, callsByTurma) };
}

/* =========================
 * Construção de dados
 * ========================= */

function buildTurmasFromCadastro_(cadastroRows) {
  const map = new Map();
  for (const row of cadastroRows || []) {
    const classe = String(row.CLASSE || '').trim();
    if (!classe) continue;
    if (!map.has(normalizeKey_(classe))) {
      map.set(normalizeKey_(classe), {
        TurmaID: classe,
        Nome: classe,
        Ordem: map.size + 1,
      });
    }
  }
  return [...map.values()].sort((a, b) => {
    const oa = Number(a.Ordem || 0) || 0;
    const ob = Number(b.Ordem || 0) || 0;
    if (oa !== ob) return oa - ob;
    return String(a.Nome || '').localeCompare(String(b.Nome || ''));
  });
}

function buildAlunosFromCadastro_(cadastroRows, baseRows = []) {
  const grouped = new Map();

  (cadastroRows || []).forEach((row, index) => {
    const aluno = String(row.ALUNO || '').trim();
    const classe = String(row.CLASSE || '').trim();
    if (!aluno || !classe) return;

    const celular = digitsOnly_(row.CELULAR || '');
    const status = normalizeStudentStatus_(row.STATUS || row.Ativo || 'ativo');
    const key = normalizeKey_(`${classe}__${aluno}__${celular || ''}`);

    const entry = {
      AlunoID: buildAlunoId_(aluno, classe, celular),
      Nome: aluno,
      TurmaID: classe,
      TurmaNome: classe,
      CELULAR: celular,
      Ativo: status === 'ativo' ? 'sim' : 'nao',
      Status: status,
      FaltasConsecutivas: 0,
      TotalPresencas: 0,
      TotalFaltas: 0,
      Percentual: 0,
      FaltandoMuito: '',
      UltimaPresenca: '',
      UltimaAusencia: '',
      RealocadoDe: '',
      CriadoEm: '',
      AtualizadoEm: '',
      OrdemCadastro: Number(row._rowNumber || (index + 2)) || (index + 2),
    };

    if (grouped.has(key)) {
      const current = grouped.get(key);
      grouped.set(key, {
        ...current,
        ...entry,
        OrdemCadastro: current.OrdemCadastro || entry.OrdemCadastro,
      });
    } else {
      grouped.set(key, entry);
    }
  });

  // Mantém exatamente a ordem de leitura da planilha.
  const students = [...grouped.values()];

  const statsMap = computeStudentStatsFromBase_(students, baseRows || []);

  return students.map(st => ({
    ...st,
    ...(statsMap.get(normalizeKey_(`${st.TurmaID}__${st.Nome}`)) || {}),
  }));
}

function buildCallForTurma_(dateKey, turma, alunos, chamadaRows, baseRows) {
  const turmaNome = String(turma?.Nome || turma?.TurmaID || '').trim();
  const turmaId = String(turma?.TurmaID || turmaNome).trim();
  const turmaKey = normalizeKey_(turmaNome);
  const selectedDate = normalizeDateKey_(dateKey);
  const today = todayKey_();
  const useBaseForDate = selectedDate !== today;

  const turmaAlunos = (alunos || [])
    .filter(a => String(a.TurmaID) === String(turmaId));

  const sourceRows = useBaseForDate ? (baseRows || []) : (chamadaRows || []);
  const classRows = sourceRows.filter(r =>
    normalizeKey_(r.CLASSE) === turmaKey &&
    normalizeDateKey_(useBaseForDate ? r.DATA : r.DATA_CHAMADA) === selectedDate
  );

  const byAluno = new Map();
  for (const row of classRows) {
    const key = normalizeKey_(row.ALUNO);
    if (key && !byAluno.has(key)) {
      byAluno.set(key, row);
    }
  }

  const effectiveRows = turmaAlunos.map(aluno => {
    const cached = byAluno.get(normalizeKey_(aluno.Nome)) || null;
    return useBaseForDate
      ? buildFrontRowFromBase_(cached, aluno, turmaNome)
      : buildFrontRowFromChamada_(cached, aluno, turmaNome);
  });

  const activeRows = effectiveRows.filter(r =>
    String(r.statusAluno || 'ativo').trim().toLowerCase() !== 'inativo'
  );
  const presentes = activeRows.filter(r => isPresentLikeValue_(r.presenca)).length;
  const atrasos = activeRows.filter(r => isDelayedValue_(r.presenca)).length;
  const ausentes = activeRows.length - presentes;
  const percentual = activeRows.length ? round1_((presentes / activeRows.length) * 100) : 0;

  return {
    chamadaId: `${turmaId}_${dateKey}`,
    data: dateKey,
    turmaId,
    turmaNome,
    oferta: getCallLevelValue_(classRows, useBaseForDate ? 'OFERTA' : 'OFERTA'),
    visitantes: getCallLevelValue_(classRows, useBaseForDate ? 'VISITANTES' : 'VISITANTES', true),
    biblias: getCallLevelValue_(classRows, useBaseForDate ? 'BÍBLIAS' : 'BÍBLIAS', true),
    revistas: getCallLevelValue_(classRows, useBaseForDate ? 'REVISTAS' : 'REVISTAS', true),
    totalAlunos: activeRows.length,
    presentes,
    atrasos,
    ausentes,
    percentual,
    rows: effectiveRows,
    isSaved: true,
  };
}

function buildResumoGeral_(dateKey, turmas, alunos, callsByTurma, chamadaRows) {
  const values = Object.values(callsByTurma || {});
  const totalTurmas = turmas.length;
  const turmasSalvas = values.filter(c => c && c.isSaved).length;
  const totalAlunos = alunos.filter(a =>
    String(a.Status || 'ativo').trim().toLowerCase() !== 'inativo'
  ).length;

  const presentes = values.reduce((acc, c) => acc + Number(c?.presentes || 0), 0);
  const atrasos = values.reduce((acc, c) => acc + Number(c?.atrasos || 0), 0);
  const ausentes = values.reduce((acc, c) => acc + Number(c?.ausentes || 0), 0);
  const oferta = values.reduce((acc, c) => acc + parseMoney_(c?.oferta || 0), 0);
  const visitantes = values.reduce((acc, c) => acc + toInt_(c?.visitantes || 0), 0);
  const biblias = values.reduce((acc, c) => acc + toInt_(c?.biblias || 0), 0);
  const revistas = values.reduce((acc, c) => acc + toInt_(c?.revistas || 0), 0);
  const percentual = totalAlunos ? round1_(((presentes + atrasos) / totalAlunos) * 100) : 0;

  return {
    data: dateKey,
    turmasSalvas,
    totalTurmas,
    totalAlunos,
    presentes,
    atrasos,
    ausentes,
    percentual,
    oferta,
    visitantes,
    biblias,
    revistas,
  };
}

function buildFrontRowFromChamada_(cached, aluno, turmaNome) {
  const autoPres = toBool_(cached?.AUTO_PRESENÇA);
  const autoDelay = toBool_(cached?.AUTO_ATRASO);
  const pres = toInt_(cached?.PRESENÇA);
  const atr = toInt_(cached?.ATRASO);
  const aus = toInt_(cached?.AUSÊNCIA);
  let presenca = 'nao';
  let atraso = false;

  if (autoDelay) {
    presenca = 'atrasado';
    atraso = true;
  } else if (autoPres) {
    presenca = 'sim';
    atraso = false;
  } else if (atr === 1) {
    presenca = 'atrasado';
    atraso = true;
  } else if (pres === 1) {
    presenca = 'sim';
    atraso = false;
  } else if (aus === 1) {
    presenca = 'nao';
    atraso = false;
  }

  return {
    alunoId: aluno.AlunoID,
    nome: aluno.Nome,
    turmaId: aluno.TurmaID,
    turmaNome,
    presenca,
    atraso,
    observacao: '',
    statusAluno: aluno.Status || 'ativo',
    autoPresenca: autoPres ? 1 : 0,
    autoAtraso: autoDelay ? 1 : 0,
    salvo: cached ? toInt_(cached.SALVO) : 0,
    ausSeguidas: cached ? toInt_(cached.AUS_SEGUIDA) : 0,
  };
}

function buildFrontRowFromBase_(cached, aluno, turmaNome) {
  const pres = toInt_(cached?.PRESENÇA);
  const atr = toInt_(cached?.ATRASO);
  const aus = toInt_(cached?.AUSÊNCIA);

  let presenca = 'nao';
  let atraso = false;

  if (atr === 1) {
    presenca = 'atrasado';
    atraso = true;
  } else if (pres === 1) {
    presenca = 'sim';
    atraso = false;
  } else if (aus === 1) {
    presenca = 'nao';
    atraso = false;
  }

  return {
    alunoId: aluno.AlunoID,
    nome: aluno.Nome,
    turmaId: aluno.TurmaID,
    turmaNome,
    presenca,
    atraso,
    observacao: '',
    statusAluno: aluno.Status || 'ativo',
    autoPresenca: 0,
    autoAtraso: 0,
    salvo: cached ? 1 : 0,
    ausSeguidas: 0,
  };
}


function buildChamadaRow_(opts) {
  const effectiveStatus = String(opts.effectiveStatus || 'ausencia').trim().toLowerCase();
  const autoPresence = toBool_(opts.autoPresence);
  const autoDelay = toBool_(opts.autoDelay);

  const isPresence = effectiveStatus === 'presenca';
  const isDelay = effectiveStatus === 'atraso';
  const isAbsence = effectiveStatus === 'ausencia';

  // Regra solicitada:
  // - Auto presença / auto atraso ficam marcados apenas nos campos AUTO_*.
  // - PRESENÇA / ATRASO / AUSÊNCIA ficam zerados no cache.
  const presencaValue = (autoPresence || autoDelay) ? 0 : (isPresence ? 1 : 0);
  const atrasoValue = (autoPresence || autoDelay) ? 0 : (isDelay ? 1 : 0);
  const ausenciaValue = (autoPresence || autoDelay) ? 0 : (isAbsence ? 1 : 0);

  return {
    DATA_CHAMADA: normalizeDateKey_(opts.dateKey),
    ALUNO: String(opts.aluno?.Nome || '').trim(),
    CLASSE: String(opts.turmaNome || '').trim(),
    AUTO_PRESENÇA: autoPresence ? 1 : 0,
    PRESENÇA: presencaValue,
    AUTO_ATRASO: autoDelay ? 1 : 0,
    ATRASO: atrasoValue,
    AUSÊNCIA: ausenciaValue,
    AUS_SEGUIDA: toInt_(opts.ausSeguidas || 0),
    OFERTA: parseMoney_(opts.oferta || 0),
    VISITANTES: toInt_(opts.visitantes || 0),
    BÍBLIAS: toInt_(opts.biblias || 0),
    REVISTAS: toInt_(opts.revistas || 0),
    RESPONSÁVEL: String(opts.responsavel || '').trim().toLowerCase(),
    SALVO: toInt_(opts.salvo ? 1 : 0),
  };
}

function buildBaseRow_(opts) {
  const d = normalizeDateKey_(opts.dateKey);
  const dt = parseIsoDate_(d) || new Date();
  const effectiveStatus = String(opts.effectiveStatus || 'ausencia').trim().toLowerCase();
  const previousRow = opts.previousRow || null;

  return {
    DATA: d,
    ANO: String(dt.getFullYear()),
    MÊS: String(dt.getMonth() + 1).padStart(2, '0'),
    ALUNO: String(opts.aluno?.Nome || previousRow?.ALUNO || '').trim(),
    CLASSE: String(opts.turmaNome || previousRow?.CLASSE || '').trim(),
    PRESENÇA: effectiveStatus === 'presenca' ? 1 : toInt_(previousRow?.PRESENÇA ?? 0),
    ATRASO: effectiveStatus === 'atraso' ? 1 : toInt_(previousRow?.ATRASO ?? 0),
    AUSÊNCIA: effectiveStatus === 'ausencia' ? 1 : toInt_(previousRow?.AUSÊNCIA ?? 0),
    OFERTA: parseMoney_(opts.oferta ?? previousRow?.OFERTA ?? 0),
    VISITANTES: toInt_(opts.visitantes ?? previousRow?.VISITANTES ?? 0),
    BÍBLIAS: toInt_(opts.biblias ?? previousRow?.BÍBLIAS ?? 0),
    REVISTAS: toInt_(opts.revistas ?? previousRow?.REVISTAS ?? 0),
  };
}

function buildTurmasReportText_(dateKey, turma, turmaCall, alunos) {
  if (!turma || !turmaCall) return 'Nenhuma turma selecionada.';
  const stats = turmaCall || {};
  const activeRows = (turmaCall.rows || []).filter(r =>
    String(r.statusAluno || 'ativo').trim().toLowerCase() !== 'inativo'
  );
  const presentNames = activeRows.filter(r => isPresentLikeValue_(r.presenca)).map(r => r.nome).join(', ') || 'nenhum';
  const delayedNames = activeRows.filter(r => isDelayedValue_(r.presenca)).map(r => r.nome).join(', ') || 'nenhum';
  const absentNames = activeRows.filter(r => !isPresentLikeValue_(r.presenca)).map(r => r.nome).join(', ') || 'nenhum';

  return [
    'RELATÓRIO DA CLASSE',
    `Classe: ${turma.Nome}`,
    `Data: ${formatDateBR_(dateKey)}`,
    '',
    `Total de alunos: ${stats.totalAlunos || 0}`,
    `Presentes: ${stats.presentes || 0}`,
    `Atrasados: ${stats.atrasos || 0}`,
    `Ausentes: ${stats.ausentes || 0}`,
    `Presença: ${formatPercent_(stats.percentual || 0)}`,
    `Oferta da classe: ${formatMoneyBR_(stats.oferta || 0)}`,
    `Visitantes: ${stats.visitantes || 0}`,
    `Bíblias: ${stats.biblias || 0}`,
    `Revistas: ${stats.revistas || 0}`,
    '',
    `Presentes: ${presentNames}`,
    `Atrasados: ${delayedNames}`,
    `Ausentes: ${absentNames}`,
  ].join('\n');
}

function buildGeneralReportText_(dateKey, turmas, alunos, callsByTurma) {
  const values = Object.values(callsByTurma || {});
  const totalTurmas = turmas.length;
  const turmasSalvas = values.filter(c => c && c.isSaved).length;
  const totalAlunos = alunos.filter(a =>
    String(a.Status || 'ativo').trim().toLowerCase() !== 'inativo'
  ).length;
  const presentes = values.reduce((acc, c) => acc + Number(c?.presentes || 0), 0);
  const atrasos = values.reduce((acc, c) => acc + Number(c?.atrasos || 0), 0);
  const ausentes = values.reduce((acc, c) => acc + Number(c?.ausentes || 0), 0);
  const oferta = values.reduce((acc, c) => acc + parseMoney_(c?.oferta || 0), 0);
  const visitantes = values.reduce((acc, c) => acc + toInt_(c?.visitantes || 0), 0);
  const biblias = values.reduce((acc, c) => acc + toInt_(c?.biblias || 0), 0);
  const revistas = values.reduce((acc, c) => acc + toInt_(c?.revistas || 0), 0);

  return [
    'RELATÓRIO GERAL',
    `Data: ${formatDateBR_(dateKey)}`,
    '',
    `Turmas salvas: ${turmasSalvas}/${totalTurmas}`,
    `Total de alunos: ${totalAlunos}`,
    `Presentes: ${presentes}`,
    `Atrasados: ${atrasos}`,
    `Ausentes: ${ausentes}`,
    `Presença geral: ${formatPercent_(totalAlunos ? ((presentes + atrasos) / totalAlunos) * 100 : 0)}`,
    `Oferta total: ${formatMoneyBR_(oferta)}`,
    `Visitantes: ${visitantes}`,
    `Bíblias: ${biblias}`,
    `Revistas: ${revistas}`,
  ].join('\n');
}

/* =========================
 * Regras de negócio
 * ========================= */

function resolveEffectiveStatus_(payload, previousRow) {
  const raw = String(payload?.presenca ?? payload?.PRESENCA ?? payload?.presencaStatus ?? previousRow?.PRESENÇA ?? previousRow?.PRESENCA ?? '').trim().toLowerCase();
  const atrasoFlag = toBool_(payload?.atraso ?? payload?.Atraso ?? previousRow?.ATRASO);
  const autoPres = toBool_(payload?.autoPresenca ?? payload?.autoPresença ?? previousRow?.AUTO_PRESENÇA);
  const autoDelay = toBool_(payload?.autoAtraso ?? previousRow?.AUTO_ATRASO);

  if (autoDelay || ['atrasado', 'atrasada', 'delay', 'late'].includes(raw) || atrasoFlag) return 'atraso';
  if (autoPres || ['sim', 'presente', 'presença', 'presenca', '1', 'true', 'p'].includes(raw)) return 'presenca';
  if (['nao', 'não', 'ausente', 'ausencia', 'ausência', '0', 'false'].includes(raw)) return 'ausencia';

  return inferStatusFromChamadaRow_(previousRow);
}

function inferStatusFromChamadaRow_(row) {
  if (!row) return 'ausencia';

  const autoPres = toBool_(row.AUTO_PRESENÇA);
  const autoDelay = toBool_(row.AUTO_ATRASO);
  const pres = toInt_(row.PRESENÇA);
  const atr = toInt_(row.ATRASO);
  const aus = toInt_(row.AUSÊNCIA);

  if (autoDelay || atr === 1) return 'atraso';
  if (autoPres || pres === 1) return 'presenca';
  if (aus === 1) return 'ausencia';

  return 'ausencia';
}

function computeConsecutiveAbsences_(baseRows, aluno, dateKey, turmaNome, currentStatus) {
  if (currentStatus !== 'ausencia') return 0;

  const keyAluno = normalizeKey_(aluno?.Nome || '');
  const keyTurma = normalizeKey_(turmaNome || '');
  const current = normalizeDateKey_(dateKey);

  const history = (baseRows || [])
    .filter(r =>
      normalizeKey_(r.ALUNO) === keyAluno &&
      normalizeKey_(r.CLASSE) === keyTurma &&
      normalizeDateKey_(r.DATA) < current
    )
    .sort((a, b) => normalizeDateKey_(a.DATA).localeCompare(normalizeDateKey_(b.DATA)));

  let streak = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const r = history[i];
    if (toInt_(r.AUSÊNCIA) === 1) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak + 1;
}

function computeStudentStatsFromBase_(students, baseRows) {
  const map = new Map();

  for (const student of students || []) {
    const key = normalizeKey_(`${student.TurmaID}__${student.Nome}`);
    const history = (baseRows || [])
      .filter(r =>
        normalizeKey_(r.CLASSE) === normalizeKey_(student.TurmaID) &&
        normalizeKey_(r.ALUNO) === normalizeKey_(student.Nome)
      )
      .sort((a, b) => normalizeDateKey_(a.DATA).localeCompare(normalizeDateKey_(b.DATA)));

    const totalPresencas = history.filter(r => toInt_(r.PRESENÇA) === 1 || toInt_(r.ATRASO) === 1).length;
    const totalFaltas = history.filter(r => toInt_(r.AUSÊNCIA) === 1).length;
    const percentual = history.length ? round1_((totalPresencas / history.length) * 100) : 0;

    let streak = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      if (toInt_(history[i].AUSÊNCIA) === 1) streak += 1;
      else break;
    }

    const lastPresence = [...history].reverse().find(r => toInt_(r.PRESENÇA) === 1 || toInt_(r.ATRASO) === 1);
    const lastAbsence = [...history].reverse().find(r => toInt_(r.AUSÊNCIA) === 1);

    const isInactive = streak >= 4;

    map.set(key, {
      FaltasConsecutivas: streak,
      TotalPresencas: totalPresencas,
      TotalFaltas: totalFaltas,
      Percentual: percentual,
      FaltandoMuito: isInactive ? 'sim' : '',
      UltimaPresenca: lastPresence ? normalizeDateKey_(lastPresence.DATA) : '',
      UltimaAusencia: lastAbsence ? normalizeDateKey_(lastAbsence.DATA) : '',
      Ativo: isInactive ? 'nao' : 'sim',
      Status: isInactive ? 'inativo' : 'ativo',
    });
  }

  return map;
}

/* =========================
 * Escrita/Leitura de planilha
 * ========================= */

function ensureSheets_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  const cadastro = getOrCreateSheet_(SHEETS.CADASTRO, CADASTRO_HEADERS);
  const chamada = getOrCreateSheet_(SHEETS.CHAMADA, CHAMADA_HEADERS);
  const base = getOrCreateSheet_(SHEETS.BASE, BASE_HEADERS);

  ensureHeaders_(cadastro, CADASTRO_HEADERS);
  ensureHeaders_(chamada, CHAMADA_HEADERS);
  ensureHeaders_(base, BASE_HEADERS);

  // Remove os caches antigos, caso ainda existam.
  for (const legacyName of LEGACY_SHEETS) {
    const sh = ss.getSheetByName(legacyName);
    if (sh) {
      ss.deleteSheet(sh);
    }
  }
}

function getOrCreateSheet_(name, headers) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  ensureHeaders_(sheet, headers);
  return sheet;
}

function ensureHeaders_(sheet, headers) {
  const lastColumn = Math.max(sheet.getLastColumn(), headers.length);
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  const current = headerRange.getValues()[0].map(v => String(v || '').trim());
  const needsWrite = current.join('|') !== headers.join('|');

  if (needsWrite) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
}

function loadSheetObjects_(sheetName, headers) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  const values = sheet.getDataRange().getValues();
  if (!values || values.length <= 1) return [];

  const headerMap = buildHeaderIndexMap_(values[0], headers);
  const rows = [];

  for (let i = 1; i < values.length; i++) {
    const raw = values[i];
    if (raw.every(v => String(v || '').trim() === '')) continue;
    const obj = {};
    for (const header of headers) {
      const idx = headerMap.get(normalizeKey_(header));
      obj[header] = idx === undefined ? '' : raw[idx];
    }
    obj._rowNumber = i + 1;
    rows.push(obj);
  }

  return rows;
}

function readAllRows_(sheet, headers) {
  const values = sheet.getDataRange().getValues();
  if (!values || values.length <= 1) return [];
  const map = buildHeaderIndexMap_(values[0], headers);
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const raw = values[i];
    if (raw.every(v => String(v || '').trim() === '')) continue;
    const obj = {};
    for (const header of headers) {
      const idx = map.get(normalizeKey_(header));
      obj[header] = idx === undefined ? '' : raw[idx];
    }
    rows.push(obj);
  }
  return rows;
}

function writeAllRows_(sheet, headers, rows) {
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  appendObjects_(sheet, headers, rows);
}

function appendObjects_(sheet, headers, rows) {
  if (!rows || !rows.length) return;
  const data = rows.map(row => headers.map(header => row[header] ?? ''));
  const startRow = Math.max(sheet.getLastRow() + 1, 2);
  sheet.getRange(startRow, 1, data.length, headers.length).setValues(data);
}

function buildBaseRowKey_(row) {
  return [
    normalizeDateKey_(row?.DATA || ''),
    normalizeKey_(row?.CLASSE || ''),
    normalizeKey_(row?.ALUNO || ''),
  ].join('__');
}

function buildChamadaRowKey_(row) {
  return normalizeKey_(row?.ALUNO || '');
}

function upsertRowsInPlace_(sheetName, headers, existingRows, newRows, keyFn, options = {}) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  ensureHeaders_(sheet, headers);

  const currentRows = Array.isArray(existingRows) && existingRows.length
    ? existingRows
    : loadSheetObjects_(sheetName, headers);

  const dedupeDuplicates = !!options.dedupeDuplicates;
  const rowByKey = new Map();
  const duplicateRowNumbers = [];

  for (const row of currentRows) {
    const key = keyFn(row);
    if (!key) continue;

    if (dedupeDuplicates && rowByKey.has(key) && row._rowNumber) {
      duplicateRowNumbers.push(row._rowNumber);
      continue;
    }

    if (!rowByKey.has(key)) {
      rowByKey.set(key, row);
    }
  }

  if (dedupeDuplicates && duplicateRowNumbers.length) {
    duplicateRowNumbers
      .sort((a, b) => b - a)
      .forEach((rowNumber) => {
        sheet.deleteRow(rowNumber);
      });
  }

  for (const newRow of newRows || []) {
    const key = keyFn(newRow);
    if (!key) continue;

    const values = headers.map(header => newRow[header] ?? '');
    const existing = rowByKey.get(key);

    if (existing && existing._rowNumber) {
      sheet.getRange(existing._rowNumber, 1, 1, headers.length).setValues([values]);
    } else {
      const nextRow = Math.max(sheet.getLastRow() + 1, 2);
      sheet.getRange(nextRow, 1, 1, headers.length).setValues([values]);
      rowByKey.set(key, { _rowNumber: nextRow });
    }
  }
}

function upsertBaseRows_(sheetName, headers, existingRows, newRows) {
  upsertRowsInPlace_(sheetName, headers, existingRows, newRows, buildBaseRowKey_);
}

function upsertBaseRow_(sheetName, headers, existingRows, dateKey, className, alunoNome, newRow) {
  upsertRowsInPlace_(sheetName, headers, existingRows, [newRow], buildBaseRowKey_);
}

function upsertChamadaRow_(sheetName, headers, existingRows, dateKey, className, alunoNome, newRow) {
  upsertRowsInPlace_(sheetName, headers, existingRows, [newRow], buildChamadaRowKey_, { dedupeDuplicates: true });
}



function replaceRowsForDateClass_(sheetName, headers, existingRows, dateKey, className, newRows) {
  upsertRowsInPlace_(sheetName, headers, existingRows, newRows || [], buildChamadaRowKey_, { dedupeDuplicates: true });
}

function countDataRows_(sheetName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(sheetName);
  if (!sh) return 0;
  return Math.max(0, sh.getLastRow() - 1);
}

/* =========================
 * Utilidades
 * ========================= */

function normalizeDateKey_(value) {
  if (!value) return todayKey_();
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = parseIsoDate_(s);
  if (d) return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return todayKey_();
}

function sheetDateKey_(value) {
  if (!value) return '';
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  const s = String(value).trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = parseIsoDate_(s);
  return d ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd') : '';
}

function parseIsoDate_(value) {
  const s = String(value || '').trim();
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function todayKey_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function isAfterAutoCutoff_() {
  const now = new Date();
  const tz = Session.getScriptTimeZone();
  const hhmm = Utilities.formatDate(now, tz, 'HH:mm');
  const [hh, mm] = hhmm.split(':').map(Number);
  const minutes = (hh * 60) + mm;
  return minutes > AUTO_CUTOFF_MINUTES;
}

function digitsOnly_(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeKey_(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function onlyDigits_(value) {
  return digitsOnly_(value);
}

function toInt_(value) {
  const n = parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(n) ? n : 0;
}

function clampInt_(value, min, max) {
  const n = toInt_(value);
  const lower = Number.isFinite(min) ? Math.max(n, Math.floor(min)) : n;
  const upper = Number.isFinite(max) ? Math.min(lower, Math.floor(max)) : lower;
  return Number.isFinite(upper) ? upper : 0;
}

function countPresentesFromRows_(rows) {
  return (rows || []).reduce((count, row) => {
    if (!row) return count;
    const statusAluno = String(row.statusAluno || row.STATUS || 'ativo').trim().toLowerCase();
    if (statusAluno === 'inativo') return count;
    return count + (isPresentLikeValue_(row.presenca) ? 1 : 0);
  }, 0);
}

function toBool_(value) {
  const v = String(value ?? '').trim().toLowerCase();
  return ['1', 'true', 'sim', 'yes', 'y', 's'].includes(v);
}

function parseMoney_(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const s = String(value ?? '').trim();
  if (!s) return 0;
  const cleaned = s.replace(/[^\d,.-]/g, '');
  if (!cleaned) return 0;
  if (cleaned.includes(',') && cleaned.includes('.')) {
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    if (lastComma > lastDot) {
      return Number(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
    }
    return Number(cleaned.replace(/,/g, '')) || 0;
  }
  if (cleaned.includes(',')) return Number(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
  return Number(cleaned) || 0;
}

function formatMoneyBR_(value) {
  const n = parseMoney_(value || 0);
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatPercent_(value) {
  return `${Number(value || 0).toFixed(1).replace('.', ',')}%`;
}

function formatDateBR_(dateKey) {
  const d = parseIsoDate_(dateKey);
  if (!d) return String(dateKey || '');
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy');
}

function round1_(n) {
  return Math.round((Number(n || 0) + Number.EPSILON) * 10) / 10;
}



function buildMemorySeed_(dateKey, turmas, alunos, callsByTurma, resumoGeral) {
  const totalTurmas = Array.isArray(turmas) ? turmas.length : 0;
  const totalAlunos = Array.isArray(alunos) ? alunos.length : 0;
  const totalPresentes = Number(resumoGeral?.presentes || 0);
  const totalAusentes = Number(resumoGeral?.ausentes || 0);
  const totalAtrasos = Number(resumoGeral?.atrasos || 0);

  return {
    project: 'EBD',
    source: 'Apps Script backend',
    handoff: [
      'Consulte esta memória antes de responder a perguntas repetidas sobre o projeto.',
      'A base oficial continua sendo Google Sheets via Apps Script; a UI só mantém rascunhos e cache local.',
      'As decisões e regras do projeto devem ficar em documentos curtos e versionáveis.',
    ].join('\n\n'),
    decisions: [
      {
        key: 'data-source-google-sheets',
        title: 'Fonte oficial de dados',
        body: [
          'A fonte oficial do projeto continua sendo o Google Sheets acessado pelo backend em Apps Script.',
          'A interface não deve criar uma segunda fonte de verdade para turmas, alunos ou chamadas.',
        ].join('\n'),
        meta: { dateKey },
      },
      {
        key: 'drafts-localstorage',
        title: 'Rascunhos locais no navegador',
        body: [
          'Os rascunhos de chamada e caches auxiliares ficam no localStorage do navegador.',
          'Isso evita perda de edição durante o preenchimento da chamada, mas não substitui o salvamento no backend.',
        ].join('\n'),
        meta: { dateKey },
      },
    ],
    procedures: [
      {
        key: 'salvar-chamada',
        title: 'Salvar chamada do dia',
        body: [
          'Selecionar a data atual.',
          'Marcar todos os alunos com presença, ausência ou atraso.',
          'Preencher oferta, visitantes, bíblias e revistas quando necessário.',
          'Salvar a chamada somente depois que todas as linhas estiverem concluídas.',
        ].join('\n'),
        meta: { dateKey },
      },
      {
        key: 'atualizar-dados',
        title: 'Atualizar dados do backend',
        body: [
          'Usar a ação de recarregar quando for necessário buscar o estado mais recente da planilha.',
          'O carregamento inicial já sincroniza turmas, alunos, chamadas e resumo geral.',
        ].join('\n'),
        meta: { dateKey },
      },
    ],
    gotchas: [
      {
        key: 'salvar-bloqueado-linhas-incompletas',
        title: 'Salvamento bloqueado por linha incompleta',
        body: [
          'Se houver aluno sem presença, ausência ou atraso marcado, o backend rejeita o salvamento.',
          'Essa trava evita registrar uma chamada parcialmente preenchida como se estivesse concluída.',
        ].join('\n'),
        meta: { dateKey },
      },
      {
        key: 'data-pasada-bloqueia-salvar',
        title: 'Data fora do dia atual',
        body: [
          'A interface bloqueia o salvamento quando a data selecionada não é a data de hoje.',
          'Isso protege o fluxo operacional da chamada diária.',
        ].join('\n'),
        meta: { dateKey },
      },
    ],
    rules: [
      {
        key: 'health-endpoint',
        title: 'Endpoint de saúde',
        body: [
          'O backend expõe a ação health para conferência rápida de disponibilidade.',
          'Esse endpoint deve continuar simples e sempre acessível.',
        ].join('\n'),
        meta: { dateKey },
      },
      {
        key: 'presenca-total-marked',
        title: 'Chamada completa antes de salvar',
        body: [
          'Toda chamada precisa ter cada aluno com status explícito antes do envio.',
          'Presentes e atrasados contam como presença; ausente deve permanecer separado.',
          `Resumo atual: ${totalTurmas} turmas, ${totalAlunos} alunos, ${totalPresentes} presentes, ${totalAusentes} ausentes, ${totalAtrasos} atrasos.`,
        ].join('\n'),
        meta: { dateKey },
      },
    ],
    sessions: [
      {
        key: `snapshot-${dateKey}`,
        title: `Snapshot da sincronização (${dateKey})`,
        body: [
          `Turmas carregadas: ${totalTurmas}.`,
          `Alunos carregados: ${totalAlunos}.`,
          `Chamadas em cache: ${Object.keys(callsByTurma || {}).length}.`,
        ].join('\n'),
        meta: { dateKey },
      },
    ],
  };
}
function backendHealth_() {
  return {
    ok: true,
    message: 'ok',
    version: BACKEND_VERSION,
    deployedAt: BACKEND_DEPLOYED_AT,
  };
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function buildHeaderIndexMap_(actualHeaders, expectedHeaders) {
  const map = new Map();
  const normalizedActual = (actualHeaders || []).map(h => normalizeKey_(h));
  for (let i = 0; i < normalizedActual.length; i++) {
    map.set(normalizedActual[i], i);
  }
  // Garante que cabeçalhos esperados também sejam resolvidos mesmo se a linha estiver vazia.
  for (const h of expectedHeaders || []) {
    if (!map.has(normalizeKey_(h))) {
      map.set(normalizeKey_(h), undefined);
    }
  }
  return map;
}

function buildAlunoId_(nome, classe, celular) {
  const celularTail = String(celular || '').slice(-4);
  return normalizeKey_(`${classe}__${nome}__${celularTail || ''}`);
}

function findCadastroByCelularSuffix_(cadastroRows, suffix) {
  const s = digitsOnly_(suffix).slice(0, 4);
  const matches = (cadastroRows || []).filter(r => digitsOnly_(r.CELULAR || '').slice(-4) === s);
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    // Prioriza correspondência exata dos 4 últimos dígitos; se houver mais de uma, retorna a primeira.
    return matches[0];
  }
  return null;
}


function findCadastroAlunoByIdentifier_(cadastroRows, identifier) {
  const target = normalizeKey_(identifier);
  const digits = digitsOnly_(identifier);

  for (const row of cadastroRows || []) {
    const nome = String(row.ALUNO || '').trim();
    const classe = String(row.CLASSE || '').trim();
    const celular = digitsOnly_(row.CELULAR || '');
    const alunoId = buildAlunoId_(nome, classe, celular);

    if (
      normalizeKey_(nome) === target ||
      normalizeKey_(alunoId) === target ||
      (digits && celular && celular === digits)
    ) {
      return row;
    }
  }

  return null;
}


function looksLikeAlunoUpdate_(p) {
  if (!p) return false;
  const hasAlunoId = Object.prototype.hasOwnProperty.call(p, 'alunoId') && String(p.alunoId || '').trim() !== '';
  if (hasAlunoId) return true;
  const hasNome = Object.prototype.hasOwnProperty.call(p, 'nome') && String(p.nome || '').trim() !== '';
  const hasTurma = Object.prototype.hasOwnProperty.call(p, 'turmaId') && String(p.turmaId || '').trim() !== '';
  return hasNome && hasTurma;
}

function getCallLevelValue_(rows, field, asNumber = false) {
  if (!rows || !rows.length) return asNumber ? 0 : '';

  // CORREÇÃO: percorre todas as linhas da turma em busca do primeiro valor
  // não-zero/não-vazio.
  //
  // Contexto: oferta/visitantes/bíblias/revistas são campos de nível de turma
  // — são replicados em todas as linhas dos alunos. Porém, em cenários de
  // atualização parcial (ex.: linhas salvas em momentos diferentes), algumas
  // linhas podem ter ficado com o valor zerado enquanto outras já têm o valor
  // correto. Depender apenas do primeiro aluno encontrado fazia o frontend
  // ignorar o valor real e montar a turma com 0.
  for (const row of rows) {
    const v = row[field];
    if (asNumber) {
      const n = toInt_(v);
      if (n > 0) return n;
    } else {
      // Para OFERTA (string/número), compara o valor monetário.
      if (parseMoney_(v) > 0) return v;
    }
  }

  // Nenhuma linha tem valor > 0; retorna o valor da primeira linha (zero/vazio).
  const first = rows[0];
  return asNumber ? toInt_(first[field]) : (first[field] ?? '');
}

function isPresentLikeValue_(value) {
  const v = String(value || '').trim().toLowerCase();
  return ['sim', 'presente', '1', 'true', 'p'].includes(v) || v === 'atrasado';
}

function isDelayedValue_(value) {
  const v = String(value || '').trim().toLowerCase();
  return ['atrasado', 'atrasada', 'late', 'delay'].includes(v);
}

function resolveDateParts_(dateKey) {
  const d = parseIsoDate_(dateKey) || new Date();
  return {
    year: d.getFullYear(),
    month: String(d.getMonth() + 1).padStart(2, '0'),
  };
}
