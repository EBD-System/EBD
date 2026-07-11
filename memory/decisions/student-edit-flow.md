# Edição de aluno em página dedicada

## Decisão
A edição de aluno continua acontecendo em uma página própria em `aluno/editar-aluno/`, aberta a partir do botão **Editar**. O identificador de edição prioriza o nome atual do aluno, que é a chave usada pelo fluxo manual confirmado no backend. O código exibido após `#` permanece visível e somente leitura.

## Motivo
O fluxo funciona melhor no GitHub Pages, evita depender de modal em tela pequena e deixa a edição mais estável em uma rota direta. O uso do nome como chave simplifica o alinhamento com o backend e evita divergência entre `Nome` e `AlunoID` derivado. O backend também passou a preservar turma e status atuais quando esses campos não vêm no payload, o que permite edição parcial do nome. A página de edição agora mostra o status apenas como leitura temporária e inclui a exclusão direta do aluno com confirmação.

## Data
2026-07-11
