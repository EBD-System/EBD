(function () {
  if (window.FakeDatabase) return;

  const STORAGE_KEY = 'prb_fake_database_v1';
  const SEED_URL = (typeof EXAMPLE_DB_URL !== 'undefined' && EXAMPLE_DB_URL) || window.EXAMPLE_DB_URL || 'backend/exampleDb.json';
  const STATUS_VALUES = new Set(['ativo', 'inativo', 'transferido', 'falecido']);
  const ACCESS = {
    active: 'ativo',
    inactive: 'inativo',
  };

  let seedPromise = null;
  let statePromise = null;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function safeClone(value) {
    try {
      return clone(value);
    } catch (err) {
      return value;
    }
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function trimText(value) {
    return String(value ?? '').trim();
  }

  function lowerText(value) {
    return trimText(value).toLowerCase();
  }

  function normalizeBool(value) {
    const text = lowerText(value);
    return text === '1' || text === 'true' || text === 'sim' || text === 'yes';
  }

  function normalizePresence(value) {
    const text = lowerText(value);
    if (['atrasado', 'atrasada', 'late', 'delay'].includes(text)) return 'atrasado';
    if (['presente', 'sim', '1', 'true', 'p', 'present'].includes(text)) return 'presente';
    return 'ausente';
  }

  function formatMoney(value) {
    const number = Number(value || 0);
    if (!Number.isFinite(number)) return '0.00';
    return number.toFixed(2);
  }

  function readStore() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    } catch (err) {
      return null;
    }
  }

  function writeStore(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function hasAnyTableRows(tables) {
    if (!tables || typeof tables !== 'object') return false;
    return Object.values(tables).some((rows) => Array.isArray(rows) && rows.length > 0);
  }

  async function loadSeed() {
    if (!seedPromise) {
      seedPromise = fetch(SEED_URL, { cache: 'no-store' })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Falha ao carregar seed fake: HTTP ${response.status}`);
          }
          return response.json();
        })
        .catch((err) => {
          console.warn('[FakeDatabase] seed fallback offline', err);
          return {
            version: 1,
            generatedFrom: 'fallback-seed',
            generatedAt: nowIso(),
            tables: {},
            meta: {},
          };
        });
    }
    return seedPromise;
  }

  function ensureTables(seed) {
    const tables = seed && typeof seed.tables === 'object' ? seed.tables : {};
    const next = {};
    Object.keys(tables).forEach((name) => {
      next[name] = Array.isArray(tables[name]) ? clone(tables[name]) : [];
    });

    [
      'ebd_pessoa',
      'ebd_aluno',
      'ebd_aluno_classe',
      'ebd_aluno_status_historico',
      'ebd_classe',
      'ebd_funcao',
      'ebd_perfil',
      'ebd_pessoa_funcao',
      'ebd_usuario',
      'ebd_usuario_perfil',
      'ebd_chamada',
      'ebd_chamada_aluno',
      'ebd_chamada_visitante',
    ].forEach((name) => {
      if (!Array.isArray(next[name])) next[name] = [];
    });

    return next;
  }

  function nextId(rows, field) {
    return rows.reduce((max, row) => {
      const value = Number(row?.[field] || 0);
      return Number.isFinite(value) && value > max ? value : max;
    }, 0) + 1;
  }

  function getTable(state, name) {
    if (!state.tables[name]) state.tables[name] = [];
    return state.tables[name];
  }

  function buildIndex(state) {
    const index = {
      classeById: new Map(),
      pessoaById: new Map(),
      alunoById: new Map(),
      alunoClassById: new Map(),
      alunoClassByAlunoId: new Map(),
      alunoClassByClassId: new Map(),
      chamadaById: new Map(),
      chamadaByDateTurma: new Map(),
      chamadaAlunoByChamadaId: new Map(),
      chamadaVisitanteByChamadaId: new Map(),
    };

    getTable(state, 'ebd_classe').forEach((row) => index.classeById.set(String(row.id_classe), row));
    getTable(state, 'ebd_pessoa').forEach((row) => index.pessoaById.set(String(row.id_pessoa), row));
    getTable(state, 'ebd_aluno').forEach((row) => index.alunoById.set(String(row.id_aluno), row));
    getTable(state, 'ebd_aluno_classe').forEach((row) => {
      index.alunoClassById.set(String(row.id_aluno_classe), row);
      index.alunoClassByAlunoId.set(String(row.id_aluno), row);
      const key = String(row.id_classe);
      if (!index.alunoClassByClassId.has(key)) index.alunoClassByClassId.set(key, []);
      index.alunoClassByClassId.get(key).push(row);
    });
    getTable(state, 'ebd_chamada').forEach((row) => {
      index.chamadaById.set(String(row.id_chamada), row);
      index.chamadaByDateTurma.set(`${row.data_chamada}|${row.id_classe}`, row);
    });
    getTable(state, 'ebd_chamada_aluno').forEach((row) => {
      const key = String(row.id_chamada);
      if (!index.chamadaAlunoByChamadaId.has(key)) index.chamadaAlunoByChamadaId.set(key, []);
      index.chamadaAlunoByChamadaId.get(key).push(row);
    });
    getTable(state, 'ebd_chamada_visitante').forEach((row) => {
      const key = String(row.id_chamada);
      if (!index.chamadaVisitanteByChamadaId.has(key)) index.chamadaVisitanteByChamadaId.set(key, []);
      index.chamadaVisitanteByChamadaId.get(key).push(row);
    });

    index.state = state;
    return index;
  }

  function loadRuntimeState(seed) {
    const stored = readStore();
    const seedHasData = hasAnyTableRows(seed?.tables);
    const storedHasData = hasAnyTableRows(stored?.tables);

    if (stored && stored.version === 1 && stored.tables && storedHasData && (!seedHasData || stored.seedVersion === seed?.version)) {
      return {
        version: 1,
        seedVersion: seed?.version || 1,
        generatedFrom: seed?.generatedFrom || 'seed',
        generatedAt: seed?.generatedAt || nowIso(),
        tables: ensureTables({ tables: stored.tables }),
        callsByDate: stored.callsByDate && typeof stored.callsByDate === 'object' ? stored.callsByDate : {},
      };
    }

    return {
      version: 1,
      seedVersion: seed?.version || 1,
      generatedFrom: seed?.generatedFrom || 'seed',
      generatedAt: seed?.generatedAt || nowIso(),
      tables: ensureTables(seed),
      callsByDate: {},
    };
  }

  function saveRuntimeState(state) {
    writeStore({
      version: state.version,
      seedVersion: state.seedVersion,
      generatedFrom: state.generatedFrom,
      generatedAt: state.generatedAt,
      tables: state.tables,
      callsByDate: state.callsByDate,
    });
  }

  async function ensureState() {
    if (!statePromise) {
      statePromise = loadSeed().then((seed) => loadRuntimeState(seed));
    }
    return statePromise;
  }

  function getDateBucket(state, dateKey) {
    const key = trimText(dateKey || todayKey());
    if (!state.callsByDate[key]) {
      state.callsByDate[key] = {
        dateKey: key,
        updatedAt: nowIso(),
        callsByTurma: {},
      };
    }
    return state.callsByDate[key];
  }

  function getCurrentClassRow(index, alunoId) {
    const rows = getTable(index.state, 'ebd_aluno_classe')
      .filter((row) => String(row.id_aluno) === String(alunoId))
      .sort((a, b) => Number(b.ativo) - Number(a.ativo) || String(b.data_inicio || '').localeCompare(String(a.data_inicio || '')) || Number(b.id_aluno_classe) - Number(a.id_aluno_classe));
    return rows.find((row) => normalizeBool(row.ativo)) || rows[0] || null;
  }

  function getLatestClassName(index, alunoId) {
    const row = getCurrentClassRow(index, alunoId);
    if (!row) return '';
    return index.classeById.get(String(row.id_classe))?.nome || '';
  }

  function getCurrentActiveCallRows(state, dateKey, turmaId) {
    const bucket = state.callsByDate[trimText(dateKey)];
    const call = bucket?.callsByTurma?.[String(turmaId)] || null;
    return Array.isArray(call?.rows) ? call.rows : [];
  }

  function getAllSavedCalls(state) {
    const calls = [];
    Object.values(state.callsByDate || {}).forEach((bucket) => {
      Object.values(bucket.callsByTurma || {}).forEach((call) => {
        if (call) calls.push(call);
      });
    });
    return calls.sort((a, b) => String(a.data || '').localeCompare(String(b.data || '')) || String(a.turmaId || '').localeCompare(String(b.turmaId || '')));
  }

  function computeStudentStats(state, index, aluno, currentClassRow) {
    const alunoId = String(aluno.id_aluno);
    const classId = String(currentClassRow?.id_classe || '');
    const relevantCalls = getAllSavedCalls(state).filter((call) => String(call.turmaId || '') === classId);
    const occurrences = relevantCalls
      .map((call) => {
        const row = (call.rows || []).find((item) => String(item.alunoId || '') === alunoId);
        return row ? normalizePresence(row.presenca) : null;
      })
      .filter(Boolean);

    const totalFaltas = occurrences.filter((v) => v === 'ausente').length;
    const presentes = occurrences.filter((v) => v === 'presente').length;
    const atrasados = occurrences.filter((v) => v === 'atrasado').length;
    const total = occurrences.length;
    let consecutivas = 0;
    for (let i = occurrences.length - 1; i >= 0; i -= 1) {
      if (occurrences[i] === 'ausente') consecutivas += 1;
      else break;
    }

    const activeStatus = String(aluno.status || ACCESS.active).toLowerCase();
    const reativado = getTable(state, 'ebd_aluno_status_historico').some((row) => String(row.id_aluno) === alunoId && String(row.status_anterior || '').toLowerCase() === 'inativo' && String(row.status_novo || '').toLowerCase() === 'ativo');

    return {
      Percentual: total ? Math.round(((presenteCount(presentes, atrasados)) / total) * 1000) / 10 : 0,
      TotalFaltas: totalFaltas,
      FaltasConsecutivas: consecutivas,
      FaltandoMuito: consecutivas >= 4 || totalFaltas >= 4 ? 'sim' : 'nao',
      Reativado: reativado ? 'sim' : 'nao',
      RealocadoDe: getPreviousClassName(state, index, alunoId, currentClassRow?.id_aluno_classe),
      Ativo: activeStatus === ACCESS.inactive ? 'nao' : 'sim',
      _presenceCounts: { presentes, atrasados, total },
    };
  }

  function presenteCount(presentes, atrasados) {
    return presentes + atrasados;
  }

  function getPreviousClassName(state, index, alunoId, currentAlunoClassId) {
    const rows = getTable(state, 'ebd_aluno_classe')
      .filter((row) => String(row.id_aluno) === String(alunoId))
      .sort((a, b) => String(b.data_inicio || '').localeCompare(String(a.data_inicio || '')) || Number(b.id_aluno_classe) - Number(a.id_aluno_classe));

    const previous = rows.find((row) => String(row.id_aluno_classe) !== String(currentAlunoClassId) && !normalizeBool(row.ativo)) || rows.find((row) => String(row.id_aluno_classe) !== String(currentAlunoClassId));
    if (!previous) return '';
    return index.classeById.get(String(previous.id_classe))?.nome || '';
  }

  function buildTurmaRow(state, index, classe) {
    const classId = String(classe.id_classe);
    const activeClassRows = getTable(state, 'ebd_aluno_classe').filter((row) => String(row.id_classe) === classId && normalizeBool(row.ativo));
    const activeCount = activeClassRows.filter((row) => String(index.alunoById.get(String(row.id_aluno))?.status || ACCESS.active).toLowerCase() !== ACCESS.inactive).length;
    const inactiveCount = getTable(state, 'ebd_aluno').filter((aluno) => {
      const current = getCurrentClassRow(index, aluno.id_aluno);
      return String(current?.id_classe || '') === classId && String(aluno.status || '').toLowerCase() === ACCESS.inactive;
    }).length;

    return {
      TurmaID: classId,
      Nome: classe.nome,
      Ordem: Number(classe.id_classe) || 0,
      Ativo: classe.ativo === false ? 'nao' : 'sim',
      alunosAtivos: activeCount,
      alunosInativos: inactiveCount,
      totalAlunos: activeCount + inactiveCount,
    };
  }

  function buildAlunoRow(state, index, aluno) {
    const pessoa = index.pessoaById.get(String(aluno.id_pessoa)) || {};
    const currentClassRow = getCurrentClassRow({ state }, aluno.id_aluno);
    const turma = currentClassRow ? index.classeById.get(String(currentClassRow.id_classe)) : null;
    const stats = computeStudentStats(state, index, aluno, currentClassRow);

    return {
      AlunoID: String(aluno.id_aluno),
      Nome: pessoa.nome || `Aluno ${aluno.id_aluno}`,
      TurmaID: currentClassRow ? String(currentClassRow.id_classe) : '',
      TurmaNome: turma?.nome || '',
      Status: String(aluno.status || ACCESS.active).toLowerCase(),
      Ativo: String(aluno.status || ACCESS.active).toLowerCase() === ACCESS.inactive ? 'nao' : 'sim',
      FaltandoMuito: stats.FaltandoMuito,
      Reativado: stats.Reativado,
      RealocadoDe: stats.RealocadoDe,
      Percentual: stats.Percentual,
      TotalFaltas: stats.TotalFaltas,
      FaltasConsecutivas: stats.FaltasConsecutivas,
      Celular: pessoa.telefone || '',
      DataNascimento: pessoa.data_nascimento || '',
      Mensagem: aluno.observacao || pessoa.observacao || '',
    };
  }

  function buildInactiveStudentRow(state, index, aluno) {
    const pessoa = index.pessoaById.get(String(aluno.id_pessoa)) || {};
    const currentClassRow = getCurrentClassRow({ state }, aluno.id_aluno);
    const turma = currentClassRow ? index.classeById.get(String(currentClassRow.id_classe)) : null;
    return {
      AlunoID: String(aluno.id_aluno),
      Nome: pessoa.nome || `Aluno ${aluno.id_aluno}`,
      TurmaID: currentClassRow ? String(currentClassRow.id_classe) : '',
      TurmaNome: turma?.nome || '',
      Motivo: aluno.motivo_desligamento || aluno.observacao || '',
      motivo_desligamento: aluno.motivo_desligamento || '',
      observacao: aluno.observacao || '',
      Status: 'inativo',
      Ativo: 'nao',
      data_desligamento: aluno.data_desligamento || '',
      data_inicio: currentClassRow?.data_inicio || '',
    };
  }

  function buildCallRows(state, index, turmaId, callRecord) {
    const classId = String(turmaId);
    const roster = getTable(state, 'ebd_aluno_classe').filter((row) => String(row.id_classe) === classId && normalizeBool(row.ativo));
    const rowsByAluno = new Map((callRecord?.rows || []).map((row) => [String(row.alunoId || ''), row]));

    return roster.map((row) => {
      const aluno = index.alunoById.get(String(row.id_aluno));
      const pessoa = aluno ? index.pessoaById.get(String(aluno.id_pessoa)) : null;
      const saved = rowsByAluno.get(String(row.id_aluno)) || {};
      const presence = normalizePresence(saved.presenca || saved.status || 'ausente');
      const atraso = presence === 'atrasado' || normalizeBool(saved.atraso);
      return {
        alunoId: String(row.id_aluno),
        nome: pessoa?.nome || '',
        codigo: aluno?.matricula || '',
        ordemCadastro: aluno?.matricula || '',
        presenca: presence,
        atraso,
        salvo: 1,
        SALVO: 1,
        observacao: saved.observacao || '',
        statusAluno: String(aluno?.status || ACCESS.active).toLowerCase(),
      };
    });
  }

  function buildSavedCall(state, index, bucketDateKey, turma, callRow) {
    const rows = buildCallRows(state, index, turma.id_classe, callRow);
    const activeRows = rows.filter((row) => String(row.statusAluno || ACCESS.active).toLowerCase() !== ACCESS.inactive);
    const presentes = activeRows.filter((row) => normalizePresence(row.presenca) !== 'ausente').length;
    const atrasos = activeRows.filter((row) => normalizePresence(row.presenca) === 'atrasado').length;
    const ausentes = activeRows.filter((row) => normalizePresence(row.presenca) === 'ausente').length;
    const percentual = activeRows.length ? (presentes / activeRows.length) * 100 : 0;
    return {
      chamadaId: String(callRow.id_chamada),
      data: String(callRow.data_chamada),
      turmaId: String(turma.id_classe),
      turmaNome: turma.nome,
      oferta: Number(callRow.oferta || 0),
      visitantes: getTable(state, 'ebd_chamada_visitante').filter((row) => String(row.id_chamada) === String(callRow.id_chamada)).length,
      biblias: Number(callRow.biblias || 0),
      revistas: Number(callRow.revistas || 0),
      totalAlunos: activeRows.length,
      presentes,
      atrasos,
      ausentes,
      percentual,
      enviadoTelegram: false,
      telegramEnviadoEm: '',
      rows,
      isSaved: true,
      savedAt: callRow.criado_em || nowIso(),
      syncStatus: 'synced',
      bucketDateKey,
    };
  }

  function buildCallFromSavedRows(state, index, turma, dateKey, rows, extra = {}) {
    const activeRows = rows.filter((row) => String(row.statusAluno || ACCESS.active).toLowerCase() !== ACCESS.inactive);
    const presentes = activeRows.filter((row) => normalizePresence(row.presenca) !== 'ausente').length;
    const atrasos = activeRows.filter((row) => normalizePresence(row.presenca) === 'atrasado').length;
    const ausentes = activeRows.filter((row) => normalizePresence(row.presenca) === 'ausente').length;
    const percentual = activeRows.length ? (presentes / activeRows.length) * 100 : 0;
    return {
      chamadaId: `${dateKey}_${turma.TurmaID}`,
      data: dateKey,
      turmaId: String(turma.TurmaID),
      turmaNome: turma.Nome,
      oferta: Number(extra.oferta || 0),
      visitantes: Number(extra.visitantes || 0),
      biblias: Number(extra.biblias || 0),
      revistas: Number(extra.revistas || 0),
      totalAlunos: activeRows.length,
      presentes,
      atrasos,
      ausentes,
      percentual,
      enviadoTelegram: false,
      telegramEnviadoEm: '',
      rows,
      isSaved: true,
      savedAt: nowIso(),
      syncStatus: 'synced',
    };
  }

  function buildCurrentCall(state, index, turma, dateKey) {
    const bucket = getDateBucket(state, dateKey);
    const existing = bucket.callsByTurma[String(turma.id_classe)] || null;
    if (existing) return safeClone(existing);

    const roster = getTable(state, 'ebd_aluno_classe').filter((row) => String(row.id_classe) === String(turma.id_classe) && normalizeBool(row.ativo));
    return {
      chamadaId: `${dateKey}_${turma.id_classe}`,
      data: dateKey,
      turmaId: String(turma.id_classe),
      turmaNome: turma.nome,
      oferta: 0,
      visitantes: 0,
      biblias: 0,
      revistas: 0,
      totalAlunos: roster.filter((row) => String(index.alunoById.get(String(row.id_aluno))?.status || ACCESS.active).toLowerCase() !== ACCESS.inactive).length,
      presentes: 0,
      atrasos: 0,
      ausentes: roster.length,
      percentual: 0,
      enviadoTelegram: false,
      telegramEnviadoEm: '',
      rows: roster.map((row) => {
        const aluno = index.alunoById.get(String(row.id_aluno)) || {};
        const pessoa = index.pessoaById.get(String(aluno.id_pessoa)) || {};
        return {
          alunoId: String(row.id_aluno),
          nome: pessoa.nome || '',
          codigo: aluno.matricula || '',
          ordemCadastro: aluno.matricula || '',
          presenca: 'ausente',
          atraso: false,
          salvo: 0,
          SALVO: 0,
          observacao: '',
          statusAluno: String(aluno.status || ACCESS.active).toLowerCase(),
        };
      }),
      isSaved: false,
    };
  }

  function buildResumoGeral(state, index, dateKey) {
    const classes = getTable(state, 'ebd_classe').filter((row) => row.ativo !== false);
    const calls = Object.values(getDateBucket(state, dateKey).callsByTurma || {});
    const activeStudents = getTable(state, 'ebd_aluno').filter((aluno) => String(aluno.status || '').toLowerCase() !== ACCESS.inactive);

    const turmaSummaries = classes.map((classe) => {
      const roster = getTable(state, 'ebd_aluno_classe').filter((row) => String(row.id_classe) === String(classe.id_classe) && normalizeBool(row.ativo));
      const activeRoster = roster.filter((row) => String(index.alunoById.get(String(row.id_aluno))?.status || ACCESS.active).toLowerCase() !== ACCESS.inactive);
      const call = calls.find((item) => String(item.turmaId) === String(classe.id_classe)) || null;
      const callRows = Array.isArray(call?.rows) ? call.rows : [];
      const presentes = callRows.filter((row) => normalizePresence(row.presenca) !== 'ausente').length;
      const atrasados = callRows.filter((row) => normalizePresence(row.presenca) === 'atrasado').length;
      const ausentes = callRows.filter((row) => normalizePresence(row.presenca) === 'ausente').length;
      const percentual = activeRoster.length ? (presentes / activeRoster.length) * 100 : 0;
      return {
        id_classe: String(classe.id_classe),
        nome: classe.nome,
        totalAlunos: activeRoster.length,
        presentes,
        atrasos: atrasados,
        ausentes,
        percentual,
        oferta: call ? formatMoney(call.oferta) : '0.00',
        visitantes: Number(call?.visitantes || 0),
        biblias: Number(call?.biblias || 0),
        revistas: Number(call?.revistas || 0),
      };
    });

    const allStudentRows = activeStudents.map((aluno) => {
      const currentClassRow = getCurrentClassRow({ state }, aluno.id_aluno);
      return buildAlunoRow(state, index, aluno, currentClassRow);
    });

    const inativos = getTable(state, 'ebd_aluno')
      .filter((aluno) => String(aluno.status || '').toLowerCase() === ACCESS.inactive)
      .map((aluno) => buildInactiveStudentRow(state, index, aluno));

    const melhores = allStudentRows
      .filter((aluno) => Number(aluno.Percentual || 0) > 0)
      .sort((a, b) => Number(b.Percentual || 0) - Number(a.Percentual || 0) || String(a.Nome || '').localeCompare(String(b.Nome || '')))
      .slice(0, 3);

    const faltandoMuito = allStudentRows.filter((aluno) => String(aluno.FaltandoMuito || '').toLowerCase() === 'sim');
    const reativados = allStudentRows.filter((aluno) => String(aluno.Reativado || '').toLowerCase() === 'sim');

    const presentes = calls.reduce((acc, call) => acc + (call.rows || []).filter((row) => normalizePresence(row.presenca) !== 'ausente').length, 0);
    const atrasos = calls.reduce((acc, call) => acc + (call.rows || []).filter((row) => normalizePresence(row.presenca) === 'atrasado').length, 0);
    const ausentes = calls.reduce((acc, call) => acc + (call.rows || []).filter((row) => normalizePresence(row.presenca) === 'ausente').length, 0);
    const ofertaTotal = calls.reduce((acc, call) => acc + Number(call.oferta || 0), 0);
    const visitantesTotal = calls.reduce((acc, call) => acc + Number(call.visitantes || 0), 0);
    const bibliasTotal = calls.reduce((acc, call) => acc + Number(call.biblias || 0), 0);
    const revistasTotal = calls.reduce((acc, call) => acc + Number(call.revistas || 0), 0);
    const totalAlunos = activeStudents.length;
    const percentual = totalAlunos ? (presentes / totalAlunos) * 100 : 0;

    return {
      turmasSalvas: calls.length,
      totalTurmas: classes.length,
      totalAlunos,
      presentes,
      atrasos,
      ausentes,
      neutros: Math.max(totalAlunos - calls.reduce((acc, call) => acc + (call.rows || []).length, 0), 0),
      percentual,
      ofertaTotal,
      visitantesTotal,
      bibliasTotal,
      revistasTotal,
      turmaSummaries,
      melhores,
      inativos,
      faltandoMuito,
      reativados,
    };
  }

  function saveCallSnapshot(state, dateKey, turmaId, call) {
    const bucket = getDateBucket(state, dateKey);
    bucket.callsByTurma[String(turmaId)] = safeClone(call);
    bucket.updatedAt = nowIso();
    saveRuntimeState(state);
    return bucket;
  }

  function removeAluno(state, alunoId) {
    const alunoKey = String(alunoId || '').trim();
    const aluno = getTable(state, 'ebd_aluno').find((row) => String(row.id_aluno) === alunoKey || String(row.id_pessoa) === alunoKey);
    if (!aluno) return null;
    aluno.status = ACCESS.inactive;
    aluno.data_desligamento = todayKey();
    aluno.motivo_desligamento = 'Exclusão no modo fake';
    aluno.observacao = aluno.observacao || 'Removido pelo modo fake';
    getTable(state, 'ebd_aluno_classe').forEach((row) => {
      if (String(row.id_aluno) === String(aluno.id_aluno) && normalizeBool(row.ativo)) {
        row.ativo = false;
        row.data_fim = todayKey();
      }
    });
    getTable(state, 'ebd_aluno_status_historico').push({
      id_aluno_status_historico: nextId(getTable(state, 'ebd_aluno_status_historico'), 'id_aluno_status_historico'),
      id_aluno: aluno.id_aluno,
      status_anterior: 'ativo',
      status_novo: 'inativo',
      origem: 'manual',
      motivo: 'Exclusão no modo fake',
      observacao: aluno.observacao || '',
      id_chamada: null,
      id_chamada_aluno: null,
      criado_em: nowIso(),
      criado_por: 'fake-db',
    });
    return aluno;
  }

  function updateAluno(state, alunoId, payload) {
    const alunoKey = String(alunoId || '').trim();
    const aluno = getTable(state, 'ebd_aluno').find((row) => String(row.id_aluno) === alunoKey || String(row.id_pessoa) === alunoKey || lowerText(row.matricula) === lowerText(alunoKey));
    if (!aluno) return null;
    const pessoa = getTable(state, 'ebd_pessoa').find((row) => String(row.id_pessoa) === String(aluno.id_pessoa));
    const currentClassRow = getCurrentClassRow({ state }, aluno.id_aluno);
    const targetTurmaId = String(payload.turmaId || currentClassRow?.id_classe || '').trim();

    if (pessoa) {
      if (payload.nome) pessoa.nome = trimText(payload.nome);
      if (payload.celular !== undefined) pessoa.telefone = trimText(payload.celular).replace(/\D/g, '').slice(0, 11);
      if (payload.dataNascimento) pessoa.data_nascimento = trimText(payload.dataNascimento);
    }

    if (payload.status) {
      aluno.status = STATUS_VALUES.has(lowerText(payload.status)) ? lowerText(payload.status) : aluno.status;
      if (aluno.status === ACCESS.inactive) {
        aluno.data_desligamento = todayKey();
        aluno.motivo_desligamento = aluno.motivo_desligamento || 'Atualização no modo fake';
      } else {
        aluno.data_desligamento = null;
        aluno.motivo_desligamento = '';
      }
    }

    if (targetTurmaId && currentClassRow && String(currentClassRow.id_classe) !== targetTurmaId) {
      currentClassRow.ativo = false;
      currentClassRow.data_fim = todayKey();
      const newClassRow = {
        id_aluno_classe: nextId(getTable(state, 'ebd_aluno_classe'), 'id_aluno_classe'),
        id_aluno: aluno.id_aluno,
        id_classe: Number(targetTurmaId),
        data_inicio: todayKey(),
        data_fim: null,
        motivo: 'Movido no modo fake',
        ativo: true,
      };
      getTable(state, 'ebd_aluno_classe').push(newClassRow);
    }

    if (payload.status === 'ativo') {
      aluno.status = 'ativo';
      aluno.data_desligamento = null;
      aluno.motivo_desligamento = '';
    }

    return aluno;
  }

  function addAluno(state, payload) {
    const nome = trimText(payload.nome);
    const turmaId = Number(payload.turmaId);
    if (!nome || !Number.isFinite(turmaId)) return null;

    const pessoaId = nextId(getTable(state, 'ebd_pessoa'), 'id_pessoa');
    const alunoId = nextId(getTable(state, 'ebd_aluno'), 'id_aluno');
    const matricula = `ALU${String(alunoId).padStart(4, '0')}`;

    getTable(state, 'ebd_pessoa').push({
      id_pessoa: pessoaId,
      nome,
      sexo: 'nao_informado',
      cpf: '',
      data_nascimento: trimText(payload.dataNascimento) || null,
      telefone: trimText(payload.celular).replace(/\D/g, '').slice(0, 11),
      email: '',
      logradouro: '',
      numero: '',
      bairro: '',
      cidade: '',
      uf: '',
      cep: '',
      observacao: '',
      criado_em: nowIso(),
      atualizado_em: nowIso(),
    });

    getTable(state, 'ebd_aluno').push({
      id_aluno: alunoId,
      id_pessoa: pessoaId,
      matricula,
      status: 'ativo',
      data_cadastro: todayKey(),
      data_desligamento: null,
      motivo_desligamento: '',
      observacao: '',
    });

    getTable(state, 'ebd_aluno_classe').push({
      id_aluno_classe: nextId(getTable(state, 'ebd_aluno_classe'), 'id_aluno_classe'),
      id_aluno: alunoId,
      id_classe: turmaId,
      data_inicio: todayKey(),
      data_fim: null,
      motivo: 'Matriculado no modo fake',
      ativo: true,
    });

    getTable(state, 'ebd_aluno_status_historico').push({
      id_aluno_status_historico: nextId(getTable(state, 'ebd_aluno_status_historico'), 'id_aluno_status_historico'),
      id_aluno: alunoId,
      status_anterior: null,
      status_novo: 'ativo',
      origem: 'manual',
      motivo: '',
      observacao: 'Matriculado no modo fake',
      id_chamada: null,
      id_chamada_aluno: null,
      criado_em: nowIso(),
      criado_por: 'fake-db',
    });

    return { alunoId, matricula, pessoaId };
  }

  function addTurma(state, payload) {
    const nome = trimText(payload.nome);
    if (!nome) return null;
    const turmaId = nextId(getTable(state, 'ebd_classe'), 'id_classe');
    const turma = {
      id_classe: turmaId,
      nome,
      faixa_etaria: '',
      descricao: '',
      ativo: true,
      criado_em: nowIso(),
    };
    getTable(state, 'ebd_classe').push(turma);
    return turma;
  }

  function toggleAluno(state, alunoId, ativo) {
    const aluno = getTable(state, 'ebd_aluno').find((row) => String(row.id_aluno) === String(alunoId));
    if (!aluno) return null;
    aluno.status = normalizeBool(ativo) ? 'ativo' : 'inativo';
    if (aluno.status === 'inativo') {
      aluno.data_desligamento = todayKey();
      aluno.motivo_desligamento = aluno.motivo_desligamento || 'Desativado no modo fake';
    } else {
      aluno.data_desligamento = null;
      aluno.motivo_desligamento = '';
    }
    getTable(state, 'ebd_aluno_status_historico').push({
      id_aluno_status_historico: nextId(getTable(state, 'ebd_aluno_status_historico'), 'id_aluno_status_historico'),
      id_aluno: aluno.id_aluno,
      status_anterior: aluno.status === 'ativo' ? 'inativo' : 'ativo',
      status_novo: aluno.status,
      origem: 'manual',
      motivo: '',
      observacao: 'Alterado no modo fake',
      id_chamada: null,
      id_chamada_aluno: null,
      criado_em: nowIso(),
      criado_por: 'fake-db',
    });
    return aluno;
  }

  function registerAccess(state, payload) {
    const nome = trimText(payload.nome || payload.nomeCompleto || payload.name || '');
    const login = lowerText(payload.login || payload.usuario || '');
    const senha = String(payload.senha || payload.password || '');

    if (!nome) throw new Error('Informe o nome completo.');
    if (!login) throw new Error('Informe o login.');
    if (!senha) throw new Error('Informe a senha.');

    const pessoas = getTable(state, 'ebd_pessoa');
    const usuarios = getTable(state, 'ebd_usuario');
    const usuariosPerfil = getTable(state, 'ebd_usuario_perfil');
    const perfis = getTable(state, 'ebd_perfil');

    const cpf = String(payload.cpf || payload.cpf_cnpj || '').replace(/\D/g, '').slice(0, 11);
    if (cpf && pessoas.some((row) => String(row.cpf || '').replace(/\D/g, '') === cpf)) {
      throw new Error('CPF já cadastrado.');
    }

    if (usuarios.some((row) => lowerText(row.login || '') === login)) {
      throw new Error('Login já cadastrado.');
    }

    const idPessoa = nextId(pessoas, 'id_pessoa');
    const pessoa = {
      id_pessoa: idPessoa,
      nome,
      sexo: lowerText(payload.sexo || 'nao_informado') || 'nao_informado',
      cpf,
      data_nascimento: trimText(payload.dataNascimento || payload.data_nascimento || '') || null,
      telefone: String(payload.telefone || '').replace(/\D/g, '').slice(0, 11),
      email: trimText(payload.email || ''),
      logradouro: trimText(payload.logradouro || ''),
      numero: trimText(payload.numero || ''),
      bairro: trimText(payload.bairro || ''),
      cidade: trimText(payload.cidade || ''),
      uf: trimText(payload.uf || '').toUpperCase().slice(0, 2),
      cep: String(payload.cep || '').replace(/\D/g, '').slice(0, 8),
      observacao: trimText(payload.observacao || ''),
      criado_em: nowIso(),
      atualizado_em: nowIso(),
    };

    pessoas.push(pessoa);

    const idUsuario = nextId(usuarios, 'id_usuario');
    const usuario = {
      id_usuario: idUsuario,
      id_pessoa: idPessoa,
      login,
      senha_hash: `FAKE_HASH_${login}`,
      ultimo_login: null,
      ativo: true,
      criado_em: nowIso(),
    };

    usuarios.push(usuario);

    const perfilConsulta = perfis.find((row) => lowerText(row.nome || '') === 'consulta') || null;
    if (perfilConsulta) {
      usuariosPerfil.push({
        id_usuario_perfil: nextId(usuariosPerfil, 'id_usuario_perfil'),
        id_usuario: idUsuario,
        id_perfil: perfilConsulta.id_perfil,
      });
    }

    return {
      pessoa,
      usuario,
      perfil: perfilConsulta,
    };
  }

  function setCallStatsOnAluno(state, alunoId, status, dateKey, turmaId, callId) {
    const aluno = getTable(state, 'ebd_aluno').find((row) => String(row.id_aluno) === String(alunoId));
    if (!aluno) return;
    if (status === 'ausente') return;
    aluno.observacao = aluno.observacao || '';
  }

  function saveCall(state, payload) {
    const dateKey = trimText(payload.date || todayKey());
    const turmaId = String(payload.turmaId || '').trim();
    const turma = getTable(state, 'ebd_classe').find((row) => String(row.id_classe) === turmaId);
    if (!turma) {
      throw new Error(`Turma ${turmaId} não encontrada.`);
    }

    const rows = JSON.parse(payload.rowsJson || '[]');
    const normalizedRows = rows.map((row) => ({
      alunoId: String(row.alunoId || '').trim(),
      nome: trimText(row.nome),
      codigo: trimText(row.codigo),
      ordemCadastro: trimText(row.ordemCadastro),
      presenca: normalizePresence(row.presenca),
      atraso: normalizePresence(row.presenca) === 'atrasado' || normalizeBool(row.atraso),
      salvo: 1,
      SALVO: 1,
      observacao: trimText(row.observacao),
      statusAluno: trimText(row.statusAluno || 'ativo').toLowerCase(),
    }));

    const bucket = getDateBucket(state, dateKey);
    const previous = bucket.callsByTurma[turmaId] || null;
    const callId = previous?.chamadaId || String(payload.chamadaId || `${dateKey}_${turmaId}`);

    const callRecord = buildCallFromSavedRows(state, buildIndex(state), turma, dateKey, normalizedRows, {
      oferta: payload.oferta,
      visitantes: payload.visitantes,
      biblias: payload.biblias,
      revistas: payload.revistas,
    });

    callRecord.chamadaId = callId;
    callRecord.oferta = Number(payload.oferta || 0);
    callRecord.visitantes = Number(payload.visitantes || 0);
    callRecord.biblias = Number(payload.biblias || 0);
    callRecord.revistas = Number(payload.revistas || 0);
    callRecord.rows = normalizedRows;
    callRecord.isSaved = true;
    callRecord.syncStatus = 'synced';

    const chamada = existingOrNewCall(state, dateKey, turma, callRecord, previous);
    chamada.oferta = callRecord.oferta;
    chamada.visitantes = callRecord.visitantes;
    chamada.biblias = callRecord.biblias;
    chamada.revistas = callRecord.revistas;
    chamada.rows = normalizedRows;
    chamada.totalAlunos = callRecord.totalAlunos;
    chamada.presentes = callRecord.presentes;
    chamada.atrasos = callRecord.atrasos;
    chamada.ausentes = callRecord.ausentes;
    chamada.percentual = callRecord.percentual;
    chamada.isSaved = true;
    chamada.savedAt = nowIso();
    chamada.syncStatus = 'synced';
    bucket.callsByTurma[turmaId] = chamada;

    const beforeRows = previous?.rows?.length || 0;
    const afterRows = normalizedRows.length;

    saveRuntimeState(state);

    return {
      ok: true,
      message: 'Chamada salva com sucesso no banco fake.',
      baseWrite: {
        beforeRows,
        afterRows,
        insertedRows: Math.max(afterRows - beforeRows, 0),
      },
      turmaCall: safeClone(chamada),
      resumoGeral: buildResumoGeral(state, buildIndex(state), dateKey),
    };
  }

  function existingOrNewCall(state, dateKey, turma, callRecord, previous) {
    const bucket = getDateBucket(state, dateKey);
    const current = bucket.callsByTurma[String(turma.id_classe)] || null;
    if (current) return current;

    const created = callRecord || buildCurrentCall(state, buildIndex(state), turma, dateKey);
    bucket.callsByTurma[String(turma.id_classe)] = created;
    return created;
  }

  function selfPresence(state, payload) {
    const suffix = trimText(payload.celularSuffix || '');
    if (suffix.length !== 4) {
      throw new Error('Digite os 4 últimos números do celular.');
    }

    const index = buildIndex(state);
    const candidates = getTable(state, 'ebd_pessoa')
      .map((pessoa) => ({
        pessoa,
        aluno: getTable(state, 'ebd_aluno').find((row) => String(row.id_pessoa) === String(pessoa.id_pessoa)),
      }))
      .filter((item) => item.aluno)
      .filter((item) => String(item.pessoa.telefone || '').endsWith(suffix));

    if (!candidates.length) {
      throw new Error('Nenhum aluno encontrado com esse final de celular.');
    }

    const currentDate = trimText(payload.date || todayKey());
    const candidate = candidates.find((item) => String(item.aluno.status || '').toLowerCase() !== ACCESS.inactive) || candidates[0];

    if (!candidate?.aluno) {
      throw new Error('Aluno não encontrado.');
    }

    const currentClassRow = getCurrentClassRow({ state }, candidate.aluno.id_aluno);
    if (!currentClassRow) {
      throw new Error('Aluno sem turma ativa.');
    }

    const turma = index.classeById.get(String(currentClassRow.id_classe));
    if (!turma) {
      throw new Error('Turma do aluno não encontrada.');
    }

    const bucket = getDateBucket(state, currentDate);
    const currentCall = bucket.callsByTurma[String(turma.id_classe)] || buildCurrentCall(state, index, turma, currentDate);
    currentCall.rows = Array.isArray(currentCall.rows) ? currentCall.rows : [];
    const row = currentCall.rows.find((item) => String(item.alunoId) === String(candidate.aluno.id_aluno));
    if (row) {
      row.presenca = 'presente';
      row.atraso = false;
      row.salvo = 1;
      row.SALVO = 1;
      row.observacao = row.observacao || 'Presença confirmada pelo modo fake';
    }
    currentCall.presentes = currentCall.rows.filter((item) => normalizePresence(item.presenca) !== 'ausente').length;
    currentCall.ausentes = currentCall.rows.filter((item) => normalizePresence(item.presenca) === 'ausente').length;
    currentCall.atrasos = currentCall.rows.filter((item) => normalizePresence(item.presenca) === 'atrasado').length;
    currentCall.percentual = currentCall.totalAlunos ? (currentCall.presentes / currentCall.totalAlunos) * 100 : 0;
    currentCall.isSaved = true;
    currentCall.savedAt = nowIso();
    currentCall.syncStatus = 'synced';
    bucket.callsByTurma[String(turma.id_classe)] = currentCall;
    saveRuntimeState(state);

    return {
      ok: true,
      message: 'Presença confirmada com sucesso no banco fake.',
      celularSuffix: suffix,
      alunoId: String(candidate.aluno.id_aluno),
      turmaId: String(turma.id_classe),
      turmaCall: safeClone(currentCall),
      resumoGeral: buildResumoGeral(state, index, currentDate),
    };
  }

  function normalizeRowCounts(call, activeRowsCount) {
    const rows = Array.isArray(call.rows) ? call.rows : [];
    return {
      presentes: rows.filter((row) => normalizePresence(row.presenca) !== 'ausente').length,
      atrasos: rows.filter((row) => normalizePresence(row.presenca) === 'atrasado').length,
      ausentes: rows.filter((row) => normalizePresence(row.presenca) === 'ausente').length,
      percentual: activeRowsCount ? (rows.filter((row) => normalizePresence(row.presenca) !== 'ausente').length / activeRowsCount) * 100 : 0,
    };
  }

  function initResponse(state, params) {
    const index = buildIndex(state);
    const dateKey = trimText(params.date || todayKey());
    const view = trimText(params.view || '');
    const selectedTurmaId = trimText(params.turmaId || '');
    const classes = getTable(state, 'ebd_classe').filter((row) => row.ativo !== false);
    const turmas = classes.map((classe) => buildTurmaRow(state, index, classe));
    const alunos = getTable(state, 'ebd_aluno')
      .map((aluno) => buildAlunoRow(state, index, aluno))
      .sort((a, b) => String(a.TurmaID || '').localeCompare(String(b.TurmaID || '')) || String(a.Nome || '').localeCompare(String(b.Nome || '')));
    const inativos = getTable(state, 'ebd_aluno')
      .filter((aluno) => String(aluno.status || '').toLowerCase() === ACCESS.inactive)
      .map((aluno) => buildInactiveStudentRow(state, index, aluno))
      .sort((a, b) => String(a.TurmaNome || '').localeCompare(String(b.TurmaNome || '')) || String(a.Nome || '').localeCompare(String(b.Nome || '')));

    const bucket = getDateBucket(state, dateKey);
    const callsByTurma = {};
    classes.forEach((classe) => {
      const savedCall = bucket.callsByTurma[String(classe.id_classe)] || null;
      if (savedCall) {
        callsByTurma[String(classe.id_classe)] = safeClone(savedCall);
      } else if (view !== 'turmas' && view !== 'inativos') {
        const call = buildCurrentCall(state, index, classe, dateKey);
        if (call.rows.length) {
          callsByTurma[String(classe.id_classe)] = call;
        }
      }
    });

    const resumoGeral = buildResumoGeral(state, index, dateKey);
    const selected = selectedTurmaId || turmas[0]?.TurmaID || '';
    const baseRowsCount = selected && callsByTurma[selected]?.rows ? callsByTurma[selected].rows.length : (callsByTurma[selected]?.totalAlunos || 0);

    return {
      ok: true,
      source: 'fake-database',
      stage: 'init',
      date: dateKey,
      selectedTurmaId: selected,
      turmas,
      alunos,
      callsByTurma,
      inativos,
      resumoGeral,
      baseRowsCount,
      memory: null,
      meta: {
        fakeDatabase: true,
        seedVersion: state.seedVersion,
      },
    };
  }

  async function handleGet(params = {}) {
    const state = await ensureState();
    const action = lowerText(params.action || params.acao || 'init');
    if (action !== 'init') {
      return {
        ok: true,
        source: 'fake-database',
        stage: 'noop',
        message: `Ação ${action || 'desconhecida'} ignorada pelo banco fake.`,
      };
    }
    return initResponse(state, params);
  }

  async function handlePost(params = {}) {
    const state = await ensureState();
    const action = lowerText(params.action || params.acao || '');

    try {
      if (action === 'addturma') {
        const turma = addTurma(state, params);
        if (!turma) throw new Error('Informe o nome da turma.');
        saveRuntimeState(state);
        return {
          ok: true,
          source: 'fake-database',
          stage: 'addTurma',
          message: 'Turma cadastrada com sucesso no banco fake.',
          turmaId: String(turma.id_classe),
          turma: buildTurmaRow(state, buildIndex(state), turma),
          resumoGeral: buildResumoGeral(state, buildIndex(state), todayKey()),
        };
      }

      if (action === 'addaluno') {
        const created = addAluno(state, params);
        if (!created) throw new Error('Informe nome e turma para cadastrar o aluno.');
        saveRuntimeState(state);
        return {
          ok: true,
          source: 'fake-database',
          stage: 'addaluno',
          message: 'Aluno cadastrado com sucesso no banco fake.',
          alunoId: String(created.alunoId),
          matricula: created.matricula,
          resumoGeral: buildResumoGeral(state, buildIndex(state), todayKey()),
        };
      }

      if (action === 'register') {
        const created = registerAccess(state, params);
        saveRuntimeState(state);
        return {
          ok: true,
          source: 'fake-database',
          stage: 'register',
          message: 'Cadastro realizado com sucesso no banco fake.',
          pessoa: created.pessoa,
          usuario: {
            id_usuario: String(created.usuario.id_usuario),
            login: created.usuario.login,
            id_pessoa: String(created.usuario.id_pessoa),
            perfis: created.perfil ? [created.perfil.nome] : [],
          },
        };
      }

      if (action === 'updatealuno') {
        const updated = updateAluno(state, params.alunoId || params.id || params.nome, params);
        if (!updated) throw new Error('Aluno não encontrado para atualização.');
        saveRuntimeState(state);
        return {
          ok: true,
          source: 'fake-database',
          stage: 'updatealuno',
          message: 'Aluno atualizado com sucesso no banco fake.',
          alunoId: String(updated.id_aluno),
          resumoGeral: buildResumoGeral(state, buildIndex(state), todayKey()),
        };
      }

      if (action === 'deletealuno') {
        const removed = removeAluno(state, params.alunoId || params.id || params.nome);
        if (!removed) throw new Error('Aluno não encontrado para exclusão.');
        saveRuntimeState(state);
        return {
          ok: true,
          source: 'fake-database',
          stage: 'deletealuno',
          message: 'Aluno excluído com sucesso no banco fake.',
          alunoId: String(removed.id_aluno),
          resumoGeral: buildResumoGeral(state, buildIndex(state), todayKey()),
        };
      }

      if (action === 'movealuno') {
        const updated = updateAluno(state, params.alunoId, { turmaId: params.turmaId });
        if (!updated) throw new Error('Aluno não encontrado para mover.');
        saveRuntimeState(state);
        return {
          ok: true,
          source: 'fake-database',
          stage: 'moveAluno',
          message: 'Aluno movido com sucesso no banco fake.',
          alunoId: String(updated.id_aluno),
          turmaId: String(params.turmaId || ''),
          resumoGeral: buildResumoGeral(state, buildIndex(state), todayKey()),
        };
      }

      if (action === 'togglealuno') {
        const updated = toggleAluno(state, params.alunoId, params.ativo);
        if (!updated) throw new Error('Aluno não encontrado para atualizar status.');
        saveRuntimeState(state);
        return {
          ok: true,
          source: 'fake-database',
          stage: 'toggleAluno',
          message: 'Status do aluno atualizado no banco fake.',
          alunoId: String(updated.id_aluno),
          status: String(updated.status || ACCESS.active),
          resumoGeral: buildResumoGeral(state, buildIndex(state), todayKey()),
        };
      }

      if (action === 'savecall') {
        return saveCall(state, params);
      }

      if (action === 'selfpresence') {
        return selfPresence(state, params);
      }

      if (action === 'init') {
        return initResponse(state, params);
      }

      return {
        ok: true,
        source: 'fake-database',
        stage: action || 'noop',
        message: `Ação ${action || 'desconhecida'} não implementada no modo fake.`,
      };
    } catch (err) {
      return {
        ok: false,
        source: 'fake-database',
        stage: action || 'fake-post',
        message: err?.message || 'Erro no banco fake.',
      };
    }
  }

  window.FakeDatabase = {
    ensureReady: ensureState,
    handleGet,
    handlePost,
    reload: async () => {
      statePromise = null;
      return ensureState();
    },
  };
})();
