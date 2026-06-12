import { createServer } from 'node:net';

const port = Number(process.argv[2]);
const host = process.argv[3] || '0.0.0.0';

const srv = createServer();
srv.listen(port, host, () => {
  process.stdout.write('ready\n');
});

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
