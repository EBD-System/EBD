# Regras da tela de login

## Regra
A primeira tela do projeto é sempre a tela de login. O login redireciona para o dashboard após autenticação bem-sucedida.

## Aplicação
- Fundo branco;
- botões azuis;
- link de recuperação em azul apontando para WhatsApp;
- checkbox "Lembrar usuário" não pode salvar senha;
- token deve ficar em `sessionStorage`, não em texto plano no HTML;
- o front-end precisa funcionar sem depender de rotas do Express quando publicado em GitHub Pages;
- no desenvolvimento local, o Express deve servir o diretório raiz do projeto para manter os mesmos caminhos estáticos usados em produção.

