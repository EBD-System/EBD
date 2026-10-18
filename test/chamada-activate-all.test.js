const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'src/modules/chamada/pages/index.html');
const JS_PATH = path.join(ROOT, 'src/modules/chamada/pages/chamada.js');

test('A ação de ativação em lote fica na área de alunos inativos', () => {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const inactiveTabIndex = html.indexOf('id="inactiveTabButton"');
  const bulkActionIndex = html.indexOf('id="inactiveBulkActions"');
  const studentsListIndex = html.indexOf('id="studentsList"');

  assert.ok(inactiveTabIndex >= 0, 'A aba Inativos deve existir.');
  assert.ok(bulkActionIndex > inactiveTabIndex, 'A ação deve ficar após as abas de status.');
  assert.ok(studentsListIndex > bulkActionIndex, 'A ação deve ficar antes da lista de alunos.');
  assert.match(html, /id="activateAllStudentsButton"[^>]*>[\s\S]*?Ativar todos os alunos/);
  assert.doesNotMatch(html, /inativar todos os alunos/i, 'Não deve existir ação para inativar todos.');
});

test('A ativação em lote chama o endpoint da turma, atualiza a lista e limita a ação por perfil', () => {
  const js = fs.readFileSync(JS_PATH, 'utf8');

  assert.match(js, /`\/classes\/\$\{encodeURIComponent\(classId\)\}\/students\/activate-all`/);
  assert.match(js, /\{ method: 'PUT', body: \{\} \}/);
  assert.match(js, /\['administrador', 'admin', 'secretaria', 'secretario'\]/);
  assert.match(js, /const refreshed = await loadStudentsAndAttendance\(\)/);
  assert.match(js, /window\.confirm\(/);
});
