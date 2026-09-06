# Sessão 2026-08-03 — Persistência do status na edição de aluno

## O que foi alterado
A comparação do status na edição de aluno passou a ler o payload original (`raw`) antes de decidir se chama `PUT /students/:id/activate` ou `PUT /students/:id/inactivate`. Isso corrige o caso em que a ativação parecia acontecer na interface, mas não era persistida.

## Conhecimento consolidado
- O objeto de aluno normalizado usado na tela pode não ter `status` no topo.
- Para decidir mutações de matrícula, o front deve ler o status a partir de `raw` sempre que possível.
- A ativação/inativação real continua no backend por `PUT /students/:id/activate|inactivate`.

## Próximos passos
- Manter a leitura do status alinhada com o payload original em qualquer novo fluxo de edição.
