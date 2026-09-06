# Desenvolvimento reduzido: dashboard e classes

## Regra
Quando `developmentMode = false`, o dashboard deve exibir apenas os módulos **Classes** e **Relatórios**. No mesmo modo, a página de classes oculta o texto introdutório e o status de carregamento/sincronização.

## Aplicação
A filtragem acontece na navegação principal do dashboard antes da renderização dos cards. Na página de classes, a introdução “As classes abaixo vêm da API. Clique em uma delas para abrir a chamada.” e o texto de status “6 classes carregadas. Resumos da chamada sincronizados.” não devem aparecer quando `developmentMode` estiver desativado.

## Data
2026-08-04
