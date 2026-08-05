# Procedimento: publicar no Render

## Passos

1. Definir `DATABASE_URL`, `JWT_SECRET` e `CORS_ORIGINS` no painel do Render.
2. Rodar `npm install` no build.
3. Iniciar com `node server.js`.
4. Validar `GET /health`.
5. Testar login e uma rota protegida com token JWT.
