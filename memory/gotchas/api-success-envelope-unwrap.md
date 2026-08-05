# Respostas de sucesso da API precisam ser desembrulhadas no editor de aluno

## Problema
A edição do aluno podia reaproveitar o envelope inteiro da resposta e perder os campos úteis ao aplicar a mutação local.

## Causa
O backend responde em envelope `{ ok, message, data }`, mas o editor trabalha com os dados de negócio. Se o frontend usar o envelope bruto, o merge local fica incompleto.

## Solução
No fluxo da tela de chamada, extrair `payload.data` das respostas de sucesso antes de atualizar o estado local e de reaplicar os dados no modal.

## Data
2026-08-03
