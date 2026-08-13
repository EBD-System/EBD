## Estado atual — tela de login

- A área de identidade visual do login usa apenas a logo e a frase discreta `"O maior entre vocês é aquele que serve."`; não há mais `h1` `Escola Bíblica Dominical` nessa área.
- `Escola Bíblica Dominical` permanece somente como identificação pequena no cabeçalho do card; o título do formulário é `Login`.
- A logo transparente está levemente menor e um pouco mais elevada.
- O espaçamento entre a identidade visual e o card foi reduzido sem alterar a estrutura de autenticação. Em telas estreitas, o shell inicia no topo e evita linhas de grid esticadas; logo, frase/linha e card ficam visualmente próximos.
- A tela de login não apresenta rolagem normal: o `body` usa `overflow: hidden`, inclusive fora do estado de carregamento.
- O overlay de autenticação continua branco, em tela inteira e bloqueando interação/rolagem, com `V` no sucesso e `X` no erro.

# Handoff

- A aplicação tem login, dashboard e o módulo de classes como fluxos funcionais principais.
- O dashboard agora pode operar em `developmentMode`; quando esse flag está desativado, apenas os cards de **Classes** e **Relatórios** permanecem visíveis.
- A configuração compartilhada do front foi centralizada em `src/app/config/config.js`; em ambiente local, `server.js` pode injetar `process.env.developmentMode` antes do arquivo estático, e `api.js` preserva valores já definidos no objeto global.
- O front escolhe a base da API automaticamente: localhost em desenvolvimento e Render em produção/GitHub Pages.
- O login espera um token em campos comuns de resposta (`token`, `accessToken`, `data.token`, `result.token`, `auth.token`).
- O dashboard protege a entrada: sem token válido na `sessionStorage`, a página volta para a tela de login.
- A página de classes usa `GET /api/v1/classes`, renderiza as classes recebidas e navega para a tela de chamada levando `classId` e `className` na query string.
- O submódulo `relatorios/melhores-classes` agora consulta o backend real em `GET /api/v1/reports/classes-ranking` (com aliases `class-ranking` e `best-classes-ranking`) usando o mesmo período do financeiro (`startDate`/`endDate`), mantendo a lista compacta com apenas `Nome da classe` e `%`.
- O submódulo `relatorios/melhor-da-classe` agora consulta o backend real: carrega as turmas em `/classes`, mantém a opção inicial `< SELECIONE >` e busca o ranking em `/reports/class-students-ranking` (com aliases) a partir da turma escolhida.
- O submódulo `relatorios/financeiro` agora consulta o backend real em `GET /api/v1/reports/financial-period`, usando `startDate`, `endDate` e `classId` opcional; a tela renderiza o consolidado e os lançamentos retornados pelo endpoint.
- A página de classes aplica uma ordem visual fixa para o cadastro 1 antes de renderizar os cards: `Cordeirinhos de Cristo`, `Shalon`, `Filhos de Asáfe`, `Mensageiros de Cristo`, `Filhos de Sião` e `Rosas de Saron`; essa prioridade não depende da ordenação alfabética da API.
- A tela de chamada carrega alunos ativos e inativos por consultas separadas e preserva `id_aluno_classe` ao mesclar respostas.
- O salvamento da chamada continua dependendo de `id_aluno_classe` válido e usa `PATCH /attendance/:callId` com `students[]`.
- A tela de chamada carrega e salva o **Resumo da classe** na API oficial: `GET /attendance/classes/:classId/summary` para hidratar os campos e `PUT /attendance/:callId/summary` para persistir `oferta`, `visitantes`, `biblias` e `revistas`.
- Ao salvar a chamada com sucesso, a tela retorna automaticamente para `../../classe/pages/index.html`, seguindo o mesmo destino do botão flutuante de voltar.
- A seção **Resumo da classe** da tela de chamada reproduz a regra do legado: `Visitantes` é limitado a 50 e `Bíblias`/`Revistas` são limitadas à soma de alunos presentes + visitantes.
- O fluxo de salvamento da chamada envia primeiro `PATCH /attendance/:callId` para a presença e depois atualiza o resumo da classe; a resposta do backend precisa devolver o resumo salvo com `visitantes` persistido em `ebd_chamada`.
- O cadastro nominal de visitantes continua separado em `ebd_chamada_visitante`; ele complementa o resumo, mas não substitui o campo consolidado.
- O módulo de aluno foi conectado ao backend disponível:
- A tela de chamada agora desfaz o envelope de sucesso da API (`{ ok, message, data }`) antes de aplicar mutações locais, porque o módulo consome os dados úteis diretamente.
  - criação: `POST /people` → `POST /students/enroll`;
  - edição cadastral: `PUT /people/:id`;
  - observação do aluno: `PUT /students/:id/observation`;
  - status: `PUT /students/:id/activate` e `PUT /students/:id/inactivate`.
- Não existe DELETE para aluno no backend atual; o botão de excluir do frontend usa inativação como fallback.
- O campo **Data de início** permanece bloqueado na edição.
- A normalização da listagem de alunos depende de `extractPersonId(...)`; sem esse helper, o carregamento quebra antes de renderizar os cards.
- O status de matrícula na edição precisa ser lido do `raw` do aluno, porque o objeto normalizado não carrega `status` no topo; usar só o objeto achatado faz a ativação parecer concluída sem persistir no backend.
- O formulário de edição de aluno precisa normalizar `sexo` ao preencher o select, porque o payload de aluno pode vir do banco com `M`/`F` e o select da tela trabalha com `masculino`/`feminino`.
- O token de autenticação deixou de ser salvo como objeto JSON com metadados e passou a ser persistido como string simples em `sessionStorage`, com leitura compatível com sessões antigas.

- A listagem de alunos usada na edição precisa trazer os campos cadastrais da pessoa, senão a abertura do modal volta a mostrar valores antigos após recarregar.
- O resumo da classe e o relatório geral agora aceitam `oferta`/`valor_oferta` no payload e exibem o valor formatado em BRL (`R$ ...`) em vez de cair em `Não houve`.

- A página de classes agora recebe copys compartilhadas pelo `config.js` e mantém as frases combinadas em nós ocultos quando o modo reduzido está ativo.


- O módulo de Relatórios possui consulta por intervalo de datas ligada ao backend real (`GET /reports/period`, com token e tratamento de erro via `api-client.js`/`error-dialog.js`), snapshot imutável e renderização do resultado no card principal da tela.
- O frontend não deve usar o DOM como fonte do PDF; o payload consolidado da busca é o estado canônico do relatório.
- O dashboard não exibe mais o texto visível “Navegação” no hero.
- O módulo de Relatórios agora tem dois downloads: **Baixar Relatório** gera apenas o consolidado por classes a partir do snapshot; **Presenças** faz a consulta detalhada ao backend (`GET /reports/period/pdf`) e baixa somente o PDF de presença. O snapshot continua sendo a base do relatório geral.
- O layout do relatório na tela deve ficar no card de resultado; a pré-visualização em `iframe` foi removida.
- A área de Relatórios foi reorganizada em uma vitrine de módulos em `src/modules/relatorios/pages/index.html`; o fluxo funcional de consulta por data única ficou em `src/modules/relatorios/presencas/index.html`.
- O service compartilhado de relatórios ganhou `searchFinancialPeriod(...)` e o endpoint `APP_REPORTS_SERVICE.endpoints.financial` para consumir o contrato financeiro sem mock local.
- Em Presenças, a busca usa uma única data e o service replica o valor para `startDate`/`endDate` quando o endpoint exigir intervalo; os submódulos de ranking já consomem o backend real e os fluxos restantes seguem seus contratos próprios.
- A página de Relatórios depende do carregamento de `jspdf.umd.min.js`; sem esse script os downloads em PDF não conseguem gerar o arquivo.


- No módulo de Relatórios, o card de resultado passou a mostrar o relatório completo no próprio painel; os downloads foram separados em **Baixar Relatório** e **Presenças**.
- As datas do relatório são normalizadas no frontend: apenas data vira `dd/mm/yyyy`; data com hora vira `dd/mm/yyyy - hh:mm`.
- O PDF continua preservando as páginas de resumo já existentes, sem leitura do DOM como fonte; as páginas detalhadas por data/classe vêm do backend e o layout principal mantém fallback alternativo quando falha.

- O módulo de Relatórios agora agrupa as atividades por turma, consulta o resumo completo de cada turma e renderiza cards individuais + card total no painel de resultado.
- O total do período é o somatório dos cards renderizados; o período serve como índice para identificar as turmas e sua data mais recente.
- O envio do relatório continua baixando PDF com fallback, sem ler o DOM.

- O módulo de Relatórios passou a renderizar cards por turma no painel principal e um card total consolidado, ambos derivados do snapshot imutável da consulta.
- O envio do PDF continua partindo do snapshot em memória; a interface visual não deve ser usada como fonte de dados.
- O relatório usa o formato textual padronizado nas linhas dos cards: `Matriculados`, `Ausentes`, `Presentes`, `Visitantes`, `Total`, `Bíblias`, `Revistas` e `Ofertas`.

- A tela de Chamada teve a cópia introdutória reduzida: o modal de aluno não exibe mais o texto de abertura nem o subtítulo do bloco de dados; o botão de fechar foi fixado no canto superior direito do diálogo.
- O dashboard perdeu a seção hero vazia no modo de desenvolvimento e o ícone de destaque foi deslocado para o canto superior direito da barra principal.
- O módulo de Relatórios agora mantém a área de resultado oculta até que uma consulta válida retorne dados; quando há relatório carregado, a seção reaparece.
- O dashboard perdeu o ícone azul do canto superior direito; o botão **Sair** passou a ocupar esse espaço no topo da página.
- Na tela de chamada, o botão **Salvar Chamada** do cabeçalho foi removido; o salvamento ficou concentrado no botão do rodapé do resumo da classe.
- Os botões **Presente**, **Atrasado** e **Ausente** dos cards de aluno seguem o padrão visual do card do David: ficam lado a lado e só exibem a cor forte quando estão selecionados.

- O **Relatório Geral** do módulo de Classes agora usa estado visual por cor: vermelho enquanto houver qualquer chamada pendente e amarelo quando existir classe com `presentes = 0`; a implementação não depende de esconder/exibir elementos.

- A tela de chamada recalcula a data de negócio por request e não deve voltar a congelar `attendanceDate` no estado inicial.
- O fluxo de abertura da chamada não envia mais data pelo cliente; o backend define a data válida do dia.

- O módulo de classes agora trata HTTP 403 como bloqueio de acesso: o frontend oculta a shell da tela e abre o diálogo reutilizável `APP_ACCESS_DENIED_DIALOG`, em vez de renderizar erro inline.
- O diálogo de permissão reutilizável mostra somente a mensagem vinda do backend e oferece o botão **Voltar**; ele não exibe trace, stack nem suporte.
- O diálogo de permissão reutilizável passou a travar também a rolagem/fundo da página enquanto está aberto, para evitar movimento visual atrás do modal.
- Esse diálogo não fecha por clique fora nem pela tecla Escape; a saída autorizada é o botão **Voltar**.


- O submódulo **Melhor Aluno Geral** agora deve ser tratado como uma lista compacta de três colunas: `Nome`, `Classe` e `%`; a presença do aluno sempre aparece com o cabeçalho `%` quando o símbolo não vier da origem.


- O submódulo `relatorios/melhor-aluno-geral` está temporariamente desativado: o card fica oculto no hub e a página não executa o ranking enquanto a desativação estiver vigente.
- O submódulo `relatorios/financeiro` passou a oferecer **Baixar Extrato** com PDF gerado a partir do JSON do backend; o título é `Extrato Financeiro EBD` e o bloco de `Total Geral` se repete no topo das páginas seguintes.
- O backend agora bloqueia o perfil `Financeiro` nos subdiretórios de relatórios que não sejam `financeiro`; o frontend deve tratar `403` como acesso negado nesses módulos.
- O hub de Relatórios agora oculta os submódulos não financeiros quando o token pertence ao perfil `Financeiro`, deixando visível apenas **Financeiro**.
- Os submódulos de Relatórios fora de `Financeiro` passaram a reutilizar `APP_ACCESS_DENIED_DIALOG` ao receber HTTP 403, com retorno para o hub de Relatórios.
- O extrato financeiro em PDF usa o título `Extrato Financeiro EBD`, repete o bloco de `Total Geral` em todas as páginas e precisa receber metadados de paginação válidos para não quebrar em `pageNumber`.

## Atualização 2026-08-10 — acesso a Relatórios

- `Financeiro` acessa somente o submódulo `Financeiro`; `Presenças`, rankings e demais relatórios não financeiros devolvem 403.
- `Secretaria` vê o módulo principal `Relatórios` no dashboard, mas não pode entrar; o backend bloqueia o acesso direto e o hub abre `APP_ACCESS_DENIED_DIALOG` em 403.
- O hub de Relatórios valida `GET /api/v1/reports/access` antes de exibir os cards e usa `APP_ACCESS_DENIED_DIALOG` para 403.



## Atualização 2026-08-10 — rankings de Classes

- A tela de Classes já consome diretamente `presence-ranking` e `offers-ranking`; não foi necessário alterar o frontend.
- O erro 403 da Secretaria durante `loadRanking()` era causado pelo guard global de Relatórios no backend.
- Após liberar essas duas APIs via `CLASSES_VIEW`, os rankings devem carregar normalmente para Secretaria.

## Atualização 2026-08-10 — limpeza de copy técnico na interface

- As mensagens visíveis ao usuário não devem mencionar `API`, `backend`, `endpoint`, `tenant`, autenticação técnica ou "ranking real". A lógica de integração permanece a mesma; apenas a copy foi simplificada.
- Na página de Presenças, o selo visual com `P` foi removido; o título e as funções da tela permanecem.

## Atualização 2026-08-10 — Melhor da Classe por período

- A tela `melhor-da-classe` passou a usar duas datas e o botão `Buscar`, seguindo o padrão visual/funcional do Financeiro.
- O service envia `classId`, `startDate` e `endDate`; o período exibido no resumo vem do payload da consulta.


## Atualização 2026-08-10 — desativação do Melhor Aluno Geral e lista completa por turma

- **Melhor Aluno Geral** está temporariamente desativado no frontend; a implementação foi preservada para futura reativação.
- **Melhor da Classe** exibe todos os alunos retornados para a turma e período, sem limite de quantidade.
- O frontend não envia `limit` para o ranking da turma e o backend ignora eventual `limit` recebido para esse fluxo.

## Atualização 2026-08-10 — correção efetiva do limite do Melhor da Classe

- O backend já retornava o fluxo de **Melhor da Classe** sem limite; o truncamento remanescente estava no frontend, em `normalizeRankingList()`, por causa de `.slice(0, 10)`.
- `fetchClassStudentsRanking()` agora usa `normalizeClassStudentsRankingList()`, sem truncamento, enquanto rankings Top 10 continuam usando seus normalizadores com limite.
- O frontend inclui teste de regressão garantindo que uma lista com 25 alunos permaneça com 25 itens.

- `Melhores Classes` agora exibe a participação de cada classe no total de presenças das classes retornadas, em duas casas decimais e total de 100,00%; o cálculo usa `presentes`/`alunos_presentes` já fornecido pelo endpoint e não exige mudança no SQL.



## Atualização 2026-08-11 — Relatório do Aluno no frontend

- O novo submódulo `relatorios/relatorio-aluno` está disponível logo abaixo de **Melhor da Classe**.
- A página carrega as turmas ao abrir, consulta os alunos ao selecionar a turma, oferece busca por nome e usa `BAIXAR` para gerar o PDF individual.
- O frontend consome `GET /api/v1/classes/:id/students` para a lista e `GET /api/v1/reports/student-report` para o relatório.
- Nenhum arquivo do backend ou SQL foi alterado nesta etapa.
- O PDF é gerado no frontend a partir do payload do relatório, com resumo e detalhamento mensal.

## Atualização 2026-08-11 — download resiliente do Relatório do Aluno

- O endpoint individual `GET /reports/student-report` deixou de ser ponto único de falha para o botão **BAIXAR**.
- Em `404/405/500/502/503` ou payload sem `aluno`, o frontend reconstrói o relatório usando `GET /reports/period/pdf` e as linhas do aluno.
- O cálculo preserva a regra de que `atrasado` conta como presença.
- O PDF possui fallback nativo quando `jsPDF` não estiver disponível.
- Testes: 4/4; build do GitHub Pages concluído.

## Atualização 2026-08-11 — frequência mensal do Relatório do Aluno

- O frontend agora considera incompleto um payload com `resumo.total_chamadas > 0` e `meses` vazio.
- Nesse cenário, reutiliza `/reports/period/pdf` para reconstruir a série mensal antes de gerar o PDF.
- O fallback continua sendo construído a partir do snapshot JSON e não do DOM.

## Atualização 2026-08-11 — correção da frequência mensal no Relatório do Aluno

- O frontend agora trata uma resposta individual incompleta como reparável: quando `reports/student-report` chega sem `meses`, consulta `reports/period/pdf` e usa esse detalhamento para reconstruir o relatório.
- O fallback passa a corrigir **resumo e série mensal** juntos; isso evita PDF com `0` presenças no resumo e tabela mensal vazia quando o detalhamento possui a presença real.
- Foi criado teste de regressão específico com `Aux André` (`id_aluno=78`, `id_classe=5`) simulando uma presença real e resposta individual inconsistente.
- `npm test` do backend (79 testes) e do frontend (6 testes) passaram; o build do GitHub Pages também foi regenerado.


## Atualização 2026-08-11 — correção final da série mensal do Relatório do Aluno

- O cenário observado no PDF de João Henrik tinha `1` presença no resumo, mas nenhuma linha em `Frequência por mês`; o problema estava no caminho de recuperação do frontend para respostas individuais sem `meses`.
- O fallback agora identifica as linhas principalmente por `id_aluno`, reconstrói todos os meses do período (incluindo meses zerados) e, para períodos de um único mês sem linhas detalhadas, usa o resumo para preencher a única linha mensal.
- `src/modules/relatorios/services/relatorios.service.js` e sua cópia em `docs/` permanecem sincronizados.
- Testes e build validados: frontend 8 testes + build; backend 79 testes.

## Atualização 2026-08-11 — layout final da listagem do Relatório do Aluno

- A tabela da listagem do `Relatório do Aluno` deve mostrar somente `Nome do aluno` e `BAIXAR`.
- Nenhuma linha da tabela pode renderizar a classe como célula ou texto adicional.
- A classe continua disponível no relatório individual/prévia/PDF; a mudança é exclusivamente visual e não altera endpoints.
- Foi adicionado teste de regressão para impedir o retorno da célula de classe na listagem.

## Atualização 2026-08-12 — Gerar escala

- O módulo `gerar-escala` foi integrado ao padrão visual do site, usando a mesma linguagem visual dos painéis de Relatórios.
- **Gerar escala** aparece no dashboard imediatamente abaixo de **Relatórios** e é sempre visível para os perfis que acessam o dashboard.
- A lógica do módulo permanece inalterada; a mudança foi limitada a layout, navegação e textos amigáveis ao usuário.

## Atualização 2026-08-12 — Gerar escala: navegação e exemplos

- Corrigido o botão **Voltar** de `gerar-escala` para `../dashboard/pages/home/index.html`, evitando a rota incorreta `/src/dashboard/pages/home/index.html`.
- No dashboard, a ordem dos módulos visíveis agora é **Classes**, **Gerar escala**, **Relatórios**; **Gerar escala** continua com `alwaysVisible: true`.
- Os nomes padrão do módulo passaram a ser **João (Exemplo)**, **Maria (Exemplo)**, **Pedro (Exemplo)** e **Ana (Exemplo)**.

## Atualização 2026-08-13 — tela de login

- A tela inicial apresenta **Escola Bíblica Dominical** como identificação.
- O título do formulário é **Login** e a frase de acesso por credenciais não é exibida.
- A frase `"O maior entre vocês é aquele que serve."` é discreta e aparece abaixo da identificação da instituição.
- A logo da Assembleia de Deus fornecida pelo usuário substitui o símbolo anterior e usa PNG com fundo externo transparente.
- Durante o login existe um overlay branco de tela inteira, com interação e rolagem bloqueadas. O estado de carregamento mostra animação; sucesso mostra `V` azul e erro mostra `X` antes de liberar/redirecionar.
- A mudança está limitada à entrada/login. Cópias de `index.html`, CSS, JS e logo em `docs/` foram sincronizadas para GitHub Pages.
- Validação atual: `npm test` = 9/9, sem falhas.

## Atualização 2026-08-13 — refinamento visual da tela de login

- `Área Restrita` permanece removido.
- O formulário agora usa somente `Login` como título e não exibe `Use suas credenciais para acessar o sistema.`.
- A frase `"O maior entre vocês é aquele que serve."` é exibida de forma pequena e discreta abaixo de `Escola Bíblica Dominical`.
- A logo da Assembleia de Deus passou para PNG com fundo externo transparente, baseada no arquivo fornecido pelo usuário, e ficou ligeiramente menor.
- O overlay de carregamento da autenticação permanece exclusivo da tela de login, cobre toda a viewport, bloqueia interação/rolagem e agora usa fundo branco; `V` azul para sucesso e `X` para erro permanecem.


## Atualização 2026-08-13 — ajuste fino de proximidade da tela de login

- Em viewport estreita, o card de login deve ficar praticamente colado à frase, sem espaço vertical excessivo.
- A logo permanece no canto superior da área de identidade, ligeiramente menor e com separação moderada da frase.
- Alteração exclusivamente visual no CSS; fluxo de autenticação inalterado.

## Atualização 2026-08-13 — frase integrada à linha azul do card

- A frase `"O maior entre vocês é aquele que serve."` agora aparece centralizada sobre uma linha azul imediatamente acima do card de login.
- O divisor e o card formam um único conjunto visual, sem o grande intervalo vertical anterior.
- Em telas estreitas, a mesma composição é mantida com o divisor diretamente acima do card.
- Alteração exclusivamente visual: autenticação e demais fluxos permanecem inalterados.
- `docs/` foi regenerado via `npm run build` para manter o GitHub Pages sincronizado.

## Atualização 2026-08-13 — loading informativo do login

- O overlay branco da tela de login agora troca automaticamente mensagens de progresso enquanto o POST `/auth/login` permanece pendente, útil para a primeira requisição lenta do ambiente gratuito.
- As mensagens são neutras e não antecipam validação de credenciais; a confirmação só aparece após resposta válida com token.
- Em HTTP 401 ou mensagem do backend claramente relacionada a credencial inválida, a tela informa `Usuário ou senha inválidos.` em vez do texto compartilhado de sessão expirada.
- Nenhum arquivo do backend foi alterado; a correção foi mantida no `src/modules/auth/pages/login/login.js` e a cópia `docs/` foi regenerada.

## Atualização 2026-08-13 — duração variável do loading do login

- As mensagens de autenticação agora avançam com tempos individuais de 3,2 a 5 segundos em vez de um intervalo fixo.
- A etapa `Aguardando a resposta do sistema...` recebe 5 segundos por ser a mais dependente da latência do servidor; as demais usam tempos menores dentro da faixa definida.
- A sequência para imediatamente quando a requisição termina, seja em sucesso ou erro.
- Alteração restrita ao frontend; nenhuma lógica de backend foi modificada.
