# Regra de mensagens de erro

## Regra
Todas as páginas que chamam a API devem usar o cliente compartilhado `src/shared/services/api-client.js` para montar mensagens de erro, e o modo de detalhamento deve respeitar `errorDevelopmentMode`. Respostas com HTTP 2xx e `ok:false` também devem ser tratadas como erro pelo frontend.

## Aplicação
- Em desenvolvimento, erros de backend podem mostrar HTTP status, mensagem principal e detalhes adicionais;
- em produção, a interface deve exibir uma mensagem curta e amigável;
- erros de validação de formulário devem permanecer simples mesmo em desenvolvimento, sem expor payload bruto;
- o formato de resumo de falhas em lote deve sair de um único lugar para evitar mensagens divergentes entre módulos;
- em modo de desenvolvimento, o resumo pode exibir a mensagem bruta do backend por item, mas sem repetir o prefixo `HTTP ...` duas vezes;
- quando o fluxo precisar exibir o motivo exato retornado pela API, priorize `error.primaryMessage`/`error.backendMessage` antes de cair em `error.message`, porque a mensagem principal pode ser amigável e genérica em produção;
- quando a API devolver `{ ok: false, message: "..." }` com status HTTP 2xx, o frontend ainda deve lançar erro e mostrar a mensagem do payload.
