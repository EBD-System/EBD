# Memória viva do projeto ebd-api

Este projeto é uma API nova, separada do frontend existente, criada para servir dados e ações do PostgreSQL/Neon.
A pasta `memory/` deve guardar apenas conhecimento consolidado, útil para sessões futuras.
A organização canônica do backend vive em `src/modules/<modulo>/`, com controller, service, repository, routes e validator por módulo.
Os caminhos antigos em `src/controllers`, `src/services`, `src/repositories` e `src/routes` existem só como compatibilidade durante a migração.
