# Handoff

Antes de responder ou alterar o projeto, consulte primeiro a memória consolidada.

Pontos centrais:

- A fonte oficial continua sendo o Google Sheets via Apps Script.
- O navegador usa localStorage apenas para rascunhos e para a camada de memória consolidada.
- A chamada do dia exige marcação completa antes do salvamento.
- O endpoint `health` existe para checagem rápida do backend.
- Decisões arquiteturais devem ficar em arquivos curtos dentro de `memory/`.

- A edição de aluno agora acontece dentro do site, em um modal próprio.
- O código do aluno mostrado após `#` é somente leitura; a edição altera apenas nome, celular, turma e status.
- O backend ganhou a ação `updateAluno` para gravar essas alterações no Cadastro sem criar uma segunda fonte de verdade.
