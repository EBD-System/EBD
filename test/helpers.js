'use strict';

const path = require('node:path');
const Module = require('node:module');

const PROJECT_ROOT = path.resolve(__dirname, '..');

function projectPath(relativePath) {
  return path.join(PROJECT_ROOT, relativePath);
}

function createMockModule(exports) {
  return {
    id: '<mock>',
    filename: '<mock>',
    loaded: true,
    exports
  };
}

function freshRequire(targetRelativePath, mocks = {}, virtualMocks = {}) {
  const targetPath = require.resolve(projectPath(targetRelativePath));
  const mockEntries = Object.entries(mocks).map(([relativePath, exports]) => [
    require.resolve(projectPath(relativePath)),
    exports
  ]);

  const virtualEntries = Object.entries(virtualMocks);
  const savedModules = new Map();
  savedModules.set(targetPath, require.cache[targetPath]);

  for (const [resolvedPath, exports] of mockEntries) {
    savedModules.set(resolvedPath, require.cache[resolvedPath]);
    require.cache[resolvedPath] = createMockModule(exports);
  }

  for (const [specifier, exports] of virtualEntries) {
    savedModules.set(specifier, require.cache[specifier]);
    require.cache[specifier] = createMockModule(exports);
  }

  const originalResolveFilename = Module._resolveFilename;
  if (virtualEntries.length > 0) {
    Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
      for (const [specifier] of virtualEntries) {
        if (request === specifier) return specifier;
      }
      return originalResolveFilename.call(this, request, parent, isMain, options);
    };
  }

  delete require.cache[targetPath];

  let loadedModule;
  try {
    loadedModule = require(targetPath);
  } finally {
    Module._resolveFilename = originalResolveFilename;

    for (const [resolvedPath, originalModule] of mockEntries) {
      const previous = savedModules.get(resolvedPath);
      if (previous === undefined) {
        delete require.cache[resolvedPath];
      } else {
        require.cache[resolvedPath] = previous;
      }
    }

    for (const [specifier] of virtualEntries) {
      const previous = savedModules.get(specifier);
      if (previous === undefined) {
        delete require.cache[specifier];
      } else {
        require.cache[specifier] = previous;
      }
    }

    const originalTarget = savedModules.get(targetPath);
    if (originalTarget === undefined) {
      delete require.cache[targetPath];
    } else {
      require.cache[targetPath] = originalTarget;
    }
  }

  return loadedModule;
}

function createNoopLogger() {
  return {
    info() {},
    warn() {},
    error() {},
    debug() {}
  };
}

function callMiddleware(middleware, req = {}) {
  return new Promise((resolve) => {
    const res = {};
    middleware(req, res, (error) => {
      resolve(error);
    });
  });
}

module.exports = {
  freshRequire,
  createNoopLogger,
  callMiddleware,
  projectPath
};
