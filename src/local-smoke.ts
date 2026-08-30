import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import pino, { type Logger } from 'pino';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import type { EnvironmentConfiguration } from '@midnight-ntwrk/testkit-js';
import { zkConfigPath } from '../contracts/index.js';
import { MandateClient } from './client.js';
import { FixturePaymentIntentModel, proposalFromModel } from './agent/model.js';
import { proposalToMandatePayment } from './agent/proposal.js';
import { getConfig } from './config.js';
import { buildProviders } from './providers.js';
import { MidnightWalletProvider, syncWallet } from './wallet.js';
import { hexToBytes32, randomBytes32 } from './wallet/hex.js';
import {
  balanceEntries,
  balanceFor,
  userAddressBytes,
  waitForWalletBalance,
  walletState,
} from './wallet-state.js';

const OWNER_LOCAL_SEED =
  '0000000000000000000000000000000000000000000000000000000000000001';
const VENDOR_LOCAL_SEED =
  '0000000000000000000000000000000000000000000000000000000000000002';
const DEPOSIT = 50n;
const CAP = 10n;
const TOTAL_CAP = 12n;
const VALID_AMOUNT = 5n;

export type LocalSmokeEvidence = {
  network: string;
  contractAddress: string;
  deploymentTxId: string;
  depositTxId: string;
  paymentTxId: string;
  color: string;
  vaultBeforePayment: string;
  vaultAfterPayment: string;
  vendorBeforePayment: string;
  vendorAfterPayment: string;
  cumulativeSpendAfterPayment: string;
  rejected: string[];
  recordedAt: string;
};

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`smoke assertion failed: ${message}`);
}

function sameState(
  left: { balance: bigint; count: bigint; cumulativeSpend: bigint; nullifiers: bigint },
  right: { balance: bigint; count: bigint; cumulativeSpend: bigint; nullifiers: bigint },
): boolean {
  return (
    left.balance === right.balance &&
    left.count === right.count &&
    left.cumulativeSpend === right.cumulativeSpend &&
    left.nullifiers === right.nullifiers
  );
}

async function expectRejected(
  logger: Logger,
  label: string,
  call: Promise<unknown>,
  pattern: RegExp,
): Promise<void> {
  try {
    await call;
  } catch (error: any) {
    const messages: string[] = [];
    let current: any = error;
    for (let index = 0; current && index < 8; index += 1) {
      messages.push(String(current.message ?? current));
      current = current.cause;
    }
    const text = messages.join(' | ');
    if (pattern.test(text)) {
      logger.info({ rejection: label }, 'attack rejected as expected');
      return;
    }
    throw new Error(`${label}: unexpected failure: ${text}`);
  }
  throw new Error(`${label}: expected rejection but call succeeded`);
}

export async function runLocalSmoke(options?: {
  logger?: Logger;
  artifactPath?: string;
}): Promise<LocalSmokeEvidence> {
  const logger =
    options?.logger ??
    pino({
      level: process.env.LOG_LEVEL ?? 'info',
      transport: { target: 'pino-pretty' },
    });
  const config = getConfig();
  setNetworkId(config.networkId);
  const environment: EnvironmentConfiguration = {
    walletNetworkId: config.networkId,
    networkId: config.networkId,
    indexer: config.indexer,
    indexerWS: config.indexerWS,
    node: config.node,
    nodeWS: config.nodeWS,
    faucet: config.faucet,
    proofServer: config.proofServer,
  };

  const [owner, vendor] = await Promise.all([
    MidnightWalletProvider.build(logger, environment, {
      kind: 'seed',
      value: OWNER_LOCAL_SEED,
    }),
    MidnightWalletProvider.build(logger, environment, {
      kind: 'seed',
      value: VENDOR_LOCAL_SEED,
    }),
  ]);

  try {
    await Promise.all([owner.start(), vendor.start()]);
    await Promise.all([
      syncWallet(logger, owner.wallet, 5 * 60_000),
      syncWallet(logger, vendor.wallet, 5 * 60_000),
    ]);

    const ownerInitial = await walletState(owner);
    const held = balanceEntries(ownerInitial);
    invariant(held.length > 0, 'local genesis owner must hold unshielded NIGHT');
    const colorHex = held[0]![0];
    const color = hexToBytes32(colorHex);
    const vendorInitial = await walletState(vendor);
    const vendorAddress = userAddressBytes(vendorInitial.unshielded);
    const vendorBalanceBefore = balanceFor(vendorInitial, colorHex);
    logger.info(
      { vendorAddress: Buffer.from(vendorAddress).toString('hex'), vendorBalanceBefore },
      'resolved vendor UserAddress',
    );

    const providers = buildProviders(owner, zkConfigPath, config);
    const privateStateId = `midnight-mandate-local-owner-${Date.now()}`;
    const policySecret = randomBytes32();
    const { client, deploymentTxId } = await MandateClient.deploy(
      providers,
      privateStateId,
      {
        policySecret,
        maxPerPayment: CAP,
        maxTotalSpend: TOTAL_CAP,
        allowedRecipient: vendorAddress,
      },
    );
    logger.info(
      { contractAddress: client.contractAddress, deploymentTxId },
      'contract deployment confirmed',
    );

    const depositTxId = await client.deposit(color, DEPOSIT);
    invariant(
      (await client.inspect()).night_balances.lookup(color) === DEPOSIT,
      'vault balance after deposit must equal 50',
    );
    logger.info({ depositTxId }, 'vault deposit confirmed');

    const validNonce = randomBytes32();
    const validProposal = await proposalFromModel(
      'Pay 5 NIGHT to vendor for local smoke invoice',
      {
        networkId: 'undeployed',
        contractAddress: String(client.contractAddress),
        tokenColor: colorHex,
        recipients: { vendor: Buffer.from(vendorAddress).toString('hex') },
        nonce: Buffer.from(validNonce).toString('hex'),
      },
      new FixturePaymentIntentModel(),
    );
    const validPayment = proposalToMandatePayment(validProposal, {
      networkId: 'undeployed',
      contractAddress: String(client.contractAddress),
    });
    const requestCommitment = validPayment.requestCommitment;
    const paymentTxId = await client.pay(validPayment);
    const paidLedger = await client.inspect();
    invariant(
      paidLedger.night_balances.lookup(color) === DEPOSIT - VALID_AMOUNT,
      'vault must decrease by the exact payment amount',
    );
    invariant(paidLedger.payment_count === 1n, 'payment counter must increment once');
    invariant(
      paidLedger.cumulative_spend === VALID_AMOUNT,
      'cumulative spend must equal the successful payment',
    );

    const vendorAfter = await waitForWalletBalance(
      vendor,
      colorHex,
      vendorBalanceBefore + VALID_AMOUNT,
    );
    const vendorBalanceAfter = balanceFor(vendorAfter, colorHex);
    invariant(
      vendorBalanceAfter - vendorBalanceBefore === VALID_AMOUNT,
      'vendor must receive the exact payment amount',
    );
    logger.info(
      {
        paymentTxId,
        vaultDelta: `-${VALID_AMOUNT}`,
        vendorDelta: `+${VALID_AMOUNT}`,
      },
      'atomic mandate payment confirmed',
    );

    const stable = {
      balance: paidLedger.night_balances.lookup(color),
      count: paidLedger.payment_count,
      cumulativeSpend: paidLedger.cumulative_spend,
      nullifiers: paidLedger.used_nullifiers.size(),
    };

    await expectRejected(
      logger,
      'over-cap',
      client.pay({
        color,
        amount: CAP + 1n,
        recipient: vendorAddress,
        requestCommitment,
        nonce: randomBytes32(),
      }),
      /private payment cap exceeded/,
    );
    await expectRejected(
      logger,
      'cumulative-budget',
      client.pay({
        color,
        amount: TOTAL_CAP - VALID_AMOUNT + 1n,
        recipient: vendorAddress,
        requestCommitment,
        nonce: randomBytes32(),
      }),
      /private cumulative budget exceeded/,
    );
    await expectRejected(
      logger,
      'wrong-recipient',
      client.pay({
        color,
        amount: VALID_AMOUNT,
        recipient: hexToBytes32('ff'),
        requestCommitment,
        nonce: randomBytes32(),
      }),
      /recipient outside mandate/,
    );
    await expectRejected(
      logger,
      'replay',
      client.pay({
        color,
        amount: VALID_AMOUNT,
        recipient: vendorAddress,
        requestCommitment,
        nonce: validNonce,
      }),
      /payment nonce already used/,
    );

    const afterAttacks = await client.inspect();
    invariant(
      sameState(
        {
          balance: afterAttacks.night_balances.lookup(color),
          count: afterAttacks.payment_count,
          cumulativeSpend: afterAttacks.cumulative_spend,
          nullifiers: afterAttacks.used_nullifiers.size(),
        },
        stable,
      ),
      'rejected attacks must not mutate contract state',
    );
    invariant(
      balanceFor(await walletState(vendor), colorHex) === vendorBalanceAfter,
      'rejected attacks must not move vendor funds',
    );

    const evidence: LocalSmokeEvidence = {
      network: config.networkId,
      contractAddress: String(client.contractAddress),
      deploymentTxId,
      depositTxId,
      paymentTxId,
      color: colorHex,
      vaultBeforePayment: DEPOSIT.toString(),
      vaultAfterPayment: (DEPOSIT - VALID_AMOUNT).toString(),
      vendorBeforePayment: vendorBalanceBefore.toString(),
      vendorAfterPayment: vendorBalanceAfter.toString(),
      cumulativeSpendAfterPayment: paidLedger.cumulative_spend.toString(),
      rejected: ['over-cap', 'cumulative-budget', 'wrong-recipient', 'replay'],
      recordedAt: new Date().toISOString(),
    };

    if (options?.artifactPath) {
      await mkdir(path.dirname(options.artifactPath), { recursive: true });
      await writeFile(
        options.artifactPath,
        `${JSON.stringify(evidence, null, 2)}\n`,
        'utf8',
      );
    }
    logger.info(evidence, 'LOCAL_SMOKE_PASS');
    return evidence;
  } finally {
    await Promise.allSettled([owner.stop(), vendor.stop()]);
  }
}
