# Sistema de Chamada e Presença de Turmas

### [By: Everton Lourenço](https://github.com/Everton-Lourens)

Sistema web para gerenciamento de chamada, controle de presença, relatórios e administração de turmas/alunos, com sincronização via Google Apps Script e persistência local no navegador.

Este documento descreve a estrutura do script principal, suas responsabilidades e o papel de cada função no fluxo da aplicação.

---

## Visão geral

A aplicação foi desenvolvida para apoiar a rotina de controle de presença em turmas, oferecendo:

- seleção de data e turma;
- marcação individual e em massa de presença;
- cadastro de turmas e alunos;
- movimentação de alunos entre turmas;
- ativação/inativação de alunos;
- relatórios textuais por turma e gerais;
- rascunhos automáticos no navegador;
- cache local do cadastro;
- envio de dados para backend via Google Apps Script.

O script organiza toda a lógica da interface, estado local, sincronização e geração de relatórios.

---

## Arquitetura do script

O código está dividido em blocos funcionais:

1. **Constantes e estado global**
2. **Utilitários de interface e formatação**
3. **Comunicação com backend**
4. **Persistência local**
5. **Regras de chamada e presença**
6. **Geração de relatórios**
7. **Renderização da interface**
8. **Ações do usuário**
9. **Inicialização e eventos**

Essa separação facilita manutenção, debug e evolução do sistema.

---

## Constantes principais

### `APPS_SCRIPT_URL`
URL base do Web App do Google Apps Script usado como backend.

### `STORAGE_KEY`
Chave principal do `localStorage` usada para salvar estado da aplicação e rascunhos.

### `ROSTER_CACHE_KEY`
Chave dedicada ao cache local de turmas e alunos.

### `ROSTER_CACHE_VERSION`
Versão do cache. Serve para invalidar dados antigos quando a estrutura muda.

---

## Estado global

### `state`
Objeto central da aplicação. Guarda o estado atual da tela e dos dados.

Principais campos:

- `syncToken`: controle interno de sincronização.
- `loading`: indica se a aplicação está carregando.
- `dateKey`: data atualmente selecionada.
- `turmas`: lista de turmas carregadas.
- `alunos`: lista de alunos carregados.
- `chamadasByTurma`: chamadas carregadas por turma.
- `resumoGeral`: resumo consolidado do backend.
- `selectedTurmaId`: turma selecionada no momento.
- `search`: termo de busca aplicado na lista de alunos.
- `showInactive`: controla se alunos inativos aparecem na tela.
- `dirty`: indica alterações ainda não salvas.
- `initialized`: indica se a aplicação já foi inicializada.

### `els`
Mapa com referências para elementos do DOM usados pela interface, como:

- inputs de data, turma e aluno;
- botões de ação;
- área de feedback;
- cards de resumo;
- listas de alunos;
- campos de relatório;
- templates de renderização.

---

## Sistema de carregamento e feedback

### `ensureLoadingOverlay()`
Cria a overlay de carregamento se ela ainda não existir no DOM.

### `showLoading(message = 'Carregando...')`
Exibe a overlay de loading e atualiza o texto exibido ao usuário.

### `hideLoading()`
Reduz o contador interno de carregamento e oculta a overlay quando não há mais operações pendentes.

### `setFeedback(type, message)`
Define uma mensagem de feedback na interface com um tipo visual específico.

### `clearFeedback()`
Remove qualquer mensagem exibida no bloco de feedback.

### `showBusy(message)`
Exibe uma mensagem de operação em andamento.

### `showSuccess(message)`
Exibe uma mensagem de sucesso.

### `showError(message)`
Exibe uma mensagem de erro.

---

## Funções utilitárias

### `todayKey()`
Retorna a data atual no formato `YYYY-MM-DD`, ajustada ao fuso local.

### `onlyDigits(value)`
Remove todos os caracteres não numéricos de uma string.

### `formatCelular(value)`
Formata automaticamente um celular parcial ou completo no padrão brasileiro de celular.

### `formatMoney(value)`
Formata um número como moeda brasileira (`R$ 0,00`).

### `formatPercent(value)`
Formata um número como percentual com uma casa decimal, respeitando o padrão brasileiro.

### `escapeHtml(value)`
Escapa caracteres HTML para evitar que texto inserido na interface gere interpretação indevida de tags.

### `formatDateBR(dateKey)`
Converte uma data do formato `YYYY-MM-DD` para `DD/MM/YYYY`.

---

## Comunicação com o backend

### `apiUrl(params = {})`
Monta a URL final do Web App adicionando parâmetros na query string.

### `apiGet(params = {})`
Executa uma requisição `GET` para o backend e valida a resposta JSON.

### `apiPost(params = {})`
Executa uma requisição `POST` com `FormData` para o backend.

### `validateApiUrl()`
Verifica se a URL do Apps Script foi configurada corretamente antes de iniciar a aplicação.

---

## Persistência local

### `storageState()`
Lê e retorna o objeto principal armazenado no `localStorage`.

### `saveStorageState(next)`
Salva o estado principal no `localStorage`.

### `readJsonStorage(key, fallback = null)`
Lê um valor JSON do `localStorage` e devolve um fallback se houver erro.

### `writeJsonStorage(key, value)`
Grava um valor serializado em JSON no `localStorage`.

### `loadRosterCache()`
Carrega o cache local de turmas e alunos, validando a versão.

### `saveRosterCache()`
Salva uma cópia local do cadastro atual de turmas e alunos.

### `hydrateRosterFromCache()`
Restaura turmas e alunos a partir do cache local.

### `persistDraft(call)`
Salva um rascunho local da chamada atual para evitar perda de dados.

### `restoreDraft(call)`
Reaplica um rascunho salvo sobre uma chamada carregada do backend.

### `clearDraft(callId)`
Remove o rascunho local de uma chamada após o salvamento.

---

## Mesclagem e sincronização de dados

### `rosterFingerprintTurma(turma)`
Gera uma assinatura textual da turma para detectar alterações estruturais.

### `rosterFingerprintAluno(aluno)`
Gera uma assinatura textual do aluno para comparação de mudanças no cadastro.

### `mergeById(prevList = [], nextList = [], idField, fingerprintFn = null)`
Mescla duas listas por ID, preservando objetos antigos quando não há mudança real.

### `buildStudentRowFromAluno(aluno)`
Converte um aluno cadastrado em uma linha padrão de chamada.

### `buildSyncedCall(turma, serverCall = null, draft = null)`
Reconstrói uma chamada completa mesclando:

- dados da turma;
- dados do servidor;
- rascunho local;
- cadastro de alunos.

---

## Controle da turma e da chamada atual

### `callKey(dateKey, turmaId)`
Cria uma chave única para a chamada usando data e turma.

### `setCurrentCall(call)`
Define a chamada atual no estado global.

### `getCurrentTurma()`
Retorna a turma atualmente selecionada.

### `getCurrentCall()`
Retorna a chamada atual. Se ela não existir, cria uma chamada vazia automaticamente.

### `updateCallFromInputs()`
Sincroniza alguns dados da chamada com os campos da interface.

### `getTurmasSorted()`
Retorna a lista de turmas ordenada por ordem numérica e depois por nome.

### `getAlunosForTurma(turmaId)`
Retorna os alunos de uma turma, ordenando ativos e inativos de forma consistente.

### `blankCallForTurma(turma)`
Cria uma chamada vazia para uma turma selecionada, com linhas para todos os alunos.

### `loadSelectedTurma()`
Garante que a turma selecionada esteja carregada com sua chamada correspondente.

---

## Regras de status e presença

### `studentStatusFromRow(row, rosterMap = null)`
Determina o status do aluno a partir da linha da chamada ou do cadastro.

### `isInactiveStudent(row, rosterMap = null)`
Verifica se o aluno deve ser tratado como inativo.

### `getActiveRows(call)`
Filtra apenas as linhas válidas para contagem, ignorando alunos inativos.

### `computeLocalStats(call)`
Calcula estatísticas locais da chamada:

- total;
- presentes;
- ausentes;
- percentual de presença.

### `getCurrentStats()`
Retorna as estatísticas da chamada atual.

### `currentStudentsMap()`
Cria um mapa rápido `AlunoID → aluno` para uso interno da aplicação.

### `bestStudentForCurrentTurma()`
Retorna o aluno com maior percentual de presença na turma atual.

---

## Geração de relatórios

### `buildTurmaReportText()`
Monta o relatório textual completo da turma com:

- nome da turma;
- data;
- total de alunos;
- presentes;
- ausentes;
- percentual;
- oferta;
- visitantes;
- melhor aluno;
- alunos inativos;
- alunos faltando muito;
- lista de presentes e ausentes.

### `buildGeneralReportText()`
Monta um relatório consolidado de todas as turmas, com resumo geral e destaques.

### `renderReports()`
Atualiza os campos de texto dos relatórios na interface.

---

## Renderização da interface

### `renderTurmaSelects()`
Popula os selects de turma em toda a interface.

### `renderSummary()`
Atualiza os cards com números principais da chamada, como total, presença, oferta e visitantes.

### `renderStudents()`
Renderiza a lista de alunos da turma atual com:

- nome;
- badges de status;
- percentual individual;
- faltas;
- faltas consecutivas;
- botões de ação;
- campo de observação.

### `bindCallFieldValues()`
Sincroniza os inputs de oferta, visitantes e texto de visitantes com a chamada atual e registra eventos de edição.

### `renderAll()`
Executa a renderização completa da tela chamando os principais renderizadores.

---

## Manipulação da chamada

### `markDirty()`
Marca a chamada como alterada, salva um rascunho local e atualiza os relatórios.

### `setStudentPresence(alunoId, presence)`
Altera a presença de um aluno específico.

### `setAllPresence(presence)`
Marca todos os alunos ativos como presentes ou ausentes.

### `clearCurrentCall()`
Limpa os dados da chamada atual na interface, sem apagar imediatamente do backend.

### `saveAndAdvance()`
Salva a chamada atual e avança automaticamente para a próxima turma.

### `copyText(text)`
Copia um texto para a área de transferência.

### `normalizeCelularInput(event)`
Formata o celular enquanto o usuário digita.

---

## Operações com o backend

### `saveCurrentCall({ silent = false } = {})`
Envia a chamada atual para o backend e limpa o rascunho local após salvar.

### `sendReport(scope)`
Envia um relatório para o backend, seja da turma ou geral.

### `refreshFromBackend(showMessage = false)`
Atualiza turmas, alunos, chamadas e resumo geral a partir do servidor.

### `moveStudent(alunoId)`
Move um aluno para outra turma usando o backend.

### `toggleStudentStatus(alunoId)`
Alterna o status ativo/inativo de um aluno.

### `addTurma(event)`
Cadastra uma nova turma.

### `addAluno(event)`
Cadastra um novo aluno.

---

## Inicialização

### `bootstrap()`
Executa a inicialização completa da aplicação:

- prepara a tela;
- define a data atual;
- restaura o estado local;
- valida a URL do backend;
- carrega dados do servidor;
- renderiza a interface;
- sinaliza que o sistema está pronto.

---

## Eventos registrados na interface

O script registra listeners para:

- alteração da data;
- troca da turma selecionada;
- escolha da turma do aluno;
- busca na lista;
- exibição de inativos;
- botão de recarregar;
- limpar chamada;
- salvar chamada;
- enviar relatório da turma;
- enviar relatório geral;
- salvar e avançar;
- marcar todos como presentes;
- marcar todos como ausentes;
- copiar relatórios;
- envio dos formulários de turma e aluno;
- formatação automática de celular;
- carregamento inicial da página.

---

## Funcionalidades principais do sistema

### Controle de presença
- marcação individual;
- marcação em massa;
- estatísticas automáticas;
- controle de alunos ativos/inativos.

### Gestão de alunos e turmas
- cadastro;
- movimentação entre turmas;
- ativação e inativação;
- ordenação por turma e nome.

### Relatórios
- relatório por turma;
- relatório geral consolidado;
- destaque de melhores alunos;
- contagem de visitantes e oferta.

### Persistência e segurança
- cache local;
- rascunhos automáticos;
- recuperação de dados após recarga;
- escape de HTML para segurança.

### Sincronização
- integração com Google Apps Script;
- leitura e gravação remota;
- atualização após envio;
- reaproveitamento de dados locais.

---

## Tecnologias utilizadas

- JavaScript Vanilla
- HTML5
- CSS3
- Fetch API
- LocalStorage
- Google Apps Script

---

## Fluxo geral da aplicação

```txt
Usuário interage com a interface
↓
Estado local é atualizado
↓
Rascunho é salvo automaticamente
↓
Interface é re-renderizada
↓
Dados são sincronizados com o backend
↓
Resumo geral é atualizado
```

---

## Observações técnicas

- O sistema foi projetado para evitar perda de dados por meio de rascunhos automáticos.
- A lógica de exibição separa alunos ativos e inativos sem excluir os dados do cadastro.
- A chamada pode ser recuperada mesmo após atualização da página, desde que o rascunho local esteja disponível.
- O backend é tratado como fonte de verdade após sincronização.
- A interface foi estruturada para permitir operação rápida durante a rotina de aula.

---

## Resumo final

Este script concentra toda a lógica principal do sistema de presença, unindo:

- cadastro de turmas e alunos;
- controle de presença;
- geração de relatórios;
- cache local;
- integração com Apps Script;
- feedback visual;
- persistência de rascunhos.

O resultado é uma aplicação voltada para uso prático em ambiente de aula, com foco em velocidade, organização e confiabilidade.


==========================

# Funcionamento Integrado do Front-end (`.js`) com o Backend (`.gs`)

Este documento explica como o sistema funciona de ponta a ponta, conectando as funções do arquivo JavaScript da interface com as funções do Google Apps Script responsáveis por ler, salvar e consolidar os dados. A ideia é deixar claro **quem chama quem**, **quais dados trafegam**, **quais abas são usadas** e **como o fluxo completo da aplicação acontece**. fileciteturn0file0turn3file0

---

## 1. Visão geral da arquitetura

O sistema foi dividido em dois blocos principais:

### Front-end (`.js`)
Responsável por:

- renderizar a interface;
- controlar estado local;
- salvar rascunhos no navegador;
- chamar o backend;
- montar relatórios na tela;
- permitir busca, filtros, edição e ações rápidas. fileciteturn0file0

### Backend (`.gs`)
Responsável por:

- ler dados da planilha;
- criar/atualizar chamadas;
- manter histórico;
- recalcular estatísticas;
- gerar texto de relatório;
- enviar mensagens para Telegram;
- cadastrar turmas e alunos;
- mover alunos e alterar status. fileciteturn3file0

O front conversa com o backend por `fetch`, usando `GET` para inicialização e consulta, e `POST` para salvar e executar ações administrativas. fileciteturn0file0turn3file0

---

## 2. Contrato entre front e backend

O arquivo `.js` usa a constante `APPS_SCRIPT_URL` como endpoint central e as funções `apiGet()` e `apiPost()` para comunicação. No backend, as rotas são distribuídas por `doGet(e)` e `doPost(e)`, que analisam o parâmetro `action` e encaminham para a função correta. fileciteturn0file0turn3file0

### Rotas de leitura (`doGet`)
O backend aceita as ações:

- `init`
- `health`
- `reportText` fileciteturn3file0

### Rotas de escrita/ação (`doPost`)
O backend aceita as ações:

- `saveCall`
- `sendReport`
- `addTurma`
- `addAluno`
- `moveAluno`
- `toggleAluno` fileciteturn3file0

No front, essas ações aparecem nas funções:

- `refreshFromBackend()`
- `saveCurrentCall()`
- `sendReport()`
- `addTurma()`
- `addAluno()`
- `moveStudent()`
- `toggleStudentStatus()` fileciteturn0file0

---

## 3. Fluxo de inicialização

### No front
A inicialização começa em `bootstrap()`. Essa função:

1. prepara data e filtros;
2. valida a URL do backend;
3. chama `refreshFromBackend(false)`;
4. carrega turmas, alunos, chamadas e resumo geral;
5. chama `renderAll()` para desenhar tudo na tela. fileciteturn0file0

### No backend
A resposta inicial vem de `init_(params)`, acionada por `doGet(e)` quando `action=init`. Essa função:

1. garante que as abas existam com `ensureSheets_()`;
2. normaliza a data;
3. carrega todos os dados com `loadAllData_()`;
4. monta as chamadas da data com `buildCallsByTurmaForDate_()`;
5. gera o resumo geral com `buildDailyGeneralSummary_()`;
6. retorna JSON com `turmas`, `alunos`, `callsByTurma` e `resumoGeral`. fileciteturn3file0

### Conexão prática
O front pede “me entregue tudo que eu preciso para montar a tela”. O backend responde com a estrutura pronta para uso, e o front apenas renderiza. Isso reduz lógica duplicada na interface. fileciteturn0file0turn3file0

---

## 4. Carregamento de dados da planilha

### Abas usadas no backend
O `.gs` trabalha com estas abas:

- `ReadBase`: leitura/cadastro base dos alunos;
- `Base`: histórico de presença;
- `__ALUNOS_META`: controle interno dos alunos;
- `__TURMAS_META`: controle interno das turmas;
- `__RELATORIOS`: log de relatórios e chamadas. fileciteturn3file0

### Como os dados são unidos
A função `loadAllData_()` reúne tudo:

- `loadMetaClasses_()` lê turmas do controle interno;
- `loadTurmasFromReadBase_()` captura turmas presentes na planilha-base;
- `loadMetaStudents_()` lê metadados dos alunos;
- `loadRosterFromReadBase_()` lê os alunos da base principal;
- `mergeTurmas_()` e `mergeRosterWithMeta_()` consolidam tudo em uma visão única. fileciteturn3file0

### No front
As listas recebidas são guardadas em:

- `state.turmas`
- `state.alunos`
- `state.chamadasByTurma`
- `state.resumoGeral` fileciteturn0file0

---

## 5. Como a chamada é montada no front

No front, a chamada atual é criada por:

- `getCurrentCall()`
- `blankCallForTurma(turma)`
- `restoreDraft(call)` fileciteturn0file0

Essas funções constroem a estrutura de edição para a turma selecionada, com linhas de alunos e campos como:

- presença;
- observação;
- status do aluno;
- oferta;
- visitantes. fileciteturn0file0

No backend, a função equivalente conceitual é `buildCallsByTurmaForDate_()`, que lê a base histórica, cruza com o cadastro e devolve a chamada já montada para cada turma na data selecionada. fileciteturn3file0

### Ligação entre ambos
O front trabalha com a chamada como objeto editável. O backend trabalha com a chamada como objeto persistido e reconstituído a partir da planilha. O formato é compatível o bastante para que o front possa renderizar e salvar sem reinterpretação complexa. fileciteturn0file0turn3file0

---

## 6. Salvamento de chamada

### Função no front: `saveCurrentCall()`
Essa é a função principal de persistência da presença. Ela:

1. obtém turma atual e chamada atual;
2. monta o payload;
3. envia `action=saveCall`;
4. atualiza o estado local com a resposta;
5. limpa o rascunho salvo no navegador;
6. chama `refreshFromBackend(false)` para recarregar tudo com o dado oficial. fileciteturn0file0

O payload enviado inclui:

- `date`
- `turmaId`
- `chamadaId`
- `oferta`
- `visitantes`
- `visitantesTexto`
- `rowsJson` fileciteturn0file0

### Função no backend: `saveCall_(p)`
Essa função:

1. valida turma e data;
2. interpreta `rowsJson`;
3. carrega dados atuais com `loadAllData_()`;
4. localiza a turma;
5. normaliza as linhas de alunos;
6. calcula presentes, ausentes e percentual;
7. grava as linhas na aba `Base` com `replaceBaseRowsForCall_()`;
8. atualiza metadados em `__RELATORIOS` com `upsertCallMeta_()`;
9. recalcula estatísticas dos alunos com `recalculateAndPersistStudentStats_()`;
10. opcionalmente envia Telegram. fileciteturn3file0

### O que isso significa na prática
O front apenas diz “salve esta chamada”. O backend transforma isso em histórico real de planilha, atualiza os totais e devolve a chamada já consolidada. fileciteturn0file0turn3file0

---

## 7. Estrutura do histórico salvo

A gravação principal acontece na função `replaceBaseRowsForCall_()`. Ela escreve na aba `Base` com os cabeçalhos:

- `DATA`
- `ANO`
- `MÊS`
- `ALUNO`
- `CLASSE`
- `PRESENÇA`
- `ATRASO`
- `AUSÊNCIA`
- `OFERTA` fileciteturn3file0

Cada aluno vira uma linha histórica. O backend também usa `getBaseRowsAll_()` e `getBaseRowsForDate_()` para recuperar esse histórico depois. fileciteturn3file0

### Relação com o front
O front não escreve diretamente na planilha. Ele envia uma lista JSON de alunos da turma atual, e o backend converte isso para o formato tabular usado na base. fileciteturn0file0turn3file0

---

## 8. Cálculo de estatísticas

### No front
As funções:

- `getActiveRows(call)`
- `computeLocalStats(call)`
- `getCurrentStats()`
- `bestStudentForCurrentTurma()` fileciteturn0file0

fazem o cálculo visual na interface para mostrar:

- total;
- presentes;
- ausentes;
- percentual;
- melhor aluno. fileciteturn0file0

### No backend
A mesma lógica existe do lado do servidor para garantir consistência nos dados persistidos. A função `saveCall_()` calcula:

- `presentes`
- `ausentes`
- `percentual` fileciteturn3file0

Depois `recalculateAndPersistStudentStats_()` percorre a base histórica e atualiza, em `__ALUNOS_META`:

- total de presenças;
- total de faltas;
- faltas consecutivas;
- percentual;
- última presença;
- última ausência;
- status automático/manual. fileciteturn3file0

### Conexão
O front mostra a leitura imediata da chamada atual; o backend mantém o histórico consolidado e recalculado. Isso evita divergência entre tela e planilha. fileciteturn0file0turn3file0

---

## 9. Relatórios de turma e geral

### No front
As funções:

- `buildTurmaReportText()`
- `buildGeneralReportText()`
- `renderReports()` fileciteturn0file0

montam os textos que aparecem nos campos de relatório e também podem ser copiados.

### No backend
As funções equivalentes são:

- `buildTurmaReportText_()`
- `buildGeneralReportText_()` fileciteturn3file0

Elas geram texto já preparado para Telegram, usando marcadores como:

- data;
- turma;
- presença;
- oferta;
- visitantes;
- melhores alunos;
- resumo por turma. fileciteturn3file0

### Como eles se conectam
O front gera um relatório para visualização e cópia rápida. O backend gera o relatório oficial para envio e registro em log. Os dois usam os mesmos dados-base, mas com finalidades diferentes. fileciteturn0file0turn3file0

---

## 10. Envio de relatório

### No front: `sendReport(scope)`
Essa função:

1. verifica se há alterações pendentes;
2. salva a chamada antes, se necessário;
3. envia `action=sendReport`;
4. atualiza o texto do relatório, se o backend devolver texto;
5. recarrega dados do servidor. fileciteturn0file0

### No backend: `sendReport_(p)`
Essa função decide entre:

- relatório da turma;
- relatório geral. fileciteturn3file0

Quando o escopo é `geral`, ela monta o texto com `buildGeneralReportText_()` e chama `sendTelegramByText_()`. Quando é `turma`, ela valida a turma, monta o texto com `buildTurmaReportText_()` e também envia ao Telegram. fileciteturn3file0

### Proteção contra envio duplicado
O backend usa `textHash_()` e `getReportLogById_()` para evitar reenviar o mesmo relatório se o conteúdo não mudou. fileciteturn3file0

---

## 11. Integração com Telegram

O backend já nasce preparado para envio automático ao Telegram com:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `sendTelegram_(text)` fileciteturn3file0

### Fluxo
1. O front salva a chamada.
2. O backend pode enviar automaticamente a mensagem, se a opção estiver ativa.
3. O relatório também pode ser enviado manualmente por `sendReport`. fileciteturn0file0turn3file0

### Controle de envio
O backend registra esse envio na aba `__RELATORIOS` por meio de `upsertReportLog_()` e atualiza o status com `markCallAsSent_()`. fileciteturn3file0

---

## 12. Cadastro de turmas

### No front: `addTurma(event)`
Envia `action=addTurma` com:

- `nome`
- `ordem` fileciteturn0file0

### No backend: `addTurma_(p)`
A função:

1. valida o nome;
2. gera o `TurmaID` com `buildTurmaId_()`;
3. verifica se a turma já existe;
4. cria ou atualiza o registro em `__TURMAS_META`. fileciteturn3file0

### Conexão
O front fornece a entrada do usuário; o backend é quem transforma isso em cadastro persistido e reutilizável. fileciteturn0file0turn3file0

---

## 13. Cadastro de alunos

### No front: `addAluno(event)`
Envia `action=addAluno` com:

- `nome`
- `celular`
- `turmaId` fileciteturn0file0

### No backend: `addAluno_(p)`
Essa função:

1. valida nome e turma;
2. localiza a turma;
3. cria `alunoId` com `buildStudentId_()`;
4. adiciona o aluno na aba `ReadBase`;
5. grava o registro no controle interno `__ALUNOS_META`. fileciteturn3file0

### Relação com a interface
Assim que o backend confirma o cadastro, o front faz `refreshFromBackend(false)` e atualiza a tela com o novo aluno já integrado à lista. fileciteturn0file0

---

## 14. Movimentação de aluno entre turmas

### No front: `moveStudent(alunoId)`
Essa função abre um `prompt` com as turmas disponíveis e envia `action=moveAluno` para o backend. fileciteturn0file0

### No backend: `moveAluno_(p)`
A função:

1. localiza o aluno no controle interno;
2. localiza a turma destino;
3. atualiza o `TurmaID` e `TurmaNome`;
4. grava o campo `RealocadoDe`;
5. persiste a mudança em `__ALUNOS_META`. fileciteturn3file0

### Efeito no front
Após o retorno, o front atualiza os dados com `refreshFromBackend(false)` para que o aluno apareça imediatamente na nova turma. fileciteturn0file0turn3file0

---

## 15. Ativar e inativar aluno

### No front: `toggleStudentStatus(alunoId)`
Essa função alterna o status do aluno com `action=toggleAluno`. fileciteturn0file0

### No backend: `toggleAluno_(p)`
A função:

1. localiza o aluno;
2. interpreta o novo estado `ativo` ou `inativo`;
3. atualiza `Ativo`, `StatusManual` e `Status`;
4. grava a alteração no controle interno. fileciteturn3file0

### Relação com a contagem
No front, alunos inativos podem ser ocultados por filtro. No backend, o status também influencia os cálculos e relatórios consolidados. fileciteturn0file0turn3file0

---

## 16. Como o front trata rascunhos e cache local

O arquivo `.js` é bastante cuidadoso com perda de dados.

### Rascunhos
As funções:

- `persistDraft(call)`
- `restoreDraft(call)`
- `clearDraft(callId)`
- `markDirty()` fileciteturn0file0

garantem que alterações não salvas sejam mantidas no navegador.

### Cache do cadastro
As funções:

- `loadRosterCache()`
- `saveRosterCache()`
- `hydrateRosterFromCache()` fileciteturn0file0

mantêm turmas e alunos disponíveis mesmo antes do backend responder.

### Resultado prático
O usuário pode continuar operando com menos risco de perder alterações se a página for recarregada ou a conexão oscilar. fileciteturn0file0

---

## 17. Como o backend organiza a planilha

### `ensureSheets_()`
Garante que todas as abas existam.

### `getOrCreateSheet_()`
Cria a aba se necessário, define cabeçalhos e pode ocultá-la. fileciteturn3file0

### Abas e propósito

#### `ReadBase`
Base de leitura e cadastro dos alunos.

#### `Base`
Histórico de presença por data e turma.

#### `__ALUNOS_META`
Metadados consolidados dos alunos.

#### `__TURMAS_META`
Controle interno das turmas.

#### `__RELATORIOS`
Log de relatórios, chamadas e envios. fileciteturn3file0

---

## 18. Principais funções do front e sua função no backend

### `refreshFromBackend()`
**Front:** carrega tudo do servidor.  
**Backend:** `init_()` gera a resposta inicial com turmas, alunos, chamadas e resumo. fileciteturn0file0turn3file0

### `saveCurrentCall()`
**Front:** envia a chamada pronta.  
**Backend:** `saveCall_()` grava na Base, recalcula estatísticas e retorna o resumo atualizado. fileciteturn0file0turn3file0

### `sendReport()`
**Front:** solicita envio do relatório.  
**Backend:** `sendReport_()` monta o texto e envia ao Telegram. fileciteturn0file0turn3file0

### `addTurma()`
**Front:** coleta nome e ordem.  
**Backend:** `addTurma_()` persiste em `__TURMAS_META`. fileciteturn0file0turn3file0

### `addAluno()`
**Front:** coleta nome, celular e turma.  
**Backend:** `addAluno_()` grava em `ReadBase` e `__ALUNOS_META`. fileciteturn0file0turn3file0

### `moveStudent()`
**Front:** escolhe turma destino.  
**Backend:** `moveAluno_()` atualiza o aluno no controle interno. fileciteturn0file0turn3file0

### `toggleStudentStatus()`
**Front:** alterna ativo/inativo.  
**Backend:** `toggleAluno_()` salva o novo estado. fileciteturn0file0turn3file0

---

## 19. Ponto importante sobre consistência

O sistema possui duas camadas de verdade:

- **interface local**, que reage rápido;
- **planilha/backend**, que consolida e valida os dados. fileciteturn0file0turn3file0

Isso permite:

- edição rápida sem travar a tela;
- rascunho local antes do salvamento;
- sincronização formal na planilha;
- relatórios oficiais calculados no servidor. fileciteturn0file0turn3file0

---

## 20. Resumo do fluxo completo

```txt
Usuário abre a página
↓
bootstrap() no .js
↓
refreshFromBackend()
↓
doGet(action=init) no .gs
↓
backend carrega planilha e retorna turmas/alunos/chamadas
↓
front renderiza a interface
↓
usuário marca presença ou cadastra algo
↓
front salva rascunho local
↓
saveCurrentCall() ou outra ação
↓
doPost(action=saveCall / sendReport / addTurma / addAluno / moveAluno / toggleAluno)
↓
backend persiste e recalcula
↓
front atualiza tudo com nova leitura do servidor
```

---

## 21. Conclusão

O arquivo `.js` é o orquestrador da experiência do usuário, enquanto o arquivo `.gs` é o motor de persistência, cálculo e integração externa. Os dois foram desenhados para trabalhar de forma complementar: o front prepara e mostra os dados; o backend valida, grava, recalcula e distribui esses dados para a planilha e para o Telegram. fileciteturn0file0turn3file0


