function markDirty() {
  const call = getCurrentCall();
  if (!call) return;
  state.dirty = true;
  persistDraft(call);
  renderReports();
}

function setStudentPresence(alunoId, presence) {
  const call = getCurrentCall();
  if (!call) return;
  const row = call.rows.find((r) => r.alunoId === alunoId);
  if (!row) return;
  row.presenca = normalizePresenceValue(presence);
  row.atraso = row.presenca === 'atrasado';
  row.salvo = 1;
  row.SALVO = 1;
  state.dirty = true;
  updateCallFromInputs();
  persistDraft(call);
  renderAll();
}
function setAllPresence(presence) {
  const call = getCurrentCall();
  if (!call) return;
  call.rows.forEach((row) => {
    if (isInactiveStudent(row)) return;
    row.presenca = normalizePresenceValue(presence);
    row.atraso = row.presenca === 'atrasado';
    row.salvo = 1;
    row.SALVO = 1;
  });
  state.dirty = true;
  updateCallFromInputs();
  persistDraft(call);
  renderAll();
}

async function saveCurrentCall({ silent = false } = {}) {
  const turma = getCurrentTurma();
  const call = getCurrentCall();

  updateCallFromInputs();

  if (!turma || !call) {
    throw new Error('Selecione uma turma antes de salvar.');
  }

  const pendingRows = (call.rows || []).filter(
    (row) => !isInactiveStudent(row) && !isSavedRow(row)
  );

  if (pendingRows.length) {
    const suffix = pendingRows.length === 1
      ? '1 aluno está sem registro de presença, ausência ou atraso.'
      : `${pendingRows.length} alunos estão sem registro de presença, ausência ou atraso.`;

    showError(`Existe ${suffix} Marque todos os alunos antes de salvar.`);
    if (window.ProjectMemory) {
      window.ProjectMemory.recordFromEvent('save-blocked', {
        dateKey: state.dateKey,
        turmaNome: turma.Nome,
        turmaId: turma.TurmaID,
        message: suffix,
      });
    }
    throw new Error('Existe aluno sem registro de presença, ausência ou atraso.');
  }

  const beforeRows = Number(state.baseRowsCount || 0);

  const payload = {
    action: 'saveCall',
    date: state.dateKey,
    turmaId: turma.TurmaID,
    chamadaId: call.chamadaId,
    responsavel: state.accessCode || '',
    oferta: call.oferta ?? 0,
    visitantes: String(call.visitantes ?? 0),
    biblias: String(call.biblias ?? 0),
    revistas: String(call.revistas ?? 0),
    //visitantesTexto: call.visitantesTexto || '',
    rowsJson: JSON.stringify(call.rows),
  };

  if (!silent) {
    showLoading('Salvando chamada...', 30000);
  }

  let timeoutId = null;
  let loadingClosed = false;

  const closeLoading = () => {
    if (loadingClosed) return;
    loadingClosed = true;

    clearTimeout(timeoutId);

    if (!silent) {
      if (typeof forceHideLoading === 'function') {
        forceHideLoading();
      }
      hideLoading();
    }
  };

  const timeoutPromise = new Promise((resolve) => {
    timeoutId = setTimeout(() => {
      resolve({ type: 'timeout' });
    }, 7000);
  });

  const requestPromise = apiPost(payload, { timeoutMs: 60000 }).then(
    (result) => ({ type: 'response', result }),
    (error) => ({ type: 'error', error })
  );

  try {
    const first = await Promise.race([requestPromise, timeoutPromise]);

    // Resposta chegou antes dos 7s
    if (first.type === 'response') {
      closeLoading();

      const result = first.result;

      const afterRows = Number(result?.baseWrite?.afterRows ?? beforeRows);
      const insertedRows = Number(
        result?.baseWrite?.insertedRows ?? (afterRows - beforeRows)
      );

      if (afterRows > beforeRows && insertedRows > 0) {
        state.baseRowsCount = afterRows;
      }

      state.resumoGeral = result.resumoGeral || state.resumoGeral;
      state.chamadasByTurma[turma.TurmaID] = result.turmaCall || call;
      state.dirty = false;
      clearDraft(call.chamadaId);
      state.selectedTurmaId = turma.TurmaID;
      if (window.ProjectMemory) {
        window.ProjectMemory.recordFromEvent('save-call', {
          key: `${turma.TurmaID}-${state.dateKey}`,
          dateKey: state.dateKey,
          turmaId: turma.TurmaID,
          turmaNome: turma.Nome,
          presentes: Number((call.rows || []).filter((row) => isPresentLikeValue(row.presenca)).length),
          ausentes: Number((call.rows || []).filter((row) => normalizePresenceValue(row.presenca) === 'nao').length),
          atrasos: Number((call.rows || []).filter((row) => isDelayedValue(row.presenca)).length),
          visitantes: Number(call.visitantes || 0),
          oferta: call.oferta,
        });
      }
      renderAll();

      refreshFromBackend(false, { silent: true }).catch((err) => {
        if (isDebugConsoleEnabled()) console.warn('Falha ao atualizar dados após salvar:', err);
      });

      showSuccess(result.message || 'Chamada salva com sucesso.');
      return result;
    }

    // Passaram 7s e não veio resposta: para o loading e segue
    if (first.type === 'timeout') {
      closeLoading();

      state.dirty = false;
      clearDraft(call.chamadaId);
      state.selectedTurmaId = turma.TurmaID;
      if (window.ProjectMemory) {
        window.ProjectMemory.recordFromEvent('save-call', {
          key: `${turma.TurmaID}-${state.dateKey}`,
          dateKey: state.dateKey,
          turmaId: turma.TurmaID,
          turmaNome: turma.Nome,
          presentes: Number((call.rows || []).filter((row) => isPresentLikeValue(row.presenca)).length),
          ausentes: Number((call.rows || []).filter((row) => normalizePresenceValue(row.presenca) === 'nao').length),
          atrasos: Number((call.rows || []).filter((row) => isDelayedValue(row.presenca)).length),
          visitantes: Number(call.visitantes || 0),
          oferta: call.oferta,
        });
      }
      renderAll();

      requestPromise.then((settled) => {
        if (settled?.type === 'response') {
          const result = settled.result;
          const afterRows = Number(result?.baseWrite?.afterRows ?? state.baseRowsCount);
          const insertedRows = Number(
            result?.baseWrite?.insertedRows ?? (afterRows - state.baseRowsCount)
          );

          if (afterRows > state.baseRowsCount && insertedRows > 0) {
            state.baseRowsCount = afterRows;
          }

          state.resumoGeral = result.resumoGeral || state.resumoGeral;
          state.chamadasByTurma[turma.TurmaID] = result.turmaCall || call;

          refreshFromBackend(false, { silent: true }).catch((err) => {
            if (isDebugConsoleEnabled()) console.warn('Falha ao atualizar dados após salvar:', err);
          });
        } else if (settled?.type === 'error') {
          if (isDebugConsoleEnabled()) console.warn('Resposta do Apps Script falhou depois dos 7s:', settled.error);
        }
      });

      showSuccess('Chamada enviada para salvamento.');
      return { ok: true, pending: true };
    }

    throw first.error instanceof Error
      ? first.error
      : new Error('Erro ao salvar chamada.');
  } catch (err) {
    closeLoading();
    showError(formatAppError(err, 'Salvar chamada'));
    throw err;
  } finally {
    closeLoading();
  }
}


