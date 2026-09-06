# Sessão 2026-07-22 — Salvamento da chamada em lote

## O que foi alterado
`src/modules/chamada/pages/chamada.js`:
- O salvamento da chamada passou a usar um único `PATCH /attendance/:callId`.
- O corpo enviado agora contém `students[]` com `studentClassId`/`id_aluno_classe` e `status`.
- O fluxo continua validando `id_aluno_classe` antes de salvar e ainda reconcilia o vínculo com o snapshot da chamada.

## Conhecimento consolidado
- O caminho canônico para salvar presença é em lote, não por aluno.
- O frontend precisa manter a reconciliação do vínculo aluno-classe antes do envio, porque a API ainda pode omitir o `id_aluno_classe` em algumas respostas.
- O envio individual permanece apenas para compatibilidade histórica.

## Próximos passos
- Validar o batch em ambiente real com uma chamada contendo vários status alterados.
- Manter a regra do vínculo obrigatório para bloquear qualquer fallback posicional.
