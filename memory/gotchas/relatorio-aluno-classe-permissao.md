# Relatório do Aluno — permissão da consulta de alunos

## Problema
A tela usa duas permissões existentes em pontos diferentes do fluxo: o módulo de Relatórios exige acesso a Relatórios, enquanto a listagem de alunos usa a rota de Classes.

## Causa
`GET /api/v1/classes/:id/students` é protegido por `CLASSES_VIEW`, enquanto `GET /api/v1/reports/student-report` é protegido por `REPORTS_VIEW`.

## Solução
O frontend não tenta contornar a autorização. Em HTTP 403, reutiliza `APP_ACCESS_DENIED_DIALOG` e interrompe a operação.

## Observação
Nenhuma alteração de backend/SQL é necessária apenas para implementar a tela, desde que o perfil autorizado já possua as permissões correspondentes.
