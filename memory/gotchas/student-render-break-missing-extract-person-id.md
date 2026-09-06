# Helper de pessoa é obrigatória na listagem de alunos

## Problema
A tela de chamada pode deixar de renderizar os alunos quando o frontend passa a ler `personId` de cada registro, mas a função auxiliar que extrai o identificador da pessoa não existe ou não cobre os aliases retornados pela API.

## Causa
A listagem de alunos depende de normalização dos payloads de aluno e pessoa. Se o código chamar `extractPersonId(...)` sem essa função estar definida, o carregamento falha durante a normalização e a renderização não chega ao DOM.

## Solução
- Manter um helper explícito para extrair `id_pessoa`/`idPessoa`/`personId` dos payloads.
- Garantir que a normalização dos alunos e os fluxos de edição usem esse helper.
- Quando a lista “sumir”, revisar primeiro se houve referência nova sem função correspondente.
