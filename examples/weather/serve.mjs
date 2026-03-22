import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createServer } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(__dirname);

const server = await createServer({ server: { port: 5174 } });
await server.listen();
server.printUrls();
