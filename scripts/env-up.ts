import { spawn } from 'node:child_process';
import net from 'node:net';

async function httpReady(url: string, accepted: number[]): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
    return accepted.includes(response.status);
  } catch {
    return false;
  }
}

async function tcpReady(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    const finish = (ready: boolean) => {
      socket.destroy();
      resolve(ready);
    };
    socket.setTimeout(2_000);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

async function stackReady(): Promise<boolean> {
  const [node, indexer, proof] = await Promise.all([
    httpReady('http://127.0.0.1:9944/health', [200]),
    httpReady('http://127.0.0.1:8088/api/v4/graphql', [405]),
    Promise.all([
      httpReady('http://127.0.0.1:6300/health', [200]),
      tcpReady(6300),
    ]).then(([http, tcp]) => http && tcp),
  ]);
  return node && indexer && proof;
}

async function runDockerCompose(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn('docker', ['compose', 'up', '-d', '--wait'], {
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`docker compose exited with ${code ?? 'no status'}`));
    });
  });
}

if (await stackReady()) {
  console.log('MIDNIGHT_STACK_READY reused compatible node/indexer/proof server');
} else {
  console.log('Starting pinned Midnight node/indexer/proof server...');
  await runDockerCompose();
  if (!(await stackReady())) {
    throw new Error('Docker Compose exited, but the Midnight stack failed health checks.');
  }
  console.log('MIDNIGHT_STACK_READY started project Docker Compose stack');
}
