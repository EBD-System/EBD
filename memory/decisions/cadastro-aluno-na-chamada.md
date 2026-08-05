# Cadastro e edição de aluno na tela de chamada

## Decisão
A tela de chamada usa um único formulário para criar e editar aluno.

Fluxo consolidado:
- criação: `POST /people` → `POST /students/enroll`;
- edição de dados cadastrais: `PUT /people/:id`;
- mudança de status na edição: `PUT /students/:id/activate` ou `PUT /students/:id/inactivate`;
- exclusão visual do card: o frontend usa inativação como fallback, porque o backend não expõe `DELETE` para aluno.

O campo **Data de início** continua bloqueado na edição e o toggle de status é o caminho suportado para ativar ou inativar o aluno.

## Motivo
O backend disponível é read-only para exclusão física e não oferece `PUT /students/:id`; então a edição precisa combinar pessoa + status, e o botão de excluir precisa cair na operação suportada de inativação.

## Data
2026-08-03
