# Edição de aluno precisa ler o status do raw

## Problema
Ao salvar a edição de um aluno, a mudança entre ativo e inativo pode parecer funcionar na tela, mas não persistir no backend.

## Causa
A tela usa objetos de aluno normalizados para renderização. Esses objetos não carregam o status de matrícula no topo; o valor confiável fica dentro de `raw`. Se a comparação usar apenas o objeto achatado, o fluxo pode assumir `ativo` por padrão e pular a chamada de ativação/inativação.

## Solução
- Comparar o status de edição a partir de `raw` quando ele existir.
- Tratar o objeto normalizado apenas como camada de exibição.
- Antes de decidir se chama `PUT /students/:id/activate` ou `PUT /students/:id/inactivate`, ler o estado persistido do payload original.


## Observação adicional
O campo `sexo` também precisa ser normalizado ao popular o `<select>`, porque o backend legado pode devolver `M`/`F` e a tela usa `masculino`/`feminino`.