# Sessão 2026-08-10 — percentual das Melhores Classes

## O que foi alterado
- A tela `Melhores Classes` passou a calcular a participação percentual de cada classe usando `presentes`/`alunos_presentes`.
- A participação é relativa ao total de presenças das classes exibidas e é arredondada para duas casas, com ajuste de maior resto para fechar exatamente em 100,00%.
- A ordenação visual passou a considerar a quantidade absoluta de presenças, da maior para a menor.
- A tabela passou a identificar a coluna como `Participação`.
- Não foi necessário alterar o SQL nem o endpoint: o backend já entrega a quantidade de presenças necessária.

## Conhecimento consolidado
- `percentual_presenca` do endpoint continua representando a frequência da classe; não deve ser reutilizado como participação do ranking.
- A participação percentual das classes é responsabilidade da apresentação do submódulo `melhores-classes`.
