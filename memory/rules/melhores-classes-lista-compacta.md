# Lista compacta das Melhores Classes

## Regra
O submódulo **Melhores Classes** deve exibir apenas a lista das classes, em formato compacto de duas colunas: `Nome da classe` e `Participação`.

A participação exibida é a proporção das presenças (`presentes`/`alunos_presentes`) de cada classe em relação ao total de presenças das classes exibidas, com duas casas decimais e soma final de 100%. A ordenação visual é pela quantidade absoluta de presenças, da maior para a menor.

A consulta do ranking deve reutilizar o mesmo período do financeiro (`startDate`/`endDate`) para acompanhar o contrato atual do endpoint.

## Aplicação
Aplica-se à tela `src/modules/relatorios/melhores-classes/index.html` e a qualquer futura renderização desse ranking no frontend.
