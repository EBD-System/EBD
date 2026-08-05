# Sessão 2026-07-21 — Correção estrita do vínculo aluno-classe na chamada

## O que foi alterado
`src/modules/chamada/pages/chamada.js`:
- `extractStudentClassId()` deixou de aceitar `id_matricula`, `id` e fallback por posição.
- O fluxo de chamada agora valida explicitamente a presença de `id_aluno_classe` antes de salvar.
- A criação de aluno na tela de chamada também passa a exigir o vínculo retornado pela API; sem ele, o item não entra na lista.

## Conhecimento consolidado
- O `PATCH /attendance/:callId/students/:studentClassId` deve usar o vínculo real do aluno com a classe, não matrícula, não ID genérico e não índice visual.
- Quando o backend não devolver `id_aluno_classe`, o frontend deve falhar de forma explícita para evitar salvar presença no registro errado.
- O risco existe tanto no carregamento dos alunos quanto no cadastro de um aluno novo durante a chamada.

## Próximos passos
- Validar se `GET /classes/:id/students` e o retorno de `POST /students/enroll` sempre incluem `id_aluno_classe`.
- Se algum endpoint omitir o vínculo, corrigir o backend em vez de reintroduzir fallback no frontend.
