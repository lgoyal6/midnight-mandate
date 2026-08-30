import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { firstValueFrom, filter, timeout } from 'rxjs';
import pino from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { deployContract, submitCallTx } from '@midnight-ntwrk/midnight-js-contracts';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import type { ContractAddress } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import type { EnvironmentConfiguration } from '@midnight-ntwrk/testkit-js';
import {
  CompiledMandateContract,
  Contract,
  ledger,
  zkConfigPath,
} from '../../contracts/index.js';
import { getConfig } from '../config.js';
import { policyCommitment } from '../contract.js';
import { buildProviders, type MandateProviders } from '../providers.js';
import { privateStateFromPolicy } from '../witnesses.js';
import { MidnightWalletProvider, syncWallet } from '../wallet.js';
import { hexToBytes, hexToBytes32, randomBytes32 } from '../wallet/hex.js';

// @ts-expect-error Apollo subscriptions require WebSocket in Node.
globalThis.WebSocket = WebSocket;

const OWNER_LOCAL_SEED =
  '0000000000000000000000000000000000000000000000000000000000000001';
const VENDOR_LOCAL_SEED =
  '0000000000000000000000000000000000000000000000000000000000000002';
const PRIVATE_STATE_ID = `midnight-mandate-local-owner-${Date.now()}`;
const DEPOSIT = 50n;
const CAP = 10n;
const VALID_AMOUNT = 5n;

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: { target: 'pino-pretty' },
});

const config = getConfig();
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function toUserAddressBytes(unshielded: any): Uint8Array {
  const publicKey = unshielded?.state?.publicKey ?? unshielded?.publicKey;
  if (publicKey?.address instanceof Uint8Array) return publicKey.address;
  if (typeof publicKey?.addressHex === 'string') return hexToBytes(publicKey.addressHex);

  const address = unshielded?.address;
  if (address?.bytes instanceof Uint8Array) return address.bytes;
  if (address?.data instanceof Uint8Array) return address.data;
  if (typeof address?.addressHex === 'string') return hexToBytes(address.addressHex);
  throw new Error('Could not find raw unshielded UserAddress bytes.');
}

function balanceEntries(state: any): Array<[string, bigint]> {
  return Object.entries(state.unshielded.balances as Record<string, bigint>).map(
    ([color, value]) => [color.replace(/^0x/, ''), BigInt(value)],
  );
}

function balanceFor(state: any, colorHex: string): bigint {
  return balanceEntries(state).find(([color]) => color === colorHex)?.[1] ?? 0n;
}

async function walletState(wallet: MidnightWalletProvider): Promise<any> {
  return firstValueFrom(wallet.wallet.state());
}

async function waitForWalletBalance(
  wallet: MidnightWalletProvider,
  colorHex: string,
  expected: bigint,
): Promise<any> {
  return firstValueFrom(
    wallet.wallet.state().pipe(
      filter((state: any) => balanceFor(state, colorHex) === expected),
      timeout(120_000),
    ),
  );
}

function txId(result: any): string {
  const value = result?.public?.txId ?? result?.public?.transactionHash;
  if (!value) throw new Error('transaction result did not include a transaction id');
  return String(value);
}

async function expectRejected(label: string, call: Promise<unknown>, pattern: RegExp) {
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
      logger.info(`${label}: rejected as expected`);
      return;
    }
    throw new Error(`${label}: unexpected failure: ${text}`);
  }
  throw new Error(`${label}: expected rejection but call succeeded`);
}

describe('Midnight Mandate local proof and payment', () => {
  let owner: MidnightWalletProvider;
  let vendor: MidnightWalletProvider;
  let providers: MandateProviders;
  let contractAddress: ContractAddress;
  let color: Uint8Array;
  let colorHex: string;
  let vendorAddress: Uint8Array;
  let vendorBalanceBefore: bigint;
  let validNonce: Uint8Array;

  beforeAll(async () => {
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

    owner = await MidnightWalletProvider.build(logger, environment, {
      kind: 'seed',
      value: OWNER_LOCAL_SEED,
    });
    vendor = await MidnightWalletProvider.build(logger, environment, {
      kind: 'seed',
      value: VENDOR_LOCAL_SEED,
    });
    await Promise.all([owner.start(), vendor.start()]);
    await Promise.all([
      syncWallet(logger, owner.wallet, 5 * 60_000),
      syncWallet(logger, vendor.wallet, 5 * 60_000),
    ]);

    const ownerInitial = await walletState(owner);
    const held = balanceEntries(ownerInitial);
    if (held.length === 0) throw new Error('local genesis owner has no unshielded NIGHT');
    colorHex = held[0]![0];
    color = hexToBytes32(colorHex);
    const vendorInitial = await walletState(vendor);
    vendorAddress = toUserAddressBytes(vendorInitial.unshielded);
    vendorBalanceBefore = balanceFor(vendorInitial, colorHex);
    logger.info(
      { vendorAddress: Buffer.from(vendorAddress).toString('hex'), vendorBalanceBefore },
      'resolved vendor UserAddress',
    );
    providers = buildProviders(owner, zkConfigPath, config);
  });

  afterAll(async () => {
    await Promise.allSettled([owner?.stop(), vendor?.stop()]);
  });

  it('deploys, funds, proves, pays, and rejects attacks without moving funds', async () => {
    const policySecret = randomBytes32();
    const privateState = privateStateFromPolicy({
      policySecret,
      maxPerPayment: CAP,
      allowedRecipient: vendorAddress,
    });
    const commitment = policyCommitment(policySecret, CAP, vendorAddress);

    const deployed = await deployContract<Contract>(providers, {
      compiledContract: CompiledMandateContract,
      privateStateId: PRIVATE_STATE_ID,
      initialPrivateState: privateState,
      args: [commitment],
    });
    contractAddress = deployed.deployTxData.public.contractAddress;
    const deploymentTxId = txId(deployed.deployTxData);
    logger.info(`contract=${contractAddress}`);
    logger.info(`deploymentTx=${deploymentTxId}`);

    const queryLedger = async () => {
      const state = await providers.publicDataProvider.queryContractState(contractAddress);
      if (!state) throw new Error(`contract ${contractAddress} was not indexed`);
      return ledger(state.data);
    };

    const depositResult = await submitCallTx<Contract, 'deposit_night'>(providers, {
      compiledContract: CompiledMandateContract,
      contractAddress,
      privateStateId: PRIVATE_STATE_ID,
      circuitId: 'deposit_night',
      args: [color, DEPOSIT],
    });
    const depositTxId = txId(depositResult);
    expect((await queryLedger()).night_balances.lookup(color)).toBe(DEPOSIT);
    logger.info({ depositTxId }, 'vault deposit confirmed');

    validNonce = randomBytes32();
    const requestCommitment = hexToBytes32('010203');
    const paymentResult = await submitCallTx<Contract, 'agent_pay'>(providers, {
      compiledContract: CompiledMandateContract,
      contractAddress,
      privateStateId: PRIVATE_STATE_ID,
      circuitId: 'agent_pay',
      args: [color, VALID_AMOUNT, { bytes: vendorAddress }, requestCommitment, validNonce],
    });
    const paymentTxId = txId(paymentResult);
    const paidLedger = await queryLedger();
    expect(paidLedger.night_balances.lookup(color)).toBe(DEPOSIT - VALID_AMOUNT);
    expect(paidLedger.payment_count).toBe(1n);
    logger.info({ paymentTxId }, 'mandate payment confirmed');

    const vendorAfter = await waitForWalletBalance(
      vendor,
      colorHex,
      vendorBalanceBefore + VALID_AMOUNT,
    );
    const vendorBalanceAfter = balanceFor(vendorAfter, colorHex);
    expect(vendorBalanceAfter - vendorBalanceBefore).toBe(VALID_AMOUNT);

    const stable = {
      balance: paidLedger.night_balances.lookup(color),
      count: paidLedger.payment_count,
      nullifiers: paidLedger.used_nullifiers.size(),
    };

    await expectRejected(
      'over-cap',
      submitCallTx<Contract, 'agent_pay'>(providers, {
        compiledContract: CompiledMandateContract,
        contractAddress,
        privateStateId: PRIVATE_STATE_ID,
        circuitId: 'agent_pay',
        args: [color, CAP + 1n, { bytes: vendorAddress }, requestCommitment, randomBytes32()],
      }),
      /private payment cap exceeded/,
    );
    await expectRejected(
      'wrong-recipient',
      submitCallTx<Contract, 'agent_pay'>(providers, {
        compiledContract: CompiledMandateContract,
        contractAddress,
        privateStateId: PRIVATE_STATE_ID,
        circuitId: 'agent_pay',
        args: [
          color,
          VALID_AMOUNT,
          { bytes: hexToBytes32('ff') },
          requestCommitment,
          randomBytes32(),
        ],
      }),
      /recipient outside mandate/,
    );
    await expectRejected(
      'replay',
      submitCallTx<Contract, 'agent_pay'>(providers, {
        compiledContract: CompiledMandateContract,
        contractAddress,
        privateStateId: PRIVATE_STATE_ID,
        circuitId: 'agent_pay',
        args: [color, VALID_AMOUNT, { bytes: vendorAddress }, requestCommitment, validNonce],
      }),
      /payment nonce already used/,
    );

    const afterAttacks = await queryLedger();
    expect({
      balance: afterAttacks.night_balances.lookup(color),
      count: afterAttacks.payment_count,
      nullifiers: afterAttacks.used_nullifiers.size(),
    }).toEqual(stable);
    expect(balanceFor(await walletState(vendor), colorHex)).toBe(vendorBalanceAfter);

    const evidence = {
      network: config.networkId,
      contractAddress,
      deploymentTxId,
      depositTxId,
      paymentTxId,
      color: colorHex,
      vaultBeforePayment: DEPOSIT.toString(),
      vaultAfterPayment: (DEPOSIT - VALID_AMOUNT).toString(),
      vendorBeforePayment: vendorBalanceBefore.toString(),
      vendorAfterPayment: vendorBalanceAfter.toString(),
      rejected: ['over-cap', 'wrong-recipient', 'replay'],
      recordedAt: new Date().toISOString(),
    };
    await mkdir(path.join(rootDir, 'artifacts'), { recursive: true });
    await writeFile(
      path.join(rootDir, 'artifacts', 'local-smoke.json'),
      `${JSON.stringify(evidence, null, 2)}\n`,
      'utf8',
    );
    logger.info(evidence, 'LOCAL_SMOKE_PASS');
  });
});
