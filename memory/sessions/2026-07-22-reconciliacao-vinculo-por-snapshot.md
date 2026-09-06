# Sessão 2026-07-22 — Reconciliação do vínculo aluno-classe pelo snapshot

## O que foi alterado
`src/modules/chamada/pages/chamada.js` passou a:
- preservar `id_aluno_classe` quando respostas parciais são mescladas;
- reconciliar alunos sem vínculo usando o snapshot atual da chamada;
- tentar recuperar `id_aluno_classe` também no cadastro de aluno da própria tela antes de falhar.

## Conhecimento consolidado
- O backend fornece o vínculo correto no snapshot da chamada; o frontend deve usá-lo para completar o estado local quando alguma resposta auxiliar vier incompleta.
- A regra continua sendo: não inventar `studentClassId`; só salvar após reconciliação com dados reais da API.
- O fluxo de cadastro e o fluxo de salvamento precisam usar a mesma fonte de verdade para o vínculo do aluno com a classe.

## Próximos passos
- Manter a reconciliação como etapa explícita sempre que novos pontos do frontend consumirem alunos da chamada.
