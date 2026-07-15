# Login público no frontend

## Passos

1. Abrir `/login` ou `/login/`.
2. Informar login e senha.
3. Enviar o formulário para `POST /auth/login` em JSON.
4. Persistir a sessão retornada pelo backend no `localStorage`.
5. Se a opção de lembrar o nome de usuário estiver marcada, salvar também o login informado como preferência local.
6. Entrar na chamada após a autenticação bem-sucedida.
7. Ao abrir `/login` com uma sessão já salva, redirecionar imediatamente para `/chamada`.

## Observação

A tela de login deve exibir apenas os campos essenciais, o atalho "Esqueci minha senha" e o botão de cadastro.
