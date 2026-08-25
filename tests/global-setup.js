const { startServer, stopServer } = require('./server');

module.exports = async function globalSetup() {
  if (process.env.BASE_URL) return () => {};
  const server = await startServer();
  return () => stopServer(server);
};
