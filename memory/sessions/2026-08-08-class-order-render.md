# Sessão 2026-08-08 — Ordem fixa das classes no front

## O que foi alterado
- A tela de classes passou a ordenar os cards segundo a sequência fixa do cadastro 1: `Cordeirinhos de Cristo`, `Shalon`, `Filhos de Asáfe`, `Mensageiros de Cristo`, `Filhos de Sião` e `Rosas de Saron`.
- A ordenação agora acontece no front antes da renderização, para não depender da ordem alfabética retornada pela API.

## Conhecimento consolidado
- O endpoint de classes ainda pode responder em ordem alfabética por `nome`; o front precisa aplicar a prioridade visual fixa quando a apresentação da lista importar.
- A sequência de exibição deve ser tratada como regra de UI do módulo de classes.

## Próximos passos
- Manter a prioridade fixa caso novos registros ou variações de nome sejam adicionados ao cadastro 1.
