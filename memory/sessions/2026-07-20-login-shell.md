# Sessão 2026-07-20

## O que foi alterado
Criada uma base de login única com visual religioso limpo, integração com `POST /api/v1/auth/login`, lembrete apenas do usuário e link de recuperação para WhatsApp. Também foi adicionada a estrutura Express local e a saída estática para GitHub Pages.

## Conhecimento consolidado
- O projeto precisa manter uma fonte estática compatível com GitHub Pages.
- O token do login deve ficar apenas na sessão atual.
- O lembrete persiste somente o nome de usuário.
- Após autenticação bem-sucedida, o fluxo atual redireciona para o dashboard inicial em `src/modules/dashboard/pages/home/index.html`.

## Próximos passos
Evoluir a primeira tela do dashboard aos poucos, sem quebrar o redirect já estabelecido.
