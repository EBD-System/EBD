# Sistema de Chamada e Presença de Turmas

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

### `formatCpf(value)`
Formata automaticamente um CPF parcial ou completo no padrão `000.000.000-00`.

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

### `normalizeCpfInput(event)`
Formata o CPF enquanto o usuário digita.

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
- formatação automática de CPF;
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

