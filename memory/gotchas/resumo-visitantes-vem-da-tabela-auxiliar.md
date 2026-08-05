# Visitantes do resumo agora são persistidos

## Problema
O resumo da chamada podia perder o valor digitado em `visitantes` porque a leitura ainda vinha da tabela de visitantes nomeados.

## Causa
O schema foi ajustado para armazenar `visitantes` em `ebd_chamada`, mantendo `ebd_chamada_visitante` apenas para os registros nominais.

## Solução
Salvar `visitantes` junto com `oferta`, `biblias` e `revistas` em `ebd_chamada`. As leituras de resumo e os rankings que usam total consolidado devem consumir a coluna persistida, enquanto a tabela auxiliar continua servindo aos detalhes nominais.

## Atenção
Se a query usar placeholders posicionais, não deixe parâmetros órfãos na lista enviada ao `pg`; parâmetros não referenciados podem gerar erro de inferência de tipo no PostgreSQL (`could not determine data type of parameter $N`).
