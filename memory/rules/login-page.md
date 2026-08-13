# Regras da tela de login

## Regra
A primeira tela do projeto é sempre a tela de login. O login redireciona para o dashboard após autenticação bem-sucedida.

## Aplicação
- Fundo branco;
- botões azuis;
- link de recuperação em azul apontando para WhatsApp;
- checkbox "Lembrar usuário" não pode salvar senha;
- token deve ficar em `sessionStorage`, não em texto plano no HTML;
- o front-end precisa funcionar sem depender de rotas do Express quando publicado em GitHub Pages;
- no desenvolvimento local, o Express deve servir o diretório raiz do projeto para manter os mesmos caminhos estáticos usados em produção.

## Atualização 2026-08-13 — identidade visual e carregamento

### Regra
A tela de login usa a identidade da Escola Bíblica Dominical e concentra o carregamento de autenticação em uma camada visual de tela inteira.

### Aplicação
- Usar `Escola Bíblica Dominical` como identificação secundária no cabeçalho do card.
- O título do formulário é `Login`.
- Não exibir a frase de acesso por credenciais sob o título do formulário.
- Exibir a frase `"O maior entre vocês é aquele que serve."` de forma discreta, em texto pequeno e de cor fraca, na área de identidade visual.
- Exibir a logo da Assembleia de Deus fornecida pelo usuário com fundo transparente; manter a logo ligeiramente menor que a versão anterior.
- A área de identidade visual não deve exibir um `h1` textual de `Escola Bíblica Dominical`.
- Durante a autenticação, exibir um overlay branco de tela inteira que bloqueia interação e rolagem.
- O estado de carregamento usa indicador animado; sucesso mostra um `V` azul antes do redirecionamento e erro mostra um `X` antes de liberar a tela.
- Essa personalização é exclusiva da tela de login; nenhuma outra tela ou fluxo visual deve herdar essa camada.

## Atualização 2026-08-13 — proximidade entre identidade e formulário

- Na composição responsiva da tela de login, a frase deve ficar visualmente quase encostada ao card de login, evitando grandes áreas vazias entre a frase e o formulário.
- A logo deve ficar no canto superior da área de identidade, pequena e separada da frase por uma distância moderada.
- O ajuste é estritamente visual e não altera a lógica de autenticação.

## Atualização 2026-08-13 — frase integrada à linha acima do card

### Regra
A frase `"O maior entre vocês é aquele que serve."` deve ficar centralizada sobre uma linha azul imediatamente acima do card de login, visualmente integrada ao card e sem espaçamento vertical desnecessário.

### Aplicação
- A frase não permanece como conteúdo separado da área de identidade.
- O bloco da frase/linha deve ficar diretamente no topo do conjunto do formulário.
- Em telas estreitas, a linha continua imediatamente acima do card, preservando a mesma composição.
- A alteração é exclusivamente visual e não modifica a autenticação.

## Atualização 2026-08-13 — remoção dos vazios no mobile

### Regra
Em telas estreitas, a composição do login deve começar no topo e empilhar a logo, a frase/linha e o card sem grandes áreas vazias.

### Aplicação
- O grid mobile usa `align-content: start` e `align-items: start` para impedir que as linhas sejam esticadas verticalmente.
- O padding superior do shell é mínimo.
- A margem inferior da área da logo é pequena, deixando o conjunto frase + card imediatamente abaixo.
- O ajuste é exclusivamente visual e não altera a lógica de autenticação.
## Atualização 2026-08-13 — rolagem desativada

### Regra
A tela de login não deve apresentar rolagem vertical ou horizontal na composição normal da página.

### Aplicação
- `body` mantém `overflow: hidden` na tela de login.
- O bloqueio é permanente na tela de login, e não depende apenas do estado de carregamento.
- A alteração é visual e não modifica a autenticação.

## Atualização 2026-08-13 — feedback de autenticação lenta e credenciais inválidas

### Regra
O overlay de login deve comunicar progresso durante a espera sem afirmar sucesso antes da resposta real do endpoint. Falhas de credencial devem usar mensagem específica de login.

### Aplicação
- As mensagens de espera devem alternar automaticamente enquanto a requisição estiver pendente.
- A confirmação `Credenciais confirmadas. Entrando...` só pode aparecer depois de o frontend receber e validar uma resposta de sucesso com token.
- HTTP 401 ou payload que identifique explicitamente credencial inválida deve resultar em `Usuário ou senha inválidos.`.
- A mensagem genérica `Sua sessão expirou. Faça login novamente.` não deve ser apresentada como resultado de uma tentativa de login inválida.
- O comportamento é exclusivo da tela de login; o `api-client.js` compartilhado não deve ser alterado para corrigir essa copy específica.

## Atualização 2026-08-13 — duração variável das mensagens de carregamento

- As mensagens do overlay de autenticação não devem trocar em intervalo fixo.
- Cada etapa possui duração própria entre 3 e 5 segundos, refletindo aproximadamente o tempo esperado da operação, sem simular validação de credenciais antes da resposta real.
- Durações atuais: `Verificando` 3,2 s; `Estabelecendo conexão` 3,8 s; `Consultando o servidor` 4,4 s; `Aguardando a resposta` 5 s; `Preparando seu acesso` 4,2 s; `Finalizando a autenticação` 3,6 s.
- O timer é cancelado assim que o servidor responde, seja com sucesso ou erro.
