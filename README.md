# Sistema de presença por turmas

## Estrutura
- `index.html` → página única no GitHub Pages
- `style.css` → visual branco e azul fraco
- `script.js` → lógica do front-end
- `backend.gs` → Google Apps Script com Google Sheets e Telegram

## Planilhas usadas
- `turmas`
- `alunos`
- `chamadas`
- `presencas`
- `relatorios`

## Fluxo
1. O front carrega os dados do Apps Script.
2. A chamada da turma é montada na mesma página.
3. Ao salvar, os dados vão para o Google Sheets.
4. Ao enviar relatório, o texto vai para o Telegram.
5. Se a página for recarregada, o sistema busca o que já está salvo no Sheets.

## Passos de implantação
1. Cole a URL do Web App do Apps Script em `APPS_SCRIPT_URL` no `script.js`.
2. Cole o ID da planilha em `SPREADSHEET_ID` no `backend.gs`.
3. Cole o token do bot em `TELEGRAM_BOT_TOKEN`.
4. Cole o chat ID em `TELEGRAM_CHAT_ID`.
5. Publique o Apps Script como Web App com acesso liberado.
6. Suba `index.html`, `style.css` e `script.js` no GitHub Pages.

## Observações
- O sistema foi pensado para uso em uma única página.
- O front mantém rascunho local para evitar perda de edição.
- O backend salva histórico por data, turma e aluno.