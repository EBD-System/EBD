# Como gerar o relatório em PDF

1. Selecionar a data desejada.
2. Se necessário, salvar a chamada antes de gerar o relatório.
3. Antes de montar o PDF, o frontend deve consultar o backend com `action=init` e `preferLocal=false`, para carregar os dados diretamente da planilha.
4. Gerar o documento a partir do estado revalidado no backend.
5. Só usar snapshot local como contingência quando o backend não estiver disponível.
