#!/usr/bin/env node
/** Fails fast (with the owning process) when a dev port is already taken. */
import { execSync } from 'node:child_process';
import net from 'node:net';

const PORTS = { 4000: 'game-server', 3100: 'web (Next.js)' };

const free = (port) =>
  new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port);
  });

let busy = 0;
for (const [port, name] of Object.entries(PORTS)) {
  if (await free(Number(port))) continue;
  busy++;
  let owner = '';
  try {
    owner = execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN | tail -n +2`, { encoding: 'utf8' }).trim();
  } catch {
    /* lsof not available */
  }
  console.error(`✖ Port ${port} (${name}) is already in use.${owner ? `\n  ${owner.split('\n').join('\n  ')}` : ''}`);
}
if (busy) {
  console.error('\nStop the process above (e.g. a previous `npm run dev`: Ctrl+C, or `kill <PID>`), then run again.');
  process.exit(1);
}
