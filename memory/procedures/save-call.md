# Como salvar a chamada

1. Selecionar a data correta.
2. Escolher a turma.
3. Marcar cada aluno como presente, ausente ou atrasado.
4. Preencher oferta, visitantes, bíblias e revistas quando necessário.
5. Salvar apenas quando todas as linhas estiverem completas.
6. Ao clicar em **Salvar**, gravar imediatamente uma snapshot local da chamada da turma/data no navegador.
7. No envio para o Apps Script, manter o lote de alunos no corpo do POST e não duplicar `rowsJson` na URL.
8. Para abrir uma chamada antiga por data, procurar primeiro no armazenamento local; se não houver snapshot, consultar a planilha.
