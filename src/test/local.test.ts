import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { runLocalSmoke } from '../local-smoke.js';

// @ts-expect-error Apollo subscriptions require WebSocket in Node.
globalThis.WebSocket = WebSocket;

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('Midnight Mandate local proof and payment', () => {
  it('deploys, funds, proves, pays, and rejects attacks without moving funds', async () => {
    const evidence = await runLocalSmoke({
      artifactPath: path.join(rootDir, 'artifacts', 'local-smoke.json'),
    });

    expect(BigInt(evidence.vaultBeforePayment) - BigInt(evidence.vaultAfterPayment)).toBe(5n);
    expect(BigInt(evidence.vendorAfterPayment) - BigInt(evidence.vendorBeforePayment)).toBe(5n);
    expect(evidence.cumulativeSpendAfterPayment).toBe('5');
    expect(evidence.rejected).toEqual([
      'over-cap',
      'cumulative-budget',
      'wrong-recipient',
      'replay',
    ]);
  });
});
