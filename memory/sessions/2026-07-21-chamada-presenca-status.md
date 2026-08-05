# Sessão 2026-07-21 — Chamada com status de presença

## O que foi alterado
A tela de chamada passou a exibir, para cada aluno, três botões de presença (**Presente**, **Atrasado** e **Ausente**) com estado inicial carregado da API. Também foi adicionado o botão **Salvar Chamada** para persistir os status via `PATCH` individual por aluno. Foi corrigido um problema de renderização em que a lista podia ficar presa no estado de carregamento mesmo com os dados já carregados.

## Conhecimento consolidado
- O fluxo de chamada precisa separar o status de matrícula do status de presença do dia.
- A chamada deve tentar obter o snapshot em `GET /classes/:id/attendance` e no fallback `GET /attendance/classes/:classId`.
- Quando não houver chamada aberta, o front deve usar `POST /attendance/open` e só liberar o salvamento depois de obter `callId`.
- O botão final de salvamento deve persistir a presença de cada aluno com `PATCH /attendance/:callId/students/:studentClassId`.
- A renderização da lista não pode depender de `loadingStudents` continuar verdadeiro depois que os registros já foram carregados; a tela precisa re-renderizar quando a carga terminar.

## Próximos passos
Se o backend passar a devolver sempre o `callId` e os registros da chamada em uma única resposta, o fluxo pode ser simplificado e a chamada aberta pode ser resolvida com menos tentativas.
