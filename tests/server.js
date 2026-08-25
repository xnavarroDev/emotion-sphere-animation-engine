const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.TEST_PORT || 4173);
const host = '127.0.0.1';

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
};

function createServer() {
  return http.createServer((request, response) => {
  try {
    const url = new URL(request.url, `http://${host}:${port}`);
    const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const filePath = path.resolve(root, `.${pathname}`);
    const withinRoot = filePath === root || filePath.startsWith(`${root}${path.sep}`);

    if (!withinRoot) {
      response.writeHead(403).end('Forbidden');
      return;
    }

    const stat = fs.statSync(filePath);
    const resolvedPath = stat.isDirectory() ? path.join(filePath, 'index.html') : filePath;
    response.writeHead(200, {
      'Content-Type': contentTypes[path.extname(resolvedPath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });

    if (request.method === 'HEAD') response.end();
    else fs.createReadStream(resolvedPath).pipe(response);
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' ? 404 : 500).end(error.code === 'ENOENT' ? 'Not found' : 'Server error');
  }
  });
}

function startServer() {
  const server = createServer();
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve(server);
    });
  });
}

function stopServer(server) {
  server.closeAllConnections?.();
  return new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

if (require.main === module) {
  startServer().then(server => {
    process.stdout.write(`Test server listening on http://${host}:${port}\n`);
    for (const signal of ['SIGINT', 'SIGTERM']) {
      process.on(signal, () => stopServer(server).finally(() => process.exit(0)));
    }
  });
}

module.exports = { startServer, stopServer };
