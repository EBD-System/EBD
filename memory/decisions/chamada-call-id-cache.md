# CallId da chamada na query string

## Decisão
O `callId` da chamada deve ser mantido na query string da própria tela (`?callId=...`) e atualizado com `history.replaceState` sempre que a chamada válida for descoberta ou aberta. Não usar `sessionStorage` para esse identificador.

## Motivo
O `callId` é específico da turma e do dia atual. Guardá-lo na URL evita reaproveitar um ID antigo entre sessões, deixa a tela compartilhável/recarregável e reduz o risco de salvar presença contra uma chamada desatualizada.

## Data
2026-07-21
