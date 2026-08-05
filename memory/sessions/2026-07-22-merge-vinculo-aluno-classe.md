# Sessão 2026-07-22 — Preservação do vínculo aluno-classe na mesclagem

## O que foi alterado
`src/modules/chamada/pages/chamada.js` passou a preservar o `id_aluno_classe` já encontrado quando as listas de alunos ativos e inativos são mescladas. A resposta mais recente continua podendo atualizar os demais campos, mas um vínculo válido não é mais apagado por um valor vazio vindo de outra resposta.

## Conhecimento consolidado
- O problema não estava no `PATCH` em si, e sim na construção do estado local antes do salvamento.
- Mesclar respostas parciais da API exige tratamento especial para campos de identidade, especialmente `id_aluno_classe`.
- Um aluno pode chegar com dados complementares em consultas diferentes; o front deve unir essas respostas sem perder a chave do vínculo.

## Próximos passos
- Manter a regra de preservação do vínculo em qualquer novo ponto do código que faça dedupe de alunos.
