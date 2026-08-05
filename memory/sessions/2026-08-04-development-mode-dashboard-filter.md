# Sessão 2026-08-04 — Filtro de módulos no dashboard

## O que foi alterado
- Criado/ajustado `src/app/config/config.js` para concentrar o flag `developmentMode` e as regras de visibilidade.
- O dashboard filtra a navegação quando `developmentMode` está desativado.
- Em modo reduzido, apenas **Classes** e **Relatórios** permanecem visíveis.
- A página de classes também oculta o texto introdutório e o status de carregamento/sincronização no mesmo modo.

## Conhecimento consolidado
- A configuração compartilhada agora aceita expansão sem sobrescrever campos já definidos.
- O ambiente local pode injetar `process.env.developmentMode` em `window.APP_RUNTIME_CONFIG` antes de `config.js`; esse valor tem prioridade sobre o arquivo e sobre os padrões internos.
- O dashboard é o ponto de filtragem dos módulos visíveis, e a página de classes também respeita o modo reduzido para reduzir ruído visual.

## Próximos passos
- Ajustar o `process.env.developmentMode` ou o valor do `config.js` quando for necessário alternar entre a navegação completa e a reduzida.
