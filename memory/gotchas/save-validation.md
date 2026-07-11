# Armadilha: salvamento bloqueado

## Problema
Se houver aluno sem presença, ausência ou atraso marcado, o backend rejeita o envio.

## Causa
A chamada não é tratada como concluída até que cada linha esteja preenchida.

## Solução
Marque todos os alunos antes de salvar.

## Observação adicional
As ações ao Apps Script devem sair em minúsculas. Além disso, o Web App pode cair em redirecionamento antes de concluir a requisição; por isso, o cliente envia `action` também na query string e o backend roteia tanto GET quanto POST.
