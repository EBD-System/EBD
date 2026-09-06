const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'src/modules/relatorios/relatorio-aluno/index.html');
const JS_PATH = path.join(ROOT, 'src/modules/relatorios/pages/relatorio-aluno.js');

 test('Relatório do Aluno lista somente nome e botão de download, sem célula de classe por linha', () => {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const js = fs.readFileSync(JS_PATH, 'utf8');

  const tableMatch = html.match(
    /<table class="student-table"[\s\S]*?<thead>([\s\S]*?)<\/thead>[\s\S]*?<tbody id="studentTableBody"><\/tbody>/
  );

  assert.ok(tableMatch, 'A tabela de alunos deve existir no markup.');
  const headers = [...tableMatch[1].matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/g)]
    .map((match) => match[1].replace(/<[^>]+>/g, '').trim().toLowerCase());

  assert.deepEqual(headers, ['nome do aluno', 'baixar']);
  assert.match(
    js,
    /<td class="student-name">\$\{name\}<\/td>[\s\S]*?<td>\s*<button/,
    'Cada linha deve renderizar nome e botão de download.'
  );
  assert.doesNotMatch(
    js,
    /<td[^>]*>[^<]*\$\{[^}]*student\.classe[^}]*\}[^<]*<\/td>/,
    'A classe não deve ser renderizada como célula da listagem.'
  );
});
