const path = require('node:path');
const { pathToFileURL } = require('node:url');

/** Import one browser-independent application module into the Node test process. */
function importAppModule(...parts) {
  return import(pathToFileURL(path.join(__dirname, '..', '..', 'app', ...parts)).href);
}

module.exports = { importAppModule };
