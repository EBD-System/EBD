# Sistema de Lista de Presença da EBD

Projeto reorganizado em uma base modular, mantendo o comportamento original e separando responsabilidades para facilitar manutenção.

## Estrutura

```text
project/
├── index.html
├── backend/
│   └── backend.gs
├── src/
│   ├── css/
│   │   ├── base.css
│   │   ├── layout.css
│   │   ├── components.css
│   │   ├── pages.css
│   │   └── utilities.css
│   ├── js/
│   │   ├── app.js
│   │   ├── config/
│   │   │   └── app.config.js
│   │   ├── components/
│   │   │   └── access.js
│   │   ├── modules/
│   │   │   ├── call-actions.js
│   │   │   └── actions.js
│   │   ├── services/
│   │   │   ├── api.js
│   │   │   ├── memory.js
│   │   │   └── pdf.js
│   │   ├── state/
│   │   │   └── call-state.js
│   │   └── utils/
│   │       └── helpers.js
│   ├── assets/
│   │   ├── images/
│   │   ├── icons/
│   │   └── fonts/
│   └── data/
├── memory/
│   ├── decisions/
│   ├── gotchas/
│   ├── procedures/
│   ├── rules/
│   ├── sessions/
│   └── handoff.md
└── README.md
```

## Observações técnicas

- A interface foi mantida sem mudanças visuais intencionais.
- O HTML principal segue enxuto e apenas carrega os módulos necessários.
- O JavaScript foi dividido por responsabilidade, preservando a sequência de execução do projeto original.
- O CSS foi repartido por camada: base, layout, componentes, páginas e utilidades.
- O backend do Apps Script foi preservado e movido para a pasta `backend/`.

## Melhorias futuras recomendadas

- Migrar os arquivos JavaScript para ES modules com exportações explícitas.
- Criar uma camada de testes para validação de presença, relatórios e regras de turma.
- Introduzir um processo de build para minificação e bundling.
- Separar o modelo de dados do renderizador de interface para facilitar evolução.


## Camada de memória

O projeto agora inclui uma camada de memória viva para consolidar decisões, procedimentos, armadilhas e regras em documentos curtos, além de um cache local em `src/js/services/memory.js` que registra sessões e sincroniza um resumo inicial vindo do backend e também mantém a wiki em `memory/`.
