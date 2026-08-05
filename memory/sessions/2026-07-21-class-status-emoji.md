# Sessão 2026-07-21 — Indicador de chamada nas classes

## O que foi alterado
A tela de classes passou a exibir um emoji ao lado do nome de cada classe para indicar se a chamada já foi feita: `✅` quando `chamada_ja_feita` é verdadeira e `🟡` quando ainda não houve chamada.

## Conhecimento consolidado
- O front já recebe `chamada_ja_feita` no payload de `GET /classes`.
- O indicador visual deve aparecer ao lado do nome da classe, sem substituir o nome nem o ID.
- O estado da chamada precisa ser lido diretamente do payload da classe, sem chamadas extras.

## Próximos passos
Manter o cartão de classe alinhado ao payload do backend e reutilizar `chamada_ja_feita` sempre que o status visual da chamada precisar ser exibido.
