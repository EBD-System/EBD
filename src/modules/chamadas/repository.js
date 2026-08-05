const { query, withTransaction } = require('../../db');
const { HttpError } = require('../../utils/httpError');
const { todayISO, formatDateInTimeZone, isSameCivilDay } = require('../../utils/date');

async function ensureClassInTenant(classId, idCadastro) {
  const result = await query(
    `
    SELECT c.id_classe, c.ativo
    FROM public.ebd_classe c
    WHERE c.id_classe = $1
      AND c.id_cadastro = $2
    `,
    [classId, idCadastro]
  );

  if (!result.rows[0]) {
    throw new HttpError(404, 'Classe não encontrada.', 'attendance');
  }

  return result.rows[0];
}

async function ensureCallInTenant(callId, idCadastro) {
  const result = await query(
    `
    SELECT
      ch.id_chamada,
      ch.id_classe,
      ch.data_chamada,
      ch.fechada
    FROM public.ebd_chamada ch
    INNER JOIN public.ebd_classe c
      ON c.id_classe = ch.id_classe
     AND c.id_cadastro = $2
    WHERE ch.id_chamada = $1
    `,
    [callId, idCadastro]
  );

  if (!result.rows[0]) {
    throw new HttpError(404, 'Chamada não encontrada.', 'attendance');
  }

  return result.rows[0];
}

async function openAttendance(classId, date, idCadastro) {
  const classRow = await ensureClassInTenant(classId, idCadastro);

  if (!classRow.ativo) {
    throw new HttpError(400, 'Não é possível abrir chamada para uma turma inativa.', 'attendance');
  }

  const result = await query(
    `
    SELECT public.fn_ebd_abrir_chamada($1, $2) AS id_chamada
    `,
    [classId, date]
  );
  return result.rows[0]?.id_chamada || null;
}

async function getAttendanceByClassAndDate(classId, date, idCadastro) {
  await ensureClassInTenant(classId, idCadastro);
  const result = await query(
    `
    SELECT *
    FROM public.fn_ebd_chamada_classe($1, $2)
    `,
    [classId, date]
  );
  return result.rows;
}

async function loadAttendanceCallForUpdate(client, callId, idCadastro) {
  const result = await client.query(
    `
    SELECT
      ch.id_chamada,
      ch.id_classe,
      ch.data_chamada,
      ch.fechada
    FROM public.ebd_chamada ch
    INNER JOIN public.ebd_classe c
      ON c.id_classe = ch.id_classe
     AND c.id_cadastro = $2
    WHERE ch.id_chamada = $1
    FOR UPDATE
    `,
    [callId, idCadastro]
  );

  const callRow = result.rows[0];
  if (!callRow) {
    throw new HttpError(404, 'Chamada não encontrada.', 'attendance');
  }

  return callRow;
}

async function loadAttendanceStudentForUpdate(client, callId, studentClassId, idCadastro) {
  const result = await client.query(
    `
    SELECT
      ca.id_chamada_aluno,
      ca.status AS status_atual,
      ca.observacao AS observacao_atual,
      ch.id_chamada,
      ch.id_classe,
      ch.data_chamada,
      ch.fechada,
      a.status AS status_aluno
    FROM public.ebd_chamada_aluno ca
    INNER JOIN public.ebd_chamada ch
      ON ch.id_chamada = ca.id_chamada
    INNER JOIN public.ebd_classe c
      ON c.id_classe = ch.id_classe
     AND c.id_cadastro = $3
    INNER JOIN public.ebd_aluno_classe ac
      ON ac.id_aluno_classe = ca.id_aluno_classe
     AND ac.id_classe = ch.id_classe
    INNER JOIN public.ebd_aluno a
      ON a.id_aluno = ac.id_aluno
    INNER JOIN public.ebd_pessoa p
      ON p.id_pessoa = a.id_pessoa
     AND p.id_cadastro = $3
    WHERE ca.id_chamada = $1
      AND ca.id_aluno_classe = $2
    FOR UPDATE
    `,
    [callId, studentClassId, idCadastro]
  );

  const target = result.rows[0];
  if (!target) {
    throw new HttpError(404, 'Registro da chamada não encontrado no tenant atual.', 'attendance');
  }

  return target;
}

async function findAttendanceStudentForUpdate(client, callId, studentClassId, idCadastro) {
  const result = await client.query(
    `
    SELECT
      ca.id_chamada_aluno,
      ca.status AS status_atual,
      ca.observacao AS observacao_atual,
      ch.id_chamada,
      ch.id_classe,
      ch.data_chamada,
      ch.fechada,
      a.status AS status_aluno
    FROM public.ebd_chamada_aluno ca
    INNER JOIN public.ebd_chamada ch
      ON ch.id_chamada = ca.id_chamada
    INNER JOIN public.ebd_classe c
      ON c.id_classe = ch.id_classe
     AND c.id_cadastro = $3
    INNER JOIN public.ebd_aluno_classe ac
      ON ac.id_aluno_classe = ca.id_aluno_classe
     AND ac.id_classe = ch.id_classe
    INNER JOIN public.ebd_aluno a
      ON a.id_aluno = ac.id_aluno
    INNER JOIN public.ebd_pessoa p
      ON p.id_pessoa = a.id_pessoa
     AND p.id_cadastro = $3
    WHERE ca.id_chamada = $1
      AND ca.id_aluno_classe = $2
    FOR UPDATE
    `,
    [callId, studentClassId, idCadastro]
  );

  return result.rows[0] || null;
}

async function ensureAttendanceStudentForUpdate(client, callRow, studentClassId, idCadastro) {
  const existing = await findAttendanceStudentForUpdate(client, callRow.id_chamada, studentClassId, idCadastro);
  if (existing) {
    return existing;
  }

  await client.query(
    `
    INSERT INTO public.ebd_chamada_aluno (
      id_chamada,
      id_aluno_classe,
      status,
      observacao
    )
    SELECT
      $1,
      ac.id_aluno_classe,
      'ausente',
      ''
    FROM public.ebd_aluno_classe ac
    INNER JOIN public.ebd_aluno a
      ON a.id_aluno = ac.id_aluno
    INNER JOIN public.ebd_pessoa p
      ON p.id_pessoa = a.id_pessoa
     AND p.id_cadastro = $3
    WHERE ac.id_aluno_classe = $2
      AND ac.id_classe = $4
      AND ac.ativo = TRUE
      AND a.status = 'ativo'
    ON CONFLICT (id_chamada, id_aluno_classe) DO NOTHING
    `,
    [callRow.id_chamada, studentClassId, idCadastro, callRow.id_classe]
  );

  const inserted = await findAttendanceStudentForUpdate(client, callRow.id_chamada, studentClassId, idCadastro);
  if (inserted) {
    return inserted;
  }

  throw new HttpError(404, 'Registro da chamada não encontrado no tenant atual.', 'attendance');
}

async function updateAttendanceStatusTx(client, callRow, studentClassId, status, observation = '', idCadastro) {
  const normalizedObservation = typeof observation === 'string' ? observation.trim() : '';

  if (!['presente', 'atrasado', 'ausente'].includes(status)) {
    throw new HttpError(400, 'Status inválido.', 'attendance');
  }

  const target = await ensureAttendanceStudentForUpdate(client, callRow, studentClassId, idCadastro);

  if (target.fechada) {
    throw new HttpError(400, `Chamada ${callRow.id_chamada} está fechada.`, 'attendance');
  }

  const targetDate = formatDateInTimeZone(target.data_chamada);

  if (!isSameCivilDay(target.data_chamada, todayISO())) {
    throw new HttpError(
      400,
      `Só é permitido modificar chamada do dia atual (${todayISO()}). Data da chamada: ${targetDate || target.data_chamada}.`,
      'attendance'
    );
  }

  if (target.status_aluno !== 'ativo') {
    throw new HttpError(400, 'Aluno inativo não pode ser marcado na chamada.', 'attendance');
  }

  const updateResult = await client.query(
    `
    UPDATE public.ebd_chamada_aluno
       SET status = $3,
           observacao = $4
     WHERE id_chamada = $1
       AND id_aluno_classe = $2
    RETURNING id_chamada_aluno, status, observacao
    `,
    [callRow.id_chamada, studentClassId, status, normalizedObservation]
  );

  const updated = updateResult.rows[0];
  if (!updated) {
    throw new HttpError(404, 'Registro da chamada não encontrado no tenant atual.', 'attendance');
  }

  return updated;
}

async function updateAttendanceStatus(callId, studentClassId, status, observation = '', idCadastro) {
  return withTransaction(async (client) => {
    const callRow = await loadAttendanceCallForUpdate(client, callId, idCadastro);
    const updated = await updateAttendanceStatusTx(client, callRow, studentClassId, status, observation, idCadastro);

    if (status === 'ausente') {
      await client.query('SELECT public.fn_ebd_processar_inativacao_por_faltas($1)', [callRow.id_chamada]);
    }

    return updated;
  });
}

async function updateAttendanceStatuses(callId, students, idCadastro) {
  if (!Array.isArray(students) || students.length === 0) {
    throw new HttpError(400, 'students deve ser uma lista com pelo menos um item.', 'attendance');
  }

  return withTransaction(async (client) => {
    const callRow = await loadAttendanceCallForUpdate(client, callId, idCadastro);

    if (callRow.fechada) {
      throw new HttpError(400, `Chamada ${callId} está fechada.`, 'attendance');
    }

    if (!isSameCivilDay(callRow.data_chamada, todayISO())) {
      const targetDate = formatDateInTimeZone(callRow.data_chamada);
      throw new HttpError(
        400,
        `Só é permitido modificar chamada do dia atual (${todayISO()}). Data da chamada: ${targetDate || callRow.data_chamada}.`,
        'attendance'
      );
    }

    const normalizedStudents = students.map((student) => ({
      studentClassId: Number(
        student.studentClassId ??
          student.id_aluno_classe ??
          student.idAlunoClasse ??
          student.id_aluno_turma ??
          student.classStudentId
      ),
      status: String(student.status || '').trim().toLowerCase(),
      observacao: typeof student.observacao === 'string' ? student.observacao.trim() : ''
    }));

    const updated = [];
    let hasAbsence = false;

    for (const student of normalizedStudents) {
      const row = await updateAttendanceStatusTx(
        client,
        callRow,
        student.studentClassId,
        student.status,
        student.observacao,
        idCadastro
      );
      updated.push(row);
      if (student.status === 'ausente') hasAbsence = true;
    }

    if (hasAbsence) {
      await client.query('SELECT public.fn_ebd_processar_inativacao_por_faltas($1)', [callRow.id_chamada]);
    }

    return updated;
  });
}

async function markAllPresent(callId, idCadastro) {
  await ensureCallInTenant(callId, idCadastro);
  await query('SELECT public.fn_ebd_todos_presentes($1)', [callId]);
}

async function markAllAbsent(callId, idCadastro) {
  await ensureCallInTenant(callId, idCadastro);
  await query('SELECT public.fn_ebd_todos_ausentes($1)', [callId]);
}

async function closeAttendance(callId, idCadastro) {
  await ensureCallInTenant(callId, idCadastro);
  await query('SELECT public.fn_ebd_fechar_chamada($1)', [callId]);
}

async function reopenAttendance(callId, isAdmin, idCadastro) {
  const current = await ensureCallInTenant(callId, idCadastro);
  const callDate = formatDateInTimeZone(current.data_chamada);
  const allowReopen = isAdmin || isSameCivilDay(current.data_chamada, todayISO());

  if (!allowReopen) {
    throw new HttpError(403, `Somente administrador pode reabrir chamada fora da data atual. Data da chamada: ${callDate || current.data_chamada}.`, 'attendance');
  }

  await query(
    `
    UPDATE public.ebd_chamada
       SET fechada = FALSE,
           reaberta_em = NOW()
     WHERE id_chamada = $1
    `,
    [callId]
  );
}

async function registerVisitor(callId, name, observation = '', idCadastro) {
  const callRow = await ensureCallInTenant(callId, idCadastro);

  if (callRow.fechada) {
    throw new HttpError(400, `Chamada ${callId} está fechada.`, 'attendance');
  }

  if (!isSameCivilDay(callRow.data_chamada, todayISO())) {
    const targetDate = formatDateInTimeZone(callRow.data_chamada);
    throw new HttpError(
      400,
      `Só é permitido modificar chamada do dia atual (${todayISO()}). Data da chamada: ${targetDate || callRow.data_chamada}.`,
      'attendance'
    );
  }

  if (String(name ?? '').trim() === '') {
    throw new HttpError(400, 'O nome do visitante não pode ficar em branco.', 'attendance');
  }

  const result = await query(
    `
    WITH inserted AS (
      INSERT INTO public.ebd_chamada_visitante (
        id_chamada,
        nome,
        observacao
      )
      VALUES ($1, $2, COALESCE($3, ''))
      RETURNING id_chamada_visitante
    ),
    updated AS (
      UPDATE public.ebd_chamada ch
         SET visitantes = COALESCE(ch.visitantes, 0) + 1
        FROM inserted
       WHERE ch.id_chamada = $1
       RETURNING ch.id_chamada
    )
    SELECT inserted.id_chamada_visitante
    FROM inserted
    CROSS JOIN updated
    `,
    [callId, name, observation]
  );

  return result.rows[0]?.id_chamada_visitante || null;
}

async function registerOffer(callId, value, idCadastro) {
  await ensureCallInTenant(callId, idCadastro);
  const result = await query(
    'SELECT public.fn_ebd_registrar_oferta($1, $2) AS valor',
    [callId, value]
  );
  return result.rows[0]?.valor ?? 0;
}

async function saveCallSummary(callId, summary, idCadastro) {
  const callRow = await ensureCallInTenant(callId, idCadastro);

  if (callRow.fechada) {
    throw new HttpError(400, `Chamada ${callId} está fechada.`, 'attendance');
  }

  if (!isSameCivilDay(callRow.data_chamada, todayISO())) {
    const targetDate = formatDateInTimeZone(callRow.data_chamada);
    throw new HttpError(
      400,
      `Só é permitido salvar o resumo da chamada do dia atual (${todayISO()}). Data da chamada: ${targetDate || callRow.data_chamada}.`,
      'attendance'
    );
  }

  const result = await query(
    `
    UPDATE public.ebd_chamada ch
       SET oferta = COALESCE($2::numeric, 0),
           visitantes = COALESCE($3::integer, 0),
           biblias = COALESCE($4::integer, 0),
           revistas = COALESCE($5::integer, 0)
     WHERE ch.id_chamada = $1
     RETURNING
       ch.id_chamada,
       ch.id_classe,
       ch.oferta,
       ch.visitantes,
       ch.biblias,
       ch.revistas,
       ch.observacao
    `,
    [
      callId,
      summary?.oferta ?? null,
      summary?.visitantes ?? null,
      summary?.biblias ?? null,
      summary?.revistas ?? null
    ]
  );
  return result.rows[0] || null;
}

async function getCallSummary(date, idCadastro) {
  const result = await query(
    `
    WITH tenant_classes AS (
      SELECT id_classe
      FROM public.ebd_classe
      WHERE id_cadastro = $2
    ),
    call_base AS (
      SELECT
        ch.id_chamada,
        ch.id_classe,
        ch.oferta,
        ch.visitantes,
        ch.biblias,
        ch.revistas
      FROM public.ebd_chamada ch
      INNER JOIN tenant_classes tc
        ON tc.id_classe = ch.id_classe
      WHERE ch.data_chamada = $1
    ),
    attendance AS (
      SELECT
        ca.status
      FROM public.ebd_chamada ch
      INNER JOIN tenant_classes tc
        ON tc.id_classe = ch.id_classe
      INNER JOIN public.ebd_chamada_aluno ca
        ON ca.id_chamada = ch.id_chamada
      INNER JOIN public.ebd_aluno_classe ac
        ON ac.id_aluno_classe = ca.id_aluno_classe
       AND ac.id_classe = ch.id_classe
      INNER JOIN public.ebd_aluno a
        ON a.id_aluno = ac.id_aluno
      INNER JOIN public.ebd_pessoa p
        ON p.id_pessoa = a.id_pessoa
       AND p.id_cadastro = $2
      WHERE ch.data_chamada = $1
    ),
    call_totals AS (
      SELECT
        COALESCE(SUM(oferta), 0) AS oferta,
        COALESCE(SUM(visitantes), 0)::integer AS visitantes,
        COALESCE(SUM(biblias), 0)::integer AS biblias,
        COALESCE(SUM(revistas), 0)::integer AS revistas
      FROM call_base
    ),
    attendance_totals AS (
      SELECT
        COUNT(*)::bigint AS total_alunos,
        COUNT(*) FILTER (WHERE status IN ('presente', 'atrasado'))::bigint AS presentes,
        COUNT(*) FILTER (WHERE status = 'atrasado')::bigint AS atrasados,
        COUNT(*) FILTER (WHERE status = 'ausente')::bigint AS ausentes
      FROM attendance
    )
    SELECT
      NULL::bigint AS id_chamada,
      NULL::bigint AS id_classe,
      'Resumo Geral'::text AS classe,
      $1::date AS data_chamada,
      ct.oferta,
      ct.visitantes,
      ct.biblias,
      ct.revistas,
      ''::text AS observacao,
      at.total_alunos,
      at.presentes,
      at.atrasados,
      at.ausentes,
      ROUND(
        (
          at.presentes::numeric * 100
        ) / NULLIF(at.total_alunos, 0),
        1
      )::numeric(5,1) AS presenca_turma
    FROM call_totals ct
    CROSS JOIN attendance_totals at
    `,
    [date, idCadastro]
  );
  return result.rows;
}

async function getClassSummary(classId, date, idCadastro) {
  await ensureClassInTenant(classId, idCadastro);
  const result = await query(
    `
    WITH tenant_classes AS (
      SELECT id_classe, nome
      FROM public.ebd_classe
      WHERE id_cadastro = $3
    ),
    call_base AS (
      SELECT
        ch.id_chamada,
        ch.id_classe,
        tc.nome AS classe,
        ch.data_chamada,
        ch.oferta,
        ch.visitantes,
        ch.biblias,
        ch.revistas,
        ch.observacao
      FROM public.ebd_chamada ch
      INNER JOIN tenant_classes tc
        ON tc.id_classe = ch.id_classe
      WHERE ch.id_classe = $1
        AND ch.data_chamada = $2
    )
    SELECT
      cb.id_chamada,
      cb.id_classe,
      cb.classe,
      cb.data_chamada,
      cb.oferta,
      cb.visitantes,
      cb.biblias,
      cb.revistas,
      cb.observacao,
      COUNT(*)::bigint AS total_alunos,
      COUNT(*) FILTER (WHERE ca.status IN ('presente', 'atrasado'))::bigint AS presentes,
      COUNT(*) FILTER (WHERE ca.status = 'atrasado')::bigint AS atrasados,
      COUNT(*) FILTER (WHERE ca.status = 'ausente')::bigint AS ausentes,
      ROUND(
        (
          COUNT(*) FILTER (WHERE ca.status IN ('presente', 'atrasado'))::numeric * 100
        ) / NULLIF(COUNT(*), 0),
        1
      )::numeric(5,1) AS presenca_turma
    FROM call_base cb
    INNER JOIN public.ebd_chamada_aluno ca
      ON ca.id_chamada = cb.id_chamada
    INNER JOIN public.ebd_aluno_classe ac
      ON ac.id_aluno_classe = ca.id_aluno_classe
     AND ac.id_classe = cb.id_classe
    INNER JOIN public.ebd_aluno a
      ON a.id_aluno = ac.id_aluno
    INNER JOIN public.ebd_pessoa p
      ON p.id_pessoa = a.id_pessoa
     AND p.id_cadastro = $3
    WHERE a.status = 'ativo'
    GROUP BY
      cb.id_chamada,
      cb.id_classe,
      cb.classe,
      cb.data_chamada,
      cb.oferta,
      cb.visitantes,
      cb.biblias,
      cb.revistas,
      cb.observacao
    `,
    [classId, date, idCadastro]
  );
  return result.rows;
}

module.exports = {
  openAttendance,
  getAttendanceByClassAndDate,
  updateAttendanceStatus,
  updateAttendanceStatuses,
  markAllPresent,
  markAllAbsent,
  closeAttendance,
  reopenAttendance,
  registerVisitor,
  registerOffer,
  saveCallSummary,
  getCallSummary,
  getClassSummary
};
