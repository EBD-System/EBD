# Regra de estrutura modular

## Regra

Os módulos principais do backend devem existir em `src/modules/<modulo>/` e cada módulo deve ter `controller.js`, `service.js`, `repository.js`, `routes.js` e `validator.js`. Os arquivos espelho em `src/controllers`, `src/services`, `src/repositories` e `src/routes` devem permanecer apenas como compatibilidade e apontar para os módulos canônicos.

## Aplicação

As rotas canônicas continuam em `/api/v1`, mas a implementação deve ser organizada por módulo e os carregamentos principais devem apontar para essa camada. Qualquer nova regra de negócio deve entrar primeiro no módulo canônico, nunca no caminho legado.
