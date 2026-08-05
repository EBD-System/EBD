# Decisão: API separada para o frontend EBD

## Decisão

O backend oficial da aplicação é um projeto novo chamado `ebd-api`, criado do zero para servir a aplicação EBD.

## Motivo

Separar a camada de dados e regras reduz acoplamento, facilita deploy no Render e preserva o repositório original.

## Observação

A API não mantém mais ponte de compatibilidade HTTP para o frontend legado baseado em `action`/`acao`.

## Data

2026-07-15
