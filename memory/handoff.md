# Handoff

Antes de responder ou alterar o projeto, consulte primeiro a memória consolidada.

Pontos centrais:

- A fonte oficial continua sendo o Google Sheets via Apps Script.
- O navegador usa localStorage apenas para rascunhos e para a camada de memória consolidada.
- A chamada do dia exige marcação completa antes do salvamento.
- O endpoint `health` existe para checagem rápida do backend.
- O cadastro de alunos usa número imutável após `#`: criar gera o próximo número livre, editar preserva e excluir remove sem reaproveitar o número.
- Decisões arquiteturais devem ficar em arquivos curtos dentro de `memory/`.
