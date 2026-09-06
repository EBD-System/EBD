# Relatório geral exige chamada registrada

## Problema
A tela de classes podia tentar carregar o `Relatório Geral` logo na abertura e disparar erro quando ainda não existia nenhuma chamada no dia.

## Causa
O endpoint `GET /api/v1/attendance/summary` e os rankings dependem de base de chamada já existente. Sem nenhuma chamada registrada, a consulta pode retornar erro interno em vez de um resumo vazio.

## Solução
Antes de chamar o relatório geral, verificar se a listagem de classes já indica pelo menos uma chamada existente. Se não houver chamada, manter a seção em estado de espera e não fazer a requisição.
