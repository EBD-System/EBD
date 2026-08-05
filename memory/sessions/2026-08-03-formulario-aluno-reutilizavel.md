# Sessão 2026-08-03

## O que foi alterado
- A tela de chamada foi conectada aos endpoints reais de aluno e pessoa.
- O formulário único agora salva criação e edição.
- A edição usa `PUT /people/:id` para os dados cadastrais e `PUT /students/:id/activate|inactivate` para o status.
- O botão **Excluir aluno** passou a acionar a inativação como fallback, já que o backend não possui DELETE.
- A tela voltou a refletir o contrato real do backend em vez de ficar como esqueleto.

## Conhecimento consolidado
- Não existe endpoint DELETE para aluno no backend atual.
- O fluxo suportado para persistir status é `activate` / `inactivate`.
- O fluxo suportado para editar dados cadastrais é `PUT /people/:id`.
- O formulário de aluno continua reutilizável para cadastro e edição, com data de início bloqueada na edição.

## Próximos passos
- Manter essa integração alinhada ao contrato real do backend.
- Evitar reintroduzir comentários de “backend futuro” no fluxo que já está conectado.


## Atualização técnica
- Corrigido o erro de renderização da lista de alunos causado pela ausência do helper `extractPersonId(...)` no frontend.
