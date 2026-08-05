# Sessão 2026-07-21

## O que foi alterado
A listagem de classes passou a usar o identificador real do banco ao abrir a chamada, evitando o uso de índice da lista como `classId`.

## Conhecimento consolidado
- O identificador correto da classe vem de `id_classe` no banco.
- O front deve reconhecer aliases compatíveis apenas quando a API variar o nome do campo.
- Nunca usar a posição do cartão na lista como substituto para a chave primária da classe.

## Próximos passos
Manter a navegação da tela de classes e o fluxo de matrícula sempre amarrados ao `classId` real retornado pela API.
