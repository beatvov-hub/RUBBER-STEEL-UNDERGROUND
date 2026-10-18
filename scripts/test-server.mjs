import net from 'node:net';
import { createServer } from 'vite';

async function availablePort() {
  const probe = net.createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const address = probe.address();
  if (!address || typeof address === 'string') throw new Error('Could not reserve a local test port');
  await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
  return address.port;
}

export async function createTestTarget() {
  if (process.env.RSU_TEST_URL) return { url: process.env.RSU_TEST_URL, close: async () => {} };
  const port = await availablePort();
  const server = await createServer({
    configFile: false,
    base: './',
    server: { host: '127.0.0.1', port, strictPort: true },
  });
  await server.listen();
  return { url: `http://127.0.0.1:${port}/`, close: () => server.close() };
}
