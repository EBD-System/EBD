# Decisão: vinculação tenant reforçada em pessoas, alunos e classes

## Decisão

As consultas de pessoas, alunos e classes devem validar `id_cadastro` não apenas no filtro principal, mas também nos joins internos de usuário, matrícula e vínculo de classe. As operações de matrícula, ativação e inativação de aluno passam a receber o tenant explicitamente para uma segunda validação antes de chamar as funções do banco.

## Motivo

Isso reduz o risco de associação cruzada entre cadastros em listas, contagens e fluxos de vínculo, mesmo quando o dado legado estiver inconsistente ou quando funções do banco forem chamadas com IDs isolados.

## Data

2026-07-17
