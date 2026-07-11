(function () {
  const MEMORY_STORAGE_KEY = 'prb_project_memory_v1';
  const MEMORY_SCHEMA_VERSION = 1;
  const MAX_SESSION_ENTRIES = 200;
  const MAX_DOC_ENTRIES = 100;

  const emptyStore = () => ({
    schemaVersion: MEMORY_SCHEMA_VERSION,
    project: 'EBD',
    updatedAt: '',
    decisions: [],
    procedures: [],
    gotchas: [],
    rules: [],
    sessions: [],
    handoff: '',
    sources: [],
  });

  function nowIso() {
    return new Date().toISOString();
  }

  function canUseStorage() {
    try {
      return typeof window !== 'undefined' && !!window.localStorage;
    } catch (err) {
      return false;
    }
  }

  function safeParse(json, fallback) {
    try {
      return JSON.parse(json);
    } catch (err) {
      return fallback;
    }
  }

  function normalizeText(value) {
    return String(value ?? '')
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function slugify(value) {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'entry';
  }

  function asLines(value) {
    if (Array.isArray(value)) {
      return value
        .flatMap((item) => String(item ?? '').split('\n'))
        .map((line) => line.trim())
        .filter(Boolean);
    }

    return normalizeText(value)
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function toDoc(input = {}, category = 'sessions') {
    const title = normalizeText(input.title || input.name || input.key || 'Sem título');
    const key = slugify(input.key || input.slug || title);
    const bodyLines = asLines(input.body || input.content || input.summary || '');
    const entry = {
      key,
      title,
      body: bodyLines.join('\n'),
      category,
      updatedAt: input.updatedAt || nowIso(),
      createdAt: input.createdAt || nowIso(),
      source: input.source || 'app',
      meta: input.meta || {},
    };

    if (input.tags) {
      entry.tags = Array.isArray(input.tags)
        ? input.tags.map((tag) => String(tag).trim()).filter(Boolean)
        : asLines(input.tags);
    }

    return entry;
  }

  function readStore() {
    const fallback = emptyStore();

    if (!canUseStorage()) {
      return fallback;
    }

    const raw = window.localStorage.getItem(MEMORY_STORAGE_KEY);
    if (!raw) return fallback;

    const parsed = safeParse(raw, null);
    if (!parsed || typeof parsed !== 'object') {
      return fallback;
    }

    return {
      ...fallback,
      ...parsed,
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
      procedures: Array.isArray(parsed.procedures) ? parsed.procedures : [],
      gotchas: Array.isArray(parsed.gotchas) ? parsed.gotchas : [],
      rules: Array.isArray(parsed.rules) ? parsed.rules : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      sources: Array.isArray(parsed.sources) ? parsed.sources : [],
    };
  }

  function writeStore(store) {
    const next = {
      ...emptyStore(),
      ...store,
      updatedAt: nowIso(),
    };

    if (!canUseStorage()) {
      return next;
    }

    try {
      window.localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(next));
    } catch (err) {
      console.warn('Falha ao persistir memória do projeto:', err);
    }

    return next;
  }

  function upsertDoc(collectionName, input) {
    const store = readStore();
    const doc = toDoc(input, collectionName);
    const list = Array.isArray(store[collectionName]) ? [...store[collectionName]] : [];
    const index = list.findIndex((item) => String(item.key || '') === String(doc.key));

    if (index >= 0) {
      list[index] = {
        ...list[index],
        ...doc,
        createdAt: list[index].createdAt || doc.createdAt,
      };
    } else {
      list.unshift(doc);
    }

    store[collectionName] = list.slice(0, MAX_DOC_ENTRIES);
    return writeStore(store);
  }

  function appendSession(input) {
    const store = readStore();
    const session = toDoc(input, 'sessions');
    const id = session.key || slugify(`${session.title}-${session.updatedAt}`);
    const list = Array.isArray(store.sessions) ? [...store.sessions] : [];

    list.unshift({
      ...session,
      key: id,
      id,
    });

    store.sessions = list.slice(0, MAX_SESSION_ENTRIES);
    return writeStore(store);
  }

  function upsertSession(input) {
    const store = readStore();
    const session = toDoc(input, 'sessions');
    const id = session.key || slugify(`${session.title}-${session.updatedAt}`);
    const list = Array.isArray(store.sessions) ? [...store.sessions] : [];
    const index = list.findIndex((item) => String(item.key || item.id || '') === String(id));

    if (index >= 0) {
      list[index] = {
        ...list[index],
        ...session,
        key: id,
        id,
      };
    } else {
      list.unshift({
        ...session,
        key: id,
        id,
      });
    }

    store.sessions = list.slice(0, MAX_SESSION_ENTRIES);
    return writeStore(store);
  }

  function setHandoff(text, meta = {}) {
    const store = readStore();
    store.handoff = normalizeText(text);
    store.handoffMeta = {
      ...(store.handoffMeta || {}),
      ...meta,
      updatedAt: nowIso(),
    };
    return writeStore(store);
  }

  function dedupeAndUpsert(collectionName, items, source = 'backend-seed') {
    if (!Array.isArray(items)) return;

    items.forEach((item) => {
      if (!item) return;
      upsertDoc(collectionName, {
        ...item,
        source: item.source || source,
      });
    });
  }

  function ingestSeed(seed = {}) {
    if (!seed || typeof seed !== 'object') return readStore();

    const store = readStore();

    if (seed.project) {
      store.project = String(seed.project);
    }

    if (seed.handoff) {
      const candidate = normalizeText(seed.handoff);
      if (candidate) {
        store.handoff = candidate;
      }
    }

    if (Array.isArray(seed.sources)) {
      store.sources = Array.from(new Set([...(store.sources || []), ...seed.sources.map((item) => String(item).trim()).filter(Boolean)]));
    }

    dedupeAndUpsert('decisions', seed.decisions, seed.source || 'backend-seed');
    dedupeAndUpsert('procedures', seed.procedures, seed.source || 'backend-seed');
    dedupeAndUpsert('gotchas', seed.gotchas, seed.source || 'backend-seed');
    dedupeAndUpsert('rules', seed.rules, seed.source || 'backend-seed');

    if (Array.isArray(seed.sessions) && seed.sessions.length) {
      seed.sessions.forEach((item) => upsertSession({
        ...item,
        source: item.source || seed.source || 'backend-seed',
      }));
    }

    return readStore();
  }

  function recordDecision(key, title, body, meta = {}) {
    return upsertDoc('decisions', {
      key,
      title,
      body,
      meta,
      source: meta.source || 'runtime',
    });
  }

  function recordProcedure(key, title, body, meta = {}) {
    return upsertDoc('procedures', {
      key,
      title,
      body,
      meta,
      source: meta.source || 'runtime',
    });
  }

  function recordGotcha(key, title, body, meta = {}) {
    return upsertDoc('gotchas', {
      key,
      title,
      body,
      meta,
      source: meta.source || 'runtime',
    });
  }

  function recordRule(key, title, body, meta = {}) {
    return upsertDoc('rules', {
      key,
      title,
      body,
      meta,
      source: meta.source || 'runtime',
    });
  }

  function recordSession(title, body, meta = {}) {
    return appendSession({
      key: meta.key || `${slugify(title)}-${Date.now()}`,
      title,
      body,
      meta,
      source: meta.source || 'runtime',
    });
  }

  function describeCounts(counts = {}) {
    const parts = [];
    if (Number.isFinite(Number(counts.turmas))) parts.push(`${counts.turmas} turmas`);
    if (Number.isFinite(Number(counts.alunos))) parts.push(`${counts.alunos} alunos`);
    if (Number.isFinite(Number(counts.presentes))) parts.push(`${counts.presentes} presentes`);
    if (Number.isFinite(Number(counts.ausentes))) parts.push(`${counts.ausentes} ausentes`);
    if (Number.isFinite(Number(counts.atrasos))) parts.push(`${counts.atrasos} atrasos`);
    if (Number.isFinite(Number(counts.visitantes))) parts.push(`${counts.visitantes} visitantes`);
    return parts.join(', ');
  }

  function summarizeEvent(eventName, payload = {}) {
    const dateLabel = payload.dateKey ? `Data ${payload.dateKey}` : '';
    const turmaLabel = payload.turmaNome ? `Turma ${payload.turmaNome}` : '';
    const pieces = [dateLabel, turmaLabel, payload.message || ''].filter(Boolean);
    return normalizeText(pieces.join(' • '));
  }

  function recordFromEvent(eventName, payload = {}) {
    const lower = String(eventName || '').toLowerCase();

    if (lower === 'bootstrap' || lower === 'backend-sync' || lower === 'refresh') {
      const counts = payload.counts || {};
      return recordSession(
        'Sincronização do projeto',
        normalizeText(
          [
            `Turmas: ${payload.turmas ?? 0}`,
            `Alunos: ${payload.alunos ?? 0}`,
            `Chamada atual: ${payload.currentTurma || 'não definida'}`,
            `Resumo: ${describeCounts(counts) || 'sem contagem relevante'}`,
          ].join('\n')
        ),
        { source: 'runtime', key: payload.key || `${lower}-${payload.dateKey || 'unknown'}` }
      );
    }

    if (lower === 'save-call') {
      return recordSession(
        'Chamada salva',
        normalizeText(
          [
            `Data: ${payload.dateKey || '—'}`,
            `Turma: ${payload.turmaNome || '—'}`,
            `Presentes: ${payload.presentes ?? 0}`,
            `Ausentes: ${payload.ausentes ?? 0}`,
            `Atrasos: ${payload.atrasos ?? 0}`,
            `Visitantes: ${payload.visitantes ?? 0}`,
            `Oferta: ${payload.oferta ?? '—'}`,
          ].join('\n')
        ),
        { source: 'runtime', key: payload.key || `save-call-${payload.dateKey || 'unknown'}-${payload.turmaId || 'na'}` }
      );
    }

    if (lower === 'add-turma') {
      return recordProcedure(
        payload.key || `add-turma-${slugify(payload.nome)}`,
        'Cadastro de turma',
        normalizeText(
          [
            `Nova turma criada: ${payload.nome || '—'}.`,
            `Ordem: ${payload.ordem ?? '0'}.`,
          ].join('\n')
        ),
        { source: 'runtime', category: 'procedures' }
      );
    }

    if (lower === 'add-aluno') {
      return recordProcedure(
        payload.key || `add-aluno-${slugify(payload.nome)}`,
        'Cadastro de aluno',
        normalizeText(
          [
            `Novo aluno criado: ${payload.nome || '—'}.`,
            `Turma: ${payload.turmaNome || payload.turmaId || '—'}.`,
          ].join('\n')
        ),
        { source: 'runtime', category: 'procedures' }
      );
    }

    if (lower === 'move-student') {
      return recordProcedure(
        payload.key || `move-student-${slugify(payload.alunoNome)}`,
        'Movimentação de aluno',
        normalizeText(
          [
            `Aluno movido: ${payload.alunoNome || '—'}.`,
            `Destino: ${payload.turmaDestino || payload.turmaId || '—'}.`,
          ].join('\n')
        ),
        { source: 'runtime', category: 'procedures' }
      );
    }

    if (lower === 'toggle-student-status') {
      return recordGotcha(
        payload.key || `toggle-status-${slugify(payload.alunoNome)}`,
        'Reativação ou inativação de aluno',
        normalizeText(
          [
            `Aluno: ${payload.alunoNome || '—'}.`,
            `Novo status: ${payload.status || '—'}.`,
          ].join('\n')
        ),
        { source: 'runtime', category: 'gotchas' }
      );
    }

    if (lower === 'clear-call') {
      return recordProcedure(
        payload.key || `clear-call-${payload.dateKey || Date.now()}`,
        'Limpeza da chamada atual',
        normalizeText(
          [
            `A chamada da turma ${payload.turmaNome || '—'} foi limpa na data ${payload.dateKey || '—'}.`,
            'Os valores permanecem apenas na tela até novo salvamento.',
          ].join('\n')
        ),
        { source: 'runtime', category: 'procedures' }
      );
    }

    if (lower === 'save-blocked') {
      return recordGotcha(
        payload.key || `save-blocked-${payload.dateKey || Date.now()}`,
        'Salvar bloqueado por marcação incompleta',
        normalizeText(
          [
            'O salvamento foi bloqueado porque ainda havia alunos sem presença, ausência ou atraso.',
            'A chamada precisa ficar totalmente marcada antes do envio.',
          ].join('\n')
        ),
        { source: 'runtime', category: 'gotchas' }
      );
    }

    return recordSession(
      eventName,
      summarizeEvent(eventName, payload),
      { source: 'runtime', key: payload.key || `${slugify(eventName)}-${Date.now()}` }
    );
  }

  function sectionToMarkdown(title, items, emptyMessage) {
    const lines = [`## ${title}`, ''];

    if (!Array.isArray(items) || items.length === 0) {
      lines.push(emptyMessage || 'Nenhum registro.');
      return lines.join('\n');
    }

    items.forEach((item) => {
      const itemTitle = item.title || item.key || 'Sem título';
      const body = normalizeText(item.body || '');
      lines.push(`### ${itemTitle}`);
      if (item.updatedAt) lines.push(`- Atualizado em: ${item.updatedAt}`);
      if (item.source) lines.push(`- Origem: ${item.source}`);
      if (item.meta && Object.keys(item.meta).length) {
        lines.push(`- Metadados: ${JSON.stringify(item.meta)}`);
      }
      lines.push('');
      lines.push(body || 'Sem conteúdo.');
      lines.push('');
    });

    return lines.join('\n').trim();
  }

  function buildMarkdownBundle() {
    const store = readStore();
    const bundle = {
      'memory/README.md': normalizeText(
        [
          '# Memória viva do projeto',
          '',
          'Este conjunto de arquivos consolida decisões, procedimentos, armadilhas, regras e sessões curtas do projeto.',
          'A ideia é manter o conhecimento reutilizável em documentos pequenos e auditáveis, em vez de depender de histórico infinito.',
        ].join('\n')
      ),
      'memory/decisions/index.md': sectionToMarkdown('Decisões', store.decisions, 'Nenhuma decisão consolidada.'),
      'memory/procedures/index.md': sectionToMarkdown('Procedimentos', store.procedures, 'Nenhum procedimento consolidado.'),
      'memory/gotchas/index.md': sectionToMarkdown('Armadilhas', store.gotchas, 'Nenhuma armadilha consolidada.'),
      'memory/rules/index.md': sectionToMarkdown('Regras', store.rules, 'Nenhuma regra consolidada.'),
      'memory/sessions/index.md': sectionToMarkdown('Sessões', store.sessions, 'Nenhuma sessão registrada.'),
      'memory/handoff.md': normalizeText(store.handoff || 'Sem handoff definido.'),
    };

    return bundle;
  }

  function snapshot() {
    return readStore();
  }

  function init(seed = {}) {
    if (seed && typeof seed === 'object') {
      ingestSeed(seed);
    }
    return snapshot();
  }

  const api = {
    init,
    ingestSeed,
    recordDecision,
    recordProcedure,
    recordGotcha,
    recordRule,
    recordSession,
    recordFromEvent,
    setHandoff,
    buildMarkdownBundle,
    snapshot,
    readStore: snapshot,
  };

  window.ProjectMemory = api;
  window.projectMemory = api;
})();
