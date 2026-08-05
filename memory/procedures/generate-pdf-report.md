# Como gerar o relatório em PDF

1. Selecionar a data desejada.
2. Se necessário, salvar a chamada antes de gerar o relatório.
3. Antes de montar o PDF, o frontend deve consultar o backend com `action=reporttext` e `scope` adequado, usando a planilha como fonte oficial do relatório.
4. Gerar o documento a partir do texto retornado pelo backend.
5. Só usar snapshot local como contingência para navegação; o PDF não deve ser montado a partir dele.
