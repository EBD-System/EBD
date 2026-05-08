# Sistema de Presença por Turmas

Sistema de chamada em **uma única página**, pronto para ser hospedado no **GitHub Pages**, com integração com **Google Sheets**, **Google Apps Script** e envio de relatórios para **Telegram**.

## Visão geral

O sistema foi pensado para controlar a presença de alunos por turma, usando uma planilha já existente para leitura dos alunos e outra aba para gravação das chamadas.

### Fluxo principal

1. O front-end abre no GitHub Pages.
2. A página consulta o Apps Script.
3. O Apps Script lê os alunos da aba **ReadBase**.
4. A chamada é montada na tela por turma.
5. Ao salvar, os dados são gravados na aba **Base**.
6. O relatório da turma e o relatório geral podem ser enviados para o Telegram.
7. Ao recarregar a página, o sistema carrega os dados já salvos no Sheets.

---

## Estrutura dos arquivos

### `index.html`
É a estrutura da página.
Contém:
- seletor de data
- seletor de turma
- busca de aluno
- resumo da chamada
- lista de alunos
- campos de oferta e visitantes
- botões de salvar, enviar e avançar

### `style.css`
É o visual da aplicação.
Define:
- layout responsivo
- cores branco e azul fraco
- cartões, botões e campos
- aparência no celular e no computador

### `script.js`
É a lógica do front-end.
Responsável por:
- carregar turmas e alunos
- montar a chamada
- marcar presença e ausência
- salvar rascunho no navegador
- calcular resumo local
- enviar dados ao backend

### `backend.gs`
É o backend no Google Apps Script.
Responsável por:
- ler a aba `ReadBase`
- gravar a chamada na aba `Base`
- salvar histórico
- calcular estatísticas
- identificar inativos após 4 faltas
- gerar relatórios
- enviar mensagens para o Telegram

### `README.md`
Este arquivo explica como o sistema funciona e como configurá-lo.

---

## Como o sistema foi adaptado

O sistema foi ajustado para usar sua planilha existente.

### Leitura dos alunos
Os alunos são lidos da aba:

- `ReadBase`

### Gravação da chamada
A chamada é salva na aba:

- `Base`

Isso permite:
- reaproveitar os alunos já cadastrados
- evitar recadastrar tudo novamente
- manter histórico de presença por data e turma

---

## Configurações principais

### No `script.js`
Você deve colocar a URL do Web App do Apps Script:

```javascript
const APPS_SCRIPT_URL = 'SUA_URL_DO_WEB_APP_AQUI';
```

### No `backend.gs`
Você deve colocar:

```javascript
const SPREADSHEET_ID = 'ID_DA_SUA_PLANILHA';
const TELEGRAM_BOT_TOKEN = 'SEU_TOKEN_DO_BOT';
const TELEGRAM_CHAT_ID = 'SEU_CHAT_ID';
```

---

## Importante sobre as variáveis

### `SPREADSHEET_ID`
É o ID da planilha Google Sheets.
Não é a URL do Apps Script.

Exemplo:
```txt
https://docs.google.com/spreadsheets/d/1bB3SJnkDnjOb-Ro7d7fxWBzMoTp1DzAPHLQcR6LGysM/edit
```

O ID é:
```txt
1bB3SJnkDnjOb-Ro7d7fxWBzMoTp1DzAPHLQcR6LGysM
```

### `APPS_SCRIPT_URL`
É a URL publicada do Web App.

Exemplo:
```txt
https://script.google.com/macros/s/SEU_ID/exec
```

### `STORAGE_KEY`
É usado no navegador para salvar rascunho local da chamada.

Você não precisa alterar isso.

---

## Como funciona a chamada

1. Escolha a data.
2. Selecione a turma.
3. O sistema carrega os alunos da turma.
4. Marque presença ou ausência.
5. Preencha oferta e visitantes, se houver.
6. Clique em salvar chamada.
7. Clique em enviar relatório da turma.
8. No final, envie o relatório geral.

---

## Regras de presença

### Presença individual
Cada aluno tem seu próprio controle de presença.

### Percentual individual
O sistema calcula a presença de cada aluno com base no histórico salvo.

### Regra de 4 faltas
Se o aluno faltar 4 domingos seguidos:
- ele pode ser marcado como inativo
- ele aparece no final da lista
- pode ser reativado, recadastrado ou realocado

### Melhor aluno
O melhor aluno é o que tiver maior percentual de presença.

### Alunos com mais faltas
O sistema identifica:
- alunos com mais faltas
- alunos faltando muito
- alunos inativos
- alunos reativados

---

## Estrutura recomendada das abas

### Aba `ReadBase`
Usada para leitura dos alunos já cadastrados.

Campos esperados:
- `DATA`
- `ANO`
- `MÊS`
- `ALUNO`
- `CLASSE`
- `PRESENÇA`
- `ATRASO`
- `AUSÊNCIA`
- `OFERTA`

### Aba `Base`
Usada para registrar a chamada salva.

Ela armazena:
- data
- aluno
- classe
- presença
- atraso
- ausência
- oferta

---

## Integração com Telegram

O relatório pode ser enviado ao Telegram automaticamente pelo backend.

O texto enviado inclui:
- total de alunos
- presentes
- ausentes
- porcentagem de presença
- oferta da classe
- visitantes
- resumo por turma
- resumo geral

---

## Como publicar

### 1. GitHub Pages
Coloque estes arquivos no repositório:
- `index.html`
- `style.css`
- `script.js`

### 2. Google Apps Script
Crie um projeto no Apps Script e cole o conteúdo do `backend.gs`.

### 3. Publique como Web App
No Apps Script:
- implante como **Web App**
- permita acesso conforme necessário
- copie a URL gerada

### 4. Conecte o front ao backend
Cole a URL do Web App em `APPS_SCRIPT_URL` dentro do `script.js`.

### 5. Configure a planilha
Coloque o ID da planilha em `SPREADSHEET_ID` no `backend.gs`.

### 6. Configure Telegram
Coloque o token e o chat ID do bot no `backend.gs`.

---

## Comportamento esperado

Depois de configurado, o sistema deve:
- abrir diretamente no GitHub Pages
- carregar as turmas da sua planilha
- carregar os alunos da turma selecionada
- salvar a chamada sem perder dados
- manter o estado ao recarregar
- registrar histórico
- enviar relatórios para o Telegram

---

## Observações finais

Este sistema foi desenhado para:
- ser rápido no uso durante a chamada
- funcionar bem no celular
- preservar dados no Google Sheets
- evitar duplicação de registros
- manter histórico por data, turma e aluno
