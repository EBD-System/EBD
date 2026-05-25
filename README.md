# Sistema de Lista de Presença da EBD

### [By: Everton Lourenço](https://github.com/Everton-Lourens)

Este projeto foi criado para resolver um problema prático: fazer a chamada das turmas de forma rápida, organizada e sem depender de contas manuais ou anotações espalhadas.  
Com ele, é possível registrar presença, cadastrar alunos e turmas, acompanhar faltas, gerar relatórios e manter tudo sincronizado com a planilha do Google Sheets.

O objetivo é simplificar a rotina de quem faz a chamada e evitar perda de informações, retrabalho e confusão na hora de conferir os dados.

---

## O que este sistema faz

- realiza a chamada por turma e por data;
- marca presença, atraso e ausência;
- calcula automaticamente totais e porcentagens;
- cadastra novas turmas e novos alunos;
- permite mover alunos entre turmas;
- ativa ou inativa alunos quando necessário;
- gera relatórios da turma e um resumo geral;
- salva rascunhos no navegador para evitar perda de dados;
- sincroniza tudo com o Google Sheets por meio do Google Apps Script;
- permite compartilhar relatórios para WhatsApp e outros canais configurados no backend.

---

## Problema que ele resolve

Antes deste sistema, o controle de presença podia depender de:

- anotações manuais;
- planilhas difíceis de atualizar;
- contas feitas na mão;
- relatórios montados separadamente;
- risco de esquecer informações importantes.

Este projeto centraliza tudo em um único fluxo.  
A pessoa faz a chamada, salva, e o sistema já organiza os dados, atualiza os totais e prepara os relatórios automaticamente.

---

## Como o sistema funciona

O projeto é dividido em duas partes:

### 1. Front-end
Arquivos responsáveis pela interface e pela interação com o usuário:

- `index.html`
- `style.css`
- `script.js`

Essa parte mostra a tela, recebe os cliques, filtra alunos, monta a chamada e envia os dados para o backend.

### 2. Backend
Arquivo responsável pela integração com o Google Sheets:

- `backend.gs`

Ele recebe os dados do front-end, grava na planilha, recalcula estatísticas, monta relatórios e devolve as informações atualizadas.

---

## Fluxo de uso

1. O usuário abre o sistema.
2. O sistema carrega as turmas e os alunos cadastrados.
3. O usuário escolhe a data e a turma.
4. A chamada é exibida na tela.
5. O usuário marca presença, atraso ou ausência.
6. O sistema salva os dados e atualiza os totais automaticamente.
7. O relatório da turma e o resumo geral ficam prontos para visualização ou envio.

---

## Funcionalidades principais

### Chamada rápida
Permite marcar presença de cada aluno individualmente ou usar ações em massa, como:

- todos presentes;
- todos ausentes.

### Cadastro de turmas e alunos
É possível criar novas turmas e cadastrar alunos diretamente na interface.

### Controle de status
Os alunos podem ser:

- ativos;
- inativos.

Alunos inativos deixam de aparecer nos relatórios, mas podem ser reativados depois.

### Busca e filtros
A interface permite procurar alunos por nome e esconder ou mostrar inativos.

### Relatórios automáticos
O sistema monta relatórios da turma e um relatório geral com os dados da chamada.

### Persistência e segurança
O navegador salva rascunhos automaticamente, ajudando a evitar perda de informação se a página for atualizada ou fechada antes do salvamento.

---

## Tecnologias usadas

- **HTML** para a estrutura da tela;
- **CSS** para o visual;
- **JavaScript** para a lógica da interface;
- **Google Apps Script** para o backend;
- **Google Sheets** para armazenamento dos dados.

---

## Estrutura do projeto

```txt
EBD-main/
├── README.md
├── backend.gs
├── index.html
├── script.js
└── style.css
```

---

## Como configurar

### Pré-requisitos

- uma conta Google;
- uma planilha no Google Sheets;
- um projeto no Google Apps Script;
- publicação do script como Web App.

### Passo a passo básico

1. Abra o projeto no Google Apps Script.
2. Cole o conteúdo do arquivo `backend.gs`.
3. Configure a planilha utilizada pelo sistema.
4. Publique o script como Web App.
5. Atualize no `script.js` a URL do Web App, se necessário.
6. Abra a interface em um navegador.

---

## Observações importantes

- O sistema foi pensado para uso prático no dia a dia.
- Os dados principais ficam sincronizados com a planilha.
- O navegador pode guardar rascunhos temporários.
- O backend é quem faz a gravação oficial e o cálculo consolidado.
- O sistema foi construído para agilizar a chamada e organizar os registros sem complicação.

---

## Em resumo

Este projeto foi desenvolvido para tornar a rotina da chamada mais simples, rápida e confiável.  
Ele une cadastro, presença, relatórios e sincronização com planilha em uma única solução, reduzindo erros e poupando tempo.

Se a ideia é controlar turmas com mais organização e menos trabalho manual, este sistema foi feito para isso.
