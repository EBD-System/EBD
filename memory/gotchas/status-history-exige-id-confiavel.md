# Histórico de status exige id do aluno confiável

## Problema
A consulta de `GET /students/:id/status-history` pode voltar o histórico de outro aluno ou gerar `404` quando o frontend usa identificadores inferidos, como posição da lista ou fallbacks de matrícula.

## Causa
O endpoint depende do `id` real do aluno. Se o payload não trouxer esse identificador de forma explícita, qualquer fallback posicional vira uma suposição insegura.

## Solução
- Tratar o `id` do aluno como dado autoritativo;
- se o backend não enviar um identificador confiável, não consultar o histórico;
- exibir o motivo apenas com os dados já disponíveis no payload principal ou com fallback visual degradado.
