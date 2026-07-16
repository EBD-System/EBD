# Cadastro público no frontend

## Passos

1. Abrir `cadastro/`.
2. Preencher o nome do cadastro/tenant, o nome da pessoa, login e senha.
3. Informar os dados opcionais da pessoa quando necessário.
4. Enviar o formulário para `POST /auth/register` com JSON, usando `cadastro_nome` como chave principal do tenant.
5. Conferir a mensagem de sucesso e seguir para a área de login.
