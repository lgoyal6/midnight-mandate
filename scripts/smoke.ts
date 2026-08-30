import path from 'node:path';
import pino from 'pino';
import { WebSocket } from 'ws';
import { runLocalSmoke } from '../src/local-smoke.js';

// @ts-expect-error Apollo subscriptions require WebSocket in Node.
globalThis.WebSocket = WebSocket;

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: { target: 'pino-pretty' },
});
const evidence = await runLocalSmoke({
  logger,
  artifactPath: path.resolve('artifacts/local-smoke.json'),
});

console.log('\nMIDNIGHT_MANDATE_SMOKE_PASS');
console.log(`contract=${evidence.contractAddress}`);
console.log(`payment_tx=${evidence.paymentTxId}`);
console.log(
  `vault_delta=${BigInt(evidence.vaultAfterPayment) - BigInt(evidence.vaultBeforePayment)}`,
);
console.log(
  `vendor_delta=+${BigInt(evidence.vendorAfterPayment) - BigInt(evidence.vendorBeforePayment)}`,
);
console.log(`cumulative_spend=${evidence.cumulativeSpendAfterPayment}`);
console.log(`rejected=${evidence.rejected.join(',')}`);
