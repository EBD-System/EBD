# Salvar chamada

## Passos

1. Validar que todos os alunos ativos tenham um estado definido.
2. Montar o payload com a data, a turma, a oferta, os visitantes e os registros de presença.
3. Enviar o POST para a API HTTP do backend.
4. Se houver fallback de compatibilidade, repetir a mesma ação como GET sem duplicar `rowsJson` na URL.
5. Registrar a snapshot local da chamada salva e liberar a navegação normal.
