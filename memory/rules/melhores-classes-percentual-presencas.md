# Percentual das Melhores Classes

## Regra
Na tela **Melhores Classes**, a coluna de percentual representa a participação de cada classe no total de presenças das classes exibidas no ranking, e não a taxa de frequência da classe.

## Cálculo
`participação = presentes_da_classe / soma_presentes_das_classes_exibidas * 100`

O frontend arredonda para duas casas decimais e distribui o restante do arredondamento para garantir que a soma exibida seja exatamente **100,00%** quando houver pelo menos uma presença.

## Aplicação
O frontend usa `presentes` ou `alunos_presentes` já retornado por `GET /api/v1/reports/classes-ranking`. Não é necessário alterar o SQL/backend para esse cálculo.

A ordenação visual acompanha a quantidade absoluta de presenças, do maior para o menor.
