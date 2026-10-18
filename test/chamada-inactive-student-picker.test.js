const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'src/modules/chamada/pages/index.html');
const JS_PATH = path.join(ROOT, 'src/modules/chamada/pages/chamada.js');
const CSS_PATH = path.join(ROOT, 'src/modules/chamada/pages/chamada.css');

test('O popup de adicionar aluno abre primeiro a etapa compacta de consulta', () => {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const pickerIndex = html.indexOf('id="studentPickerStep"');
  const createButtonIndex = html.indexOf('id="createNewStudentButton"');
  const hintIndex = html.indexOf('Veja se o aluno já existe:');
  const listIndex = html.indexOf('id="inactiveStudentsList"');
  const formIndex = html.indexOf('id="addStudentForm"');

  assert.ok(pickerIndex >= 0, 'A etapa de consulta deve existir.');
  assert.ok(createButtonIndex > pickerIndex, 'O botão de novo aluno deve vir primeiro na etapa.');
  assert.ok(hintIndex > createButtonIndex, 'A orientação deve vir logo depois do botão.');
  assert.ok(listIndex > hintIndex, 'A listagem de inativos deve vir após a orientação.');
  assert.ok(formIndex > listIndex, 'O formulário existente deve ficar depois da etapa de consulta.');
  assert.match(html, /id="addStudentForm"[^>]*hidden/);
});

test('A consulta do popup é filtrada pela turma e a ativação usa o endpoint existente', () => {
  const js = fs.readFileSync(JS_PATH, 'utf8');
  assert.match(js, /`\/students\?classId=\$\{encodedClassId\}&status=inativo`/);
  assert.match(js, /`\/students\/inactive\?classId=\$\{encodedClassId\}`/);
  assert.match(js, /`\/students\/\$\{encodeURIComponent\(normalizedId\)\}\/activate`/);
  assert.match(js, /setStudentDialogStage\(normalizedMode === 'edit' \? 'form' : 'picker'\)/);
  assert.match(js, /function showNewStudentForm\(\)/);
  const pickerFetcher = js.split('async function fetchInactiveStudentsForPicker()')[1]?.split('async function loadInactiveStudentsForPicker()')[0] || '';
  assert.doesNotMatch(pickerFetcher, /`\/students\/inactive`/, 'O popup não deve buscar inativos sem limitar a turma.');
});

test('A listagem diferencia nome, status e botão de ativação com estilo compacto', () => {
  const js = fs.readFileSync(JS_PATH, 'utf8');
  const css = fs.readFileSync(CSS_PATH, 'utf8');
  assert.match(js, /class="inactive-student-name"/);
  assert.match(js, /class="inactive-student-status">Inativo<\/span>/);
  assert.match(js, /class="inactive-student-activate-button"/);
  assert.match(css, /\.class-dialog\[data-stage="picker"\] \.dialog-card/);
  assert.match(css, /\.inactive-student-name\s*\{[^}]*font-weight:\s*800/s);
  assert.match(css, /\.inactive-student-status\s*\{[^}]*color:\s*#dc2626/s);
  assert.match(css, /\.inactive-student-activate-button\s*\{[^}]*background:\s*#1557c0/s);
});
