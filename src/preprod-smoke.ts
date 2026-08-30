import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import pino, { type Logger } from 'pino';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import type { EnvironmentConfiguration } from '@midnight-ntwrk/testkit-js';
import { zkConfigPath } from '../contracts/index.js';
import { createPaymentProposal, proposalToMandatePayment } from './agent/proposal.js';
import { MandateClient } from './client.js';
import { PREPROD_CONFIG } from './config.js';
import { buildProviders } from './providers.js';
import { MidnightWalletProvider, syncWallet, type WalletSecret } from './wallet.js';
import { bytesToHex, hexToBytes32, randomBytes32 } from './wallet/hex.js';
import {
  balanceEntries,
  balanceFor,
  userAddressBytes,
  waitForWalletBalance,
  walletState,
} from './wallet-state.js';

const DEPOSIT = 50n;
const CAP = 10n;
const TOTAL_CAP = 12n;
const PAYMENT = 5n;

export type PreprodEvidence = {
  network: 'preprod';
  contractAddress: string;
  deploymentTxId: string;
  depositTxId: string;
  paymentTxId: string;
  color: string;
  vaultBeforePayment: string;
  vaultAfterPayment: string;
  recipientBalanceBeforePayment: string;
  recipientBalanceAfterPayment: string;
  cumulativeSpendAfterPayment: string;
  recordedAt: string;
};

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`preprod assertion failed: ${message}`);
}

function secretFromEnvironment(): WalletSecret {
  const mnemonic = process.env.MIDNIGHT_PREPROD_MNEMONIC?.trim();
  const seed = process.env.MIDNIGHT_PREPROD_SEED?.trim();
  if (Boolean(mnemonic) === Boolean(seed)) {
    throw new Error(
      'set exactly one of MIDNIGHT_PREPROD_MNEMONIC or MIDNIGHT_PREPROD_SEED in .env.preprod',
    );
  }
  if (seed) {
    if (!/^[0-9a-fA-F]{64}$/.test(seed)) {
      throw new Error('MIDNIGHT_PREPROD_SEED must be exactly 32 bytes of hexadecimal');
    }
    return { kind: 'seed', value: seed };
  }
  return { kind: 'mnemonic', value: mnemonic! };
}

function selectNightColor(entries: Array<[string, bigint]>): [string, bigint] {
  const explicit = process.env.MIDNIGHT_NIGHT_COLOR?.replace(/^0x/, '').toLowerCase();
  if (explicit && !/^[0-9a-f]{64}$/.test(explicit)) {
    throw new Error('MIDNIGHT_NIGHT_COLOR must be exactly 32 bytes of hexadecimal');
  }
  const selected = explicit
    ? entries.find(([color]) => color === explicit)
    : entries.find(([color]) => color === '0'.repeat(64)) ??
      (entries.length === 1 ? entries[0] : undefined);
  if (!selected) {
    throw new Error(
      'could not identify tNIGHT color; set MIDNIGHT_NIGHT_COLOR to one funded color from the wallet',
    );
  }
  if (selected[1] < DEPOSIT) {
    throw new Error(
      `Preprod wallet has ${selected[1]} base units for ${selected[0]}; fund at least ${DEPOSIT} from ${PREPROD_CONFIG.faucet}`,
    );
  }
  return selected;
}

export async function runPreprodSmoke(options?: {
  logger?: Logger;
  artifactPath?: string;
}): Promise<PreprodEvidence> {
  const logger =
    options?.logger ??
    pino({
      level: process.env.LOG_LEVEL ?? 'info',
      transport: { target: 'pino-pretty' },
    });
  const secret = secretFromEnvironment();
  setNetworkId(PREPROD_CONFIG.networkId);
  const environment: EnvironmentConfiguration = {
    walletNetworkId: PREPROD_CONFIG.networkId,
    networkId: PREPROD_CONFIG.networkId,
    indexer: PREPROD_CONFIG.indexer,
    indexerWS: PREPROD_CONFIG.indexerWS,
    node: PREPROD_CONFIG.node,
    nodeWS: PREPROD_CONFIG.nodeWS,
    faucet: PREPROD_CONFIG.faucet,
    proofServer: PREPROD_CONFIG.proofServer,
  };
  const wallet = await MidnightWalletProvider.build(logger, environment, secret);

  try {
    await wallet.start();
    const initial = await syncWallet(logger, wallet.wallet, 10 * 60_000);
    const [colorHex, initialBalance] = selectNightColor(balanceEntries(initial));
    const color = hexToBytes32(colorHex);
    const recipient = userAddressBytes(initial.unshielded);
    const recipientHex = bytesToHex(recipient);
    const { client, deploymentTxId } = await MandateClient.deploy(
      buildProviders(wallet, zkConfigPath, PREPROD_CONFIG),
      `midnight-mandate-preprod-${Date.now()}`,
      {
        policySecret: randomBytes32(),
        maxPerPayment: CAP,
        maxTotalSpend: TOTAL_CAP,
        allowedRecipient: recipient,
        ownerSecret: randomBytes32(),
      },
    );
    logger.info({ contractAddress: client.contractAddress, deploymentTxId }, 'Preprod deploy confirmed');

    const depositTxId = await client.deposit(color, DEPOSIT);
    await waitForWalletBalance(wallet, colorHex, initialBalance - DEPOSIT);
    const deposited = await client.inspect();
    invariant(deposited.night_balances.lookup(color) === DEPOSIT, 'vault deposit must equal 50');
    const recipientBeforePayment = balanceFor(await walletState(wallet), colorHex);

    const proposal = createPaymentProposal({
      networkId: 'preprod',
      contractAddress: String(client.contractAddress),
      tokenColor: colorHex,
      amount: PAYMENT,
      recipient: recipientHex,
      purpose: 'Midnight Mandate Preprod verification payment',
      nonce: bytesToHex(randomBytes32()),
    });
    const paymentTxId = await client.pay(
      proposalToMandatePayment(proposal, {
        networkId: 'preprod',
        contractAddress: String(client.contractAddress),
      }),
    );
    const recipientAfterState = await waitForWalletBalance(
      wallet,
      colorHex,
      recipientBeforePayment + PAYMENT,
    );
    const recipientAfterPayment = balanceFor(recipientAfterState, colorHex);
    const paid = await client.inspect();
    invariant(
      paid.night_balances.lookup(color) === DEPOSIT - PAYMENT,
      'vault must decrease by the exact payment',
    );
    invariant(
      recipientAfterPayment - recipientBeforePayment === PAYMENT,
      'recipient must receive the exact payment',
    );
    invariant(paid.cumulative_spend === PAYMENT, 'cumulative spend must equal the payment');

    const evidence: PreprodEvidence = {
      network: 'preprod',
      contractAddress: String(client.contractAddress),
      deploymentTxId,
      depositTxId,
      paymentTxId,
      color: colorHex,
      vaultBeforePayment: DEPOSIT.toString(),
      vaultAfterPayment: (DEPOSIT - PAYMENT).toString(),
      recipientBalanceBeforePayment: recipientBeforePayment.toString(),
      recipientBalanceAfterPayment: recipientAfterPayment.toString(),
      cumulativeSpendAfterPayment: paid.cumulative_spend.toString(),
      recordedAt: new Date().toISOString(),
    };
    if (options?.artifactPath) {
      await mkdir(path.dirname(options.artifactPath), { recursive: true });
      await writeFile(options.artifactPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    }
    logger.info(evidence, 'PREPROD_SMOKE_PASS');
    return evidence;
  } finally {
    await wallet.stop();
  }
}
