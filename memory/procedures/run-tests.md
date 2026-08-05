# Procedimento: rodar a suíte de testes

## Passos

1. Executar `npm test` na raiz do projeto.
2. A suíte usa `node --test` para validar os fluxos principais: login, cadastro, matrícula, chamada, presença, relatórios, validação de tenant e bloqueios de acesso.
3. A suíte também inclui uma suíte dedicada aos módulos de negócio (pessoas, classes, alunos, chamada e relatórios) com cenários de CRUD, validações e isolamento por tenant.
4. A suíte também inclui testes de integração do tratamento global de erros, cobrindo `400`, `401`, `403`, `404`, `409` e `500` com o envelope oficial e confirmação de que o servidor continua respondendo após cada falha.
5. Fluxos encadeados de autenticação devem guardar o JWT em `src/shared/flow-context.js` para permitir subtestes subsequentes sem refazer o login.
6. Quando um fluxo precisar das turmas padrão, reutilizar o contexto compartilhado de `src/shared/flow-context.js` para manter o tenant e os ids das 6 turmas carregadas após o login.
6. Se houver falha por dependências ausentes no ambiente local, rodar `npm install` antes de repetir o teste.
