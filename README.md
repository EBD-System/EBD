# Frontend EBD

Frontend estático organizado por domínio, pronto para consumo via API e publicação no GitHub Pages.

## Estrutura

- `src/app/` — configuração e bootstrap
- `src/modules/` — domínios do sistema
- `src/shared/` — código reutilizável
- `src/assets/` — recursos estáticos

## Execução local

```bash
npm install
npm start
```

## Publicação no GitHub Pages

```bash
npm run build
```

O build gera a pasta `docs/` com os arquivos estáticos prontos para Pages.
