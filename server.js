const fs = require('fs');
const path = require('path');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 8080;
const rootDir = __dirname;
const envFile = loadEnvFile(path.join(rootDir, '.env'));
const runtimeEnv = { ...envFile, ...process.env };

app.disable('x-powered-by');
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get('/src/app/config/config.js', (_req, res) => {
  const developmentMode = readBooleanEnv('developmentMode', undefined);
  const runtimeConfig = {};

  if (developmentMode !== undefined) {
    runtimeConfig.developmentMode = developmentMode;
  }

  const configPath = path.join(rootDir, 'src/app/config/config.js');
  const fileContents = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : '';

  res.type('application/javascript').send(
    `window.APP_RUNTIME_CONFIG = Object.freeze(${JSON.stringify(runtimeConfig)});\n${fileContents}`
  );
});
app.get('/src/app/config/error.js', (_req, res) => {
  const enabled = readBooleanEnv('errorDevelopmentMode', false);
  res.type('application/javascript').send(
    `window.APP_ERROR_CONFIG = Object.freeze({ errorDevelopmentMode: ${enabled} });\n`
  );
});

app.use(express.static(rootDir, { extensions: ['html'] }));

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const contents = fs.readFileSync(filePath, 'utf8');
  const result = {};

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

function readBooleanEnv(name, fallback = false) {
  const candidates = [
    runtimeEnv[name],
    runtimeEnv[name.toUpperCase()],
    runtimeEnv[name.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()]
  ];

  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null || candidate === '') {
      continue;
    }

    const normalized = String(candidate).trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  }

  return fallback;
}

function sendIfExists(res, candidate, status = 200) {
  const filePath = path.isAbsolute(candidate) ? candidate : path.join(rootDir, candidate);

  if (!fs.existsSync(filePath)) {
    return false;
  }

  res.status(status).sendFile(filePath);
  return true;
}

function sendFirstExisting(res, candidates) {
  for (const candidate of candidates) {
    if (sendIfExists(res, candidate)) {
      return true;
    }
  }

  return false;
}

function serveIndex(_req, res) {
  if (!sendIfExists(res, 'index.html')) {
    res.status(404).send('index.html não encontrado');
  }
}

function serveNotFound(_req, res) {
  if (!sendIfExists(res, '404.html', 404)) {
    res.status(404).send('Página não encontrada');
  }
}

function hasFileExtension(routePath) {
  return path.extname(routePath) !== '';
}

app.get('/', serveIndex);
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get(['/dashboard', '/dashboard/'], (_req, res) => {
  if (!sendFirstExisting(res, [
    'src/modules/dashboard/pages/home/index.html',
    'modules/dashboard/pages/home/index.html',
  ])) {
    serveNotFound(_req, res);
  }
});

app.get(['/chamada', '/chamada/'], (_req, res) => {
  if (!sendFirstExisting(res, [
    'src/modules/chamada/pages/index.html',
    'modules/chamada/pages/index.html',
  ])) {
    serveNotFound(_req, res);
  }
});

app.get(['/chamada/alunos', '/chamada/alunos/'], (_req, res) => {
  if (!sendFirstExisting(res, [
    'src/modules/chamada/pages/alunos/index.html',
    'modules/chamada/pages/alunos/index.html',
  ])) {
    serveNotFound(_req, res);
  }
});

app.get(['/chamada/visitantes', '/chamada/visitantes/'], (_req, res) => {
  if (!sendFirstExisting(res, [
    'src/modules/chamada/pages/visitantes/index.html',
    'modules/chamada/pages/visitantes/index.html',
  ])) {
    serveNotFound(_req, res);
  }
});

app.get('*', (req, res, next) => {
  if (hasFileExtension(req.path)) {
    return next();
  }

  return serveNotFound(req, res);
});

app.use(serveNotFound);

app.listen(PORT, () => {
  console.log(`Login shell running on http://localhost:${PORT}`);
});
