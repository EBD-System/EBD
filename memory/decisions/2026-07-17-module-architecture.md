# Estrutura modular canônica do backend

## Decisão

A camada canônica do backend fica em `src/modules/<modulo>/` para os módulos principais (`auth`, `pessoas`, `classes`, `alunos`, `chamadas`, `relatorios`). Cada módulo expõe `controller`, `service`, `repository`, `routes` e `validator`, e os arquivos antigos em `src/controllers`, `src/services`, `src/repositories` e `src/routes` foram removidos quando eram duplicatas da implementação canônica.

## Motivo

A organização por módulo reduz acoplamento entre áreas funcionais, facilita manutenção e deixa claro onde a implementação viva deve ser alterada. A migração encerrou os caminhos legados duplicados para evitar manutenção paralela.

## Data

2026-07-17
