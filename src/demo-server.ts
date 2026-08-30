import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { WebSocket } from 'ws';
import { LocalDemoSession } from './demo-session.js';
import type { AttackKind, DemoMode } from './demo-types.js';

// @ts-expect-error Apollo subscriptions require WebSocket in Node.
globalThis.WebSocket = WebSocket;

const session = new LocalDemoSession();
let queue: Promise<unknown> = Promise.resolve();

function runExclusive<T>(operation: () => Promise<T>): Promise<T> {
  const next = queue.then(operation, operation);
  queue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(`${JSON.stringify(body)}\n`);
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.from(chunk);
    size += bytes.length;
    if (size > 16_384) throw new Error('request body exceeds 16 KiB');
    chunks.push(bytes);
  }
  if (chunks.length === 0) return {};
  const value = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('request body must be a JSON object');
  }
  return value as Record<string, unknown>;
}

const server = createServer(async (request, response) => {
  try {
    const method = request.method ?? 'GET';
    const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
    if (method === 'GET' && pathname === '/api/health') {
      json(response, 200, { ok: true });
      return;
    }
    if (method === 'GET' && pathname === '/api/state') {
      json(response, 200, await session.snapshot());
      return;
    }
    if (method === 'GET' && pathname === '/api/observer') {
      json(response, 200, await session.publicObserverSnapshot());
      return;
    }
    if (method === 'POST' && pathname === '/api/session') {
      json(response, 200, await runExclusive(() => session.initialize()));
      return;
    }
    if (method === 'POST' && pathname === '/api/proposal') {
      const body = await readJson(request);
      if (typeof body.instruction !== 'string') throw new Error('instruction must be a string');
      if (body.mode !== 'deterministic' && body.mode !== 'live-ai') {
        throw new Error('mode must be deterministic or live-ai');
      }
      json(
        response,
        200,
        await runExclusive(() => session.propose(body.instruction as string, body.mode as DemoMode)),
      );
      return;
    }
    if (method === 'POST' && pathname === '/api/pay') {
      json(response, 200, await runExclusive(() => session.pay()));
      return;
    }
    if (method === 'POST' && pathname === '/api/attack') {
      const body = await readJson(request);
      if (!['over-cap', 'cumulative-budget', 'wrong-recipient', 'replay'].includes(String(body.kind))) {
        throw new Error('kind must be over-cap, cumulative-budget, wrong-recipient, or replay');
      }
      json(
        response,
        200,
        await runExclusive(() => session.attack(body.kind as AttackKind)),
      );
      return;
    }
    json(response, 404, { error: 'not found' });
  } catch (error) {
    json(response, 400, {
      error: error instanceof Error ? error.message : 'unknown demo server error',
    });
  }
});

const port = Number.parseInt(process.env.MANDATE_DEMO_PORT ?? '8787', 10);
server.listen(port, '127.0.0.1', () => {
  console.log(`MANDATE_DEMO_API_READY http://127.0.0.1:${port}`);
});

async function shutdown(): Promise<void> {
  server.close();
  await session.close();
  process.exit(0);
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
