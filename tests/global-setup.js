const { startServer, stopServer } = require('./server');

// Use the local static server unless the caller supplied a deployment URL.
module.exports = async function globalSetup() {
  if (process.env.BASE_URL) return () => {};
  const server = await startServer();
  return () => stopServer(server);
};
