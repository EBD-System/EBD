import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const outDir = path.join(root, 'docs');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyDir(src, dest) {
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === 'docs') continue;
    if (entry.name === 'node_modules') continue;
    if (entry.name === '.git') continue;

    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(from, to);
      continue;
    }

    fs.copyFileSync(from, to);
  }
}

fs.rmSync(outDir, { recursive: true, force: true });
ensureDir(outDir);

for (const file of ['index.html', '404.html']) {
  const from = path.join(root, file);
  if (fs.existsSync(from)) {
    fs.copyFileSync(from, path.join(outDir, file));
  }
}

const srcDir = path.join(root, 'src');
if (fs.existsSync(srcDir)) {
  copyDir(srcDir, path.join(outDir, 'src'));
}

fs.writeFileSync(path.join(outDir, '.nojekyll'), '');
console.log('GitHub Pages build ready in docs/');
