# Login público no frontend

## Passos

1. Abrir `/login` ou `/login/`.
2. Informar nome de usuário e senha.
3. Enviar o formulário para `POST /auth/login` em JSON.
4. Persistir a sessão retornada pelo backend no `localStorage`.
5. Salvar automaticamente o último nome de usuário usado como preferência local para pré-preenchimento futuro.
6. Entrar na chamada após a autenticação bem-sucedida.
7. Ao abrir `/login` com uma sessão já salva, redirecionar imediatamente para `/chamada`.
8. Na tela principal, usar o botão “Sair” para limpar a sessão local e voltar para `/login`.

## Observação

A tela de login deve ficar enxuta: apenas nome de usuário, senha, botão de entrar e botão de criar cadastro.
