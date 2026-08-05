# Handoff

- A aplicação tem login, dashboard e o módulo de classes como fluxos funcionais principais.
- O dashboard agora pode operar em `developmentMode`; quando esse flag está desativado, apenas os cards de **Classes** e **Relatórios** permanecem visíveis.
- A configuração compartilhada do front foi centralizada em `src/app/config/config.js`; em ambiente local, `server.js` pode injetar `process.env.developmentMode` antes do arquivo estático, e `api.js` preserva valores já definidos no objeto global.
- O front escolhe a base da API automaticamente: localhost em desenvolvimento e Render em produção/GitHub Pages.
- O login espera um token em campos comuns de resposta (`token`, `accessToken`, `data.token`, `result.token`, `auth.token`).
- O dashboard protege a entrada: sem token válido na `sessionStorage`, a página volta para a tela de login.
- A página de classes usa `GET /api/v1/classes`, renderiza as classes recebidas e navega para a tela de chamada levando `classId` e `className` na query string.
- A tela de chamada carrega alunos ativos e inativos por consultas separadas e preserva `id_aluno_classe` ao mesclar respostas.
- O salvamento da chamada continua dependendo de `id_aluno_classe` válido e usa `PATCH /attendance/:callId` com `students[]`.
- A tela de chamada carrega e salva o **Resumo da classe** na API oficial: `GET /attendance/classes/:classId/summary` para hidratar os campos e `PUT /attendance/:callId/summary` para persistir `oferta`, `visitantes`, `biblias` e `revistas`.
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
- O botão **Enviar Relatório** baixa o PDF diretamente a partir do snapshot da consulta.
- O layout do relatório na tela deve ficar no card de resultado; a pré-visualização em `iframe` foi removida.
- A página de Relatórios depende do carregamento de `jspdf.umd.min.js`; sem esse script o botão **Enviar Relatório** não consegue gerar o arquivo.


- No módulo de Relatórios, o card de resultado passou a mostrar o relatório completo no próprio painel; o botão **Enviar Relatório** baixa o PDF diretamente.
- As datas do relatório são normalizadas no frontend: apenas data vira `dd/mm/yyyy`; data com hora vira `dd/mm/yyyy - hh:mm`.
- O PDF continua sendo montado a partir do snapshot da consulta, sem leitura do DOM, e possui fallback alternativo quando o layout principal falha.

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
