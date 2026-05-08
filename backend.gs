/**
 * PATCH — Ignorar alunos inativos nos relatórios
 * Cole estas funções no backend.gs substituindo as antigas.
 */

function getActiveStudents_(students) {
  return (students || []).filter(
    (a) => String(a.Status || '').toLowerCase() !== 'inativo'
  );
}

function buildTurmaReportText_(dateKey, turma, turmaCall, all) {
  const turmaStudents = all.alunos.filter(
    (a) => String(a.TurmaID || '') === String(turma.TurmaID || '')
  );

  const activeStudents = getActiveStudents_(turmaStudents);
  const activeIds = new Set(
    activeStudents.map((a) => String(a.AlunoID || ''))
  );

  const activeRows = (turmaCall.rows || []).filter(
    (r) => activeIds.has(String(r.alunoId || ''))
  );

  const linhasPresentes = activeRows.filter(
    (r) => r.presenca === 'sim'
  );

  const linhasAusentes = activeRows.filter(
    (r) => r.presenca !== 'sim'
  );

  const melhor = getBestStudentForTurma_(turma.TurmaID, all);

  const inativos = turmaStudents.filter(
    (a) => String(a.Status || '').toLowerCase() === 'inativo'
  );

  return [
    `📋 RELATÓRIO DA TURMA`,
    `Turma: ${turma.Nome}`,
    `Data: ${formatDateBR_(dateKey)}`,
    ``,
    `Total de alunos: ${activeStudents.length}`,
    `Presentes: ${linhasPresentes.length}`,
    `Ausentes: ${linhasAusentes.length}`,
    `Presença: ${formatPercent_(activeStudents.length ? (linhasPresentes.length / activeStudents.length) * 100 : 0)}`,
    `Oferta da classe: ${turmaCall.oferta || '-'}`,
    `Visitantes: ${turmaCall.visitantes > 0 ? turmaCall.visitantes : 'não informado'}`,
    turmaCall.visitantesTexto
      ? `Detalhe visitantes: ${turmaCall.visitantesTexto}`
      : '',
    ``,
    `Melhor aluno: ${melhor ? `${melhor.Nome} (${formatPercent_(melhor.Percentual)})` : '—'}`,
    `Inativos: ${inativos.length ? inativos.map((r) => r.Nome).join(', ') : 'nenhum'}`,
    `Faltando muito: ${
      all.stats.faltandoMuito
        .filter((a) => String(a.TurmaID || '') === String(turma.TurmaID || ''))
        .map((a) => a.Nome)
        .join(', ') || 'nenhum'
    }`,
    ``,
    `Presentes: ${linhasPresentes.map((r) => r.nome).join(', ') || 'nenhum'}`,
    `Ausentes: ${linhasAusentes.map((r) => r.nome).join(', ') || 'nenhum'}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function buildGeneralReportText_(dateKey, geral, callsByTurma, all) {
  const partes = [];

  partes.push('📊 RELATÓRIO GERAL');
  partes.push(`Data: ${formatDateBR_(dateKey)}`);
  partes.push('');

  const activeStudents = getActiveStudents_(all.alunos);

  let totalPresentes = 0;
  let totalAusentes = 0;
  let totalOferta = 0;
  let totalVisitantes = 0;

  partes.push(`Turmas salvas: ${geral.turmasSalvas}/${geral.totalTurmas}`);
  partes.push(`Total de alunos ativos: ${activeStudents.length}`);

  partes.push('');
  partes.push('Resumo por turma:');

  (all.turmas || []).forEach((turma) => {
    const turmaStudents = all.alunos.filter(
      (a) => String(a.TurmaID || '') === String(turma.TurmaID || '')
    );

    const activeTurmaStudents = getActiveStudents_(turmaStudents);

    const activeTurmaIds = new Set(
      activeTurmaStudents.map((a) => String(a.AlunoID || ''))
    );

    const call = callsByTurma[turma.TurmaID];

    let presentes = 0;
    let ausentes = 0;
    let percentual = 0;
    let oferta = '-';
    let visitantes = 0;

    if (call) {
      const activeRows = (call.rows || []).filter(
        (r) => activeTurmaIds.has(String(r.alunoId || ''))
      );

      presentes = activeRows.filter(
        (r) => r.presenca === 'sim'
      ).length;

      ausentes = activeRows.filter(
        (r) => r.presenca !== 'sim'
      ).length;

      percentual = activeTurmaStudents.length
        ? (presentes / activeTurmaStudents.length) * 100
        : 0;

      oferta = call.oferta || '-';
      visitantes = Number(call.visitantes || 0) || 0;
    }

    totalPresentes += presentes;
    totalAusentes += ausentes;
    totalOferta += parseMoney_(oferta);
    totalVisitantes += visitantes;

    partes.push(
      `- ${turma.Nome}: ${presentes}/${activeTurmaStudents.length} (${formatPercent_(percentual)}) | Oferta ${oferta} | Visitantes ${visitantes}`
    );
  });

  const percentualGeral = activeStudents.length
    ? (totalPresentes / activeStudents.length) * 100
    : 0;

  partes.splice(4, 0, `Presentes: ${totalPresentes}`);
  partes.splice(5, 0, `Ausentes: ${totalAusentes}`);
  partes.splice(6, 0, `Presença geral: ${formatPercent_(percentualGeral)}`);
  partes.splice(7, 0, `Oferta total: ${formatMoney_(totalOferta)}`);
  partes.splice(8, 0, `Visitantes: ${totalVisitantes}`);

  partes.push('');
  partes.push(
    `Melhores alunos: ${
      geral.melhores?.length
        ? geral.melhores
            .map((a) => `${a.Nome} (${formatPercent_(a.Percentual)})`)
            .join(', ')
        : '—'
    }`
  );

  partes.push(
    `Inativos: ${
      geral.inativos?.length
        ? geral.inativos.map((a) => a.Nome).join(', ')
        : 'nenhum'
    }`
  );

  partes.push(
    `Faltando muito: ${
      geral.faltandoMuito?.length
        ? geral.faltandoMuito.map((a) => a.Nome).join(', ')
        : 'nenhum'
    }`
  );

  partes.push(
    `Reativados: ${
      geral.reativados?.length
        ? geral.reativados.map((a) => a.Nome).join(', ')
        : 'nenhum'
    }`
  );

  return partes.join('\n');
}
