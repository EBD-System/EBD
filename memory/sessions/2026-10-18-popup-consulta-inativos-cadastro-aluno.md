# Sessão 2026-10-18 — Consulta de inativos antes do cadastro

## Alterações
- O popup `Adicionar aluno` abre com uma etapa compacta que lista alunos inativos da turma e oferece `Criar Novo Aluno`.
- O botão de criação troca para o formulário existente; a lista deixa de ser exibida nessa etapa.
- Cada aluno listado tem ação de ativação via endpoint existente; o frontend atualiza os cards e consulta novamente os inativos.
- Adicionado teste estático para estrutura, escopo por turma, contrato de ativação e estilo compacto.

## Conhecimento consolidado
- A listagem deve permanecer filtrada por `classId`; não usar `/students/inactive` sem turma no popup.
- O endpoint de ativação individual usa o ID global do aluno e não um ID de vínculo aluno-turma.

## Próximos passos
- Validar no ambiente integrado a resposta real dos endpoints e a ativação de um aluno que possua vínculos com mais de uma turma.
