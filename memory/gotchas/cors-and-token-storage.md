# CORS e armazenamento de token

## Problema
O front-end publicado em GitHub Pages chama a API em outro domínio e também pode chamar a API local em outro porto durante o desenvolvimento.

## Causa
A autenticação usa `fetch` para:

- `http://localhost:3000/api/v1/auth/login` no modo local;
- `https://ebd-fj9u.onrender.com/api/v1/auth/login` no modo de produção.

Como as origens são diferentes, o backend precisa permitir CORS para o domínio publicado no GitHub Pages e, se necessário, para a origem local usada no desenvolvimento.

## Solução
- Manter a URL base do backend configurada no front-end por ambiente.
- O token continua em `sessionStorage` por compatibilidade com a navegação estática, mas deve ser salvo como string simples, sem metadados extras.
- O leitor de sessão precisa aceitar tanto o formato novo (string) quanto o legado (objeto JSON).
- Usar `localStorage` apenas para preferências opcionais, como lembrar o usuário digitado.
- A migração real de segurança continua sendo `HttpOnly/Secure cookie` no backend, se essa opção estiver disponível.
