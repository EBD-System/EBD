# Regra de validação de rotas

## Regra
Toda rota pública autenticada deve validar IDs, datas, enums e campos obrigatórios antes de chegar ao service.

## Aplicação
Rotas de auth, people, classes, students, attendance e reports usam middlewares de validação dedicados. As duas superfícies (`/api/v1` e legado) compartilham as mesmas regras.

## Regra adicional
JSON malformado recebido na camada HTTP também deve retornar `400` padronizado, com o mesmo envelope de erro do projeto.
