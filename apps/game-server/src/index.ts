import { createApp } from './app';
import { loadConfig } from './config';

async function main() {
  const config = loadConfig();
  const app = await createApp(config);

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.logger.info({ signal }, 'graceful shutdown');
    const force = setTimeout(() => process.exit(1), 15_000);
    force.unref();
    try {
      await app.close();
      process.exit(0);
    } catch (err) {
      app.logger.error({ err }, 'shutdown failed');
      process.exit(1);
    }
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (err) => app.logger.error({ err }, 'unhandled rejection'));
  // Handlers first: listen() may wait a while for Postgres / Redis, and SIGTERM must still shut down cleanly.
  await app.listen();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
