import path from 'node:path';
import pino from 'pino';
import { WebSocket } from 'ws';
import { runPreprodSmoke } from '../src/preprod-smoke.js';

// @ts-expect-error Apollo subscriptions require WebSocket in Node.
globalThis.WebSocket = WebSocket;

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: { target: 'pino-pretty' },
});

const evidence = await runPreprodSmoke({
  logger,
  artifactPath: path.resolve('artifacts/preprod-smoke.json'),
});

console.log('\nMIDNIGHT_MANDATE_PREPROD_PASS');
console.log(`contract=${evidence.contractAddress}`);
console.log(`payment_tx=${evidence.paymentTxId}`);
console.log(
  `vault_delta=${BigInt(evidence.vaultAfterPayment) - BigInt(evidence.vaultBeforePayment)}`,
);
console.log(
  `recipient_delta=+${BigInt(evidence.recipientBalanceAfterPayment) - BigInt(evidence.recipientBalanceBeforePayment)}`,
);
