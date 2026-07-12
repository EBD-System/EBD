# Armadilha: `nowIso` ausente no fluxo de salvar chamada

## Problema
Ao clicar em **Salvar chamada**, a persistência local pode quebrar com `nowIso is not defined`.

## Causa
O módulo `src/js/services/api.js` usa timestamp para registrar snapshots locais da chamada, mas o helper de data/hora não estava definido nesse arquivo.

## Solução
Manter `function nowIso() { return new Date().toISOString(); }` disponível no próprio módulo de API antes de gravar a snapshot local.
