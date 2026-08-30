import pino, { type Logger } from 'pino';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import type { EnvironmentConfiguration } from '@midnight-ntwrk/testkit-js';
import { zkConfigPath } from '../contracts/index.js';
import { FixturePaymentIntentModel, proposalFromModel } from './agent/model.js';
import {
  createPaymentProposal,
  proposalToMandatePayment,
  type PaymentProposalV1,
} from './agent/proposal.js';
import { ZeroExtractionModel } from './agent/zero-extractor.js';
import { MandateClient } from './client.js';
import { LOCAL_CONFIG } from './config.js';
import type {
  AttackKind,
  DemoEvent,
  DemoMode,
  DemoSnapshot,
  PublicObserverSnapshot,
} from './demo-types.js';
import { buildProviders } from './providers.js';
import { MidnightWalletProvider, syncWallet } from './wallet.js';
import { bytesToHex, hexToBytes32, randomBytes32 } from './wallet/hex.js';
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
const INITIAL_BUDGET = 50n;
const MAX_PER_PAYMENT = 10n;
const MAX_TOTAL_SPEND = 12n;

type LedgerSnapshot = {
  balance: bigint;
  count: bigint;
  cumulativeSpend: bigint;
  nullifiers: bigint;
  receipts: bigint;
  active: boolean;
};

type ReadySession = {
  owner: MidnightWalletProvider;
  vendor: MidnightWalletProvider;
  client: MandateClient;
  color: Uint8Array;
  colorHex: string;
  vendorAddress: Uint8Array;
  vendorAddressHex: string;
};

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`demo invariant failed: ${message}`);
}

function sameLedger(left: LedgerSnapshot, right: LedgerSnapshot): boolean {
  return (
    left.balance === right.balance &&
    left.count === right.count &&
    left.cumulativeSpend === right.cumulativeSpend &&
    left.nullifiers === right.nullifiers &&
    left.receipts === right.receipts &&
    left.active === right.active
  );
}

function errorChain(error: unknown): string {
  const messages: string[] = [];
  let current: any = error;
  for (let index = 0; current && index < 8; index += 1) {
    messages.push(String(current.message ?? current));
    current = current.cause;
  }
  return messages.join(' | ');
}

export class LocalDemoSession {
  private readonly logger: Logger;
  private owner?: MidnightWalletProvider;
  private vendor?: MidnightWalletProvider;
  private client?: MandateClient;
  private color?: Uint8Array;
  private colorHex?: string;
  private vendorAddress?: Uint8Array;
  private vendorAddressHex?: string;
  private proposal: PaymentProposalV1 | null = null;
  private paidProposal: PaymentProposalV1 | null = null;
  private instruction = '';
  private mode: DemoMode = 'deterministic';
  private paymentTxId: string | null = null;
  private recoveryTxId: string | null = null;
  private recoveredAmount: bigint | null = null;
  private readonly attackStatus: Record<AttackKind, 'not-run' | 'rejected-no-movement'> = {
    'over-cap': 'not-run',
    'cumulative-budget': 'not-run',
    'wrong-recipient': 'not-run',
    replay: 'not-run',
  };
  private readonly events: DemoEvent[] = [];

  constructor(logger?: Logger) {
    this.logger =
      logger ??
      pino({
        level: process.env.LOG_LEVEL ?? 'info',
        transport: { target: 'pino-pretty' },
      });
  }

  private event(kind: DemoEvent['kind'], message: string, transactionId?: string): void {
    this.events.unshift({ at: new Date().toISOString(), kind, message, transactionId });
    this.events.splice(12);
  }

  private ready(): ReadySession {
    if (
      !this.owner ||
      !this.vendor ||
      !this.client ||
      !this.color ||
      !this.colorHex ||
      !this.vendorAddress ||
      !this.vendorAddressHex
    ) {
      throw new Error('demo session is not initialized');
    }
    return {
      owner: this.owner,
      vendor: this.vendor,
      client: this.client,
      color: this.color,
      colorHex: this.colorHex,
      vendorAddress: this.vendorAddress,
      vendorAddressHex: this.vendorAddressHex,
    };
  }

  async initialize(): Promise<DemoSnapshot> {
    if (this.client) return this.snapshot();
    setNetworkId(LOCAL_CONFIG.networkId);
    const environment: EnvironmentConfiguration = {
      walletNetworkId: LOCAL_CONFIG.networkId,
      networkId: LOCAL_CONFIG.networkId,
      indexer: LOCAL_CONFIG.indexer,
      indexerWS: LOCAL_CONFIG.indexerWS,
      node: LOCAL_CONFIG.node,
      nodeWS: LOCAL_CONFIG.nodeWS,
      faucet: LOCAL_CONFIG.faucet,
      proofServer: LOCAL_CONFIG.proofServer,
    };

    const [owner, vendor] = await Promise.all([
      MidnightWalletProvider.build(this.logger, environment, {
        kind: 'seed',
        value: OWNER_LOCAL_SEED,
      }),
      MidnightWalletProvider.build(this.logger, environment, {
        kind: 'seed',
        value: VENDOR_LOCAL_SEED,
      }),
    ]);

    try {
      await Promise.all([owner.start(), vendor.start()]);
      await Promise.all([
        syncWallet(this.logger, owner.wallet, 5 * 60_000),
        syncWallet(this.logger, vendor.wallet, 5 * 60_000),
      ]);
      const ownerInitial = await walletState(owner);
      const held = balanceEntries(ownerInitial);
      invariant(held.length > 0, 'local owner must hold unshielded NIGHT');
      const colorHex = held[0]![0];
      const color = hexToBytes32(colorHex);
      const vendorAddress = userAddressBytes((await walletState(vendor)).unshielded);
      const vendorAddressHex = bytesToHex(vendorAddress);
      const policySecret = randomBytes32();
      const deployed = await MandateClient.deploy(
        buildProviders(owner, zkConfigPath, LOCAL_CONFIG),
        `midnight-mandate-ui-${Date.now()}`,
        {
          policySecret,
          maxPerPayment: MAX_PER_PAYMENT,
          maxTotalSpend: MAX_TOTAL_SPEND,
          allowedRecipient: vendorAddress,
          ownerSecret: randomBytes32(),
        },
      );
      await deployed.client.deposit(color, INITIAL_BUDGET);
      invariant(
        (await deployed.client.inspect()).night_balances.lookup(color) === INITIAL_BUDGET,
        'initialized vault balance must equal the deposited budget',
      );

      this.owner = owner;
      this.vendor = vendor;
      this.client = deployed.client;
      this.color = color;
      this.colorHex = colorHex;
      this.vendorAddress = vendorAddress;
      this.vendorAddressHex = vendorAddressHex;
      this.event(
        'system',
        `Deployed and funded a private mandate vault with ${INITIAL_BUDGET} NIGHT.`,
        deployed.deploymentTxId,
      );
      return this.snapshot();
    } catch (error) {
      await Promise.allSettled([owner.stop(), vendor.stop()]);
      throw error;
    }
  }

  async propose(instruction: string, mode: DemoMode): Promise<DemoSnapshot> {
    const ready = this.ready();
    this.mode = mode;
    this.instruction = instruction;
    const model =
      mode === 'live-ai' ? new ZeroExtractionModel() : new FixturePaymentIntentModel();
    this.proposal = await proposalFromModel(
      instruction,
      {
        networkId: 'undeployed',
        contractAddress: String(ready.client.contractAddress),
        tokenColor: ready.colorHex,
        recipients: { vendor: ready.vendorAddressHex },
      },
      model,
    );
    this.event(
      'proposal',
      `${mode === 'live-ai' ? 'Live model' : 'Deterministic adapter'} proposed ${this.proposal.amount} NIGHT to the allow-listed vendor.`,
    );
    return this.snapshot();
  }

  async pay(): Promise<DemoSnapshot> {
    const ready = this.ready();
    if (!this.proposal) throw new Error('create a proposal before paying');
    const beforeLedger = await ready.client.inspect();
    const vaultBefore = beforeLedger.night_balances.lookup(ready.color);
    const vendorBefore = balanceFor(await walletState(ready.vendor), ready.colorHex);
    const payment = proposalToMandatePayment(this.proposal, {
      networkId: 'undeployed',
      contractAddress: String(ready.client.contractAddress),
    });
    const transactionId = await ready.client.pay(payment);
    const afterLedger = await ready.client.inspect();
    const vendorAfterState = await waitForWalletBalance(
      ready.vendor,
      ready.colorHex,
      vendorBefore + payment.amount,
    );
    const vendorAfter = balanceFor(vendorAfterState, ready.colorHex);
    invariant(
      vaultBefore - afterLedger.night_balances.lookup(ready.color) === payment.amount,
      'vault must decrease by the proposal amount',
    );
    invariant(vendorAfter - vendorBefore === payment.amount, 'vendor must receive proposal amount');
    this.paidProposal = this.proposal;
    this.paymentTxId = transactionId;
    this.event(
      'payment',
      `Atomic proof and payment confirmed: vault -${payment.amount}, vendor +${payment.amount}.`,
      transactionId,
    );
    return this.snapshot();
  }

  private ledgerSnapshot(
    ledger: Awaited<ReturnType<MandateClient['inspect']>>,
    color: Uint8Array,
  ): LedgerSnapshot {
    return {
      balance: ledger.night_balances.lookup(color),
      count: ledger.payment_count,
      cumulativeSpend: ledger.cumulative_spend,
      nullifiers: ledger.used_nullifiers.size(),
      receipts: ledger.payment_receipts.size(),
      active: ledger.active,
    };
  }

  async attack(kind: AttackKind): Promise<DemoSnapshot> {
    const ready = this.ready();
    const beforeLedger = this.ledgerSnapshot(await ready.client.inspect(), ready.color);
    const vendorBefore = balanceFor(await walletState(ready.vendor), ready.colorHex);
    let proposal: PaymentProposalV1;
    let pattern: RegExp;

    if (kind === 'replay') {
      if (!this.paidProposal) throw new Error('complete one valid payment before replaying it');
      proposal = this.paidProposal;
      pattern = /payment nonce already used/;
    } else {
      proposal = createPaymentProposal({
        networkId: 'undeployed',
        contractAddress: String(ready.client.contractAddress),
        tokenColor: ready.colorHex,
        amount:
          kind === 'over-cap'
            ? MAX_PER_PAYMENT + 1n
            : kind === 'cumulative-budget'
              ? MAX_TOTAL_SPEND - 5n + 1n
              : 5n,
        recipient: kind === 'wrong-recipient' ? 'ff'.repeat(32) : ready.vendorAddressHex,
        purpose: `adversarial ${kind} attempt`,
        nonce: bytesToHex(randomBytes32()),
      });
      pattern =
        kind === 'over-cap'
          ? /private payment cap exceeded/
          : kind === 'cumulative-budget'
            ? /private cumulative budget exceeded/
            : /recipient outside mandate/;
    }

    try {
      await ready.client.pay(
        proposalToMandatePayment(proposal, {
          networkId: 'undeployed',
          contractAddress: String(ready.client.contractAddress),
        }),
      );
      throw new Error(`${kind} unexpectedly succeeded`);
    } catch (error) {
      const message = errorChain(error);
      if (!pattern.test(message)) throw error;
    }

    const afterLedger = this.ledgerSnapshot(await ready.client.inspect(), ready.color);
    const vendorAfter = balanceFor(await walletState(ready.vendor), ready.colorHex);
    invariant(sameLedger(beforeLedger, afterLedger), `${kind} changed public contract state`);
    invariant(vendorBefore === vendorAfter, `${kind} changed vendor balance`);
    this.attackStatus[kind] = 'rejected-no-movement';
    this.event('rejection', `${kind} rejected; contract state and balances stayed unchanged.`);
    return this.snapshot();
  }

  async recoverAndClose(): Promise<DemoSnapshot> {
    const ready = this.ready();
    if (!this.paymentTxId) throw new Error('complete one valid payment before closing the vault');
    if (!Object.values(this.attackStatus).every((status) => status === 'rejected-no-movement')) {
      throw new Error('complete all four rejection checks before closing the demo vault');
    }

    const beforeLedger = await ready.client.inspect();
    invariant(beforeLedger.active, 'vault must be active before owner recovery');
    const recoveryAmount = beforeLedger.night_balances.lookup(ready.color);
    invariant(recoveryAmount > 0n, 'vault must hold funds before owner recovery');
    const ownerBefore = balanceFor(await walletState(ready.owner), ready.colorHex);
    const ownerAddress = userAddressBytes((await walletState(ready.owner)).unshielded);

    const transactionId = await ready.client.closeVault(
      ready.color,
      recoveryAmount,
      ownerAddress,
    );
    const afterLedger = await ready.client.inspect();
    const ownerAfterState = await waitForWalletBalance(
      ready.owner,
      ready.colorHex,
      ownerBefore + recoveryAmount,
    );
    const ownerAfter = balanceFor(ownerAfterState, ready.colorHex);
    invariant(!afterLedger.active, 'owner recovery must permanently close the vault');
    invariant(
      afterLedger.night_balances.lookup(ready.color) === 0n,
      'owner recovery must empty the vault',
    );
    invariant(ownerAfter - ownerBefore === recoveryAmount, 'owner must receive the full balance');
    invariant(
      afterLedger.payment_count === beforeLedger.payment_count &&
        afterLedger.cumulative_spend === beforeLedger.cumulative_spend &&
        afterLedger.used_nullifiers.size() === beforeLedger.used_nullifiers.size() &&
        afterLedger.payment_receipts.size() === beforeLedger.payment_receipts.size(),
      'owner recovery must preserve payment evidence',
    );

    this.recoveryTxId = transactionId;
    this.recoveredAmount = recoveryAmount;
    this.event(
      'recovery',
      `Owner proof recovered ${recoveryAmount} NIGHT; vault balance is zero and permanently closed.`,
      transactionId,
    );
    return this.snapshot();
  }

  async snapshot(): Promise<DemoSnapshot> {
    if (!this.client) {
      return {
        phase: 'cold',
        owner: null,
        agent: {
          mode: this.mode,
          instruction: this.instruction,
          proposal: this.proposal,
          lastPaymentTransactionId: this.paymentTxId,
        },
        observer: null,
        vendorBalance: null,
        attacks: { ...this.attackStatus },
        events: [...this.events],
      };
    }
    const ready = this.ready();
    const ledger = await ready.client.inspect();
    const vaultBalance = ledger.night_balances.lookup(ready.color).toString();
    const vendorBalance = balanceFor(await walletState(ready.vendor), ready.colorHex).toString();
    return {
      phase: !ledger.active
        ? 'closed'
        : this.paymentTxId
          ? 'paid'
          : this.proposal
            ? 'proposed'
            : 'ready',
      owner: {
        maxPerPayment: MAX_PER_PAYMENT.toString(),
        maxTotalSpend: MAX_TOTAL_SPEND.toString(),
        remainingPrivateBudget: (MAX_TOTAL_SPEND - ledger.cumulative_spend).toString(),
        allowedRecipientAlias: 'vendor',
        allowedRecipient: ready.vendorAddressHex,
        initialBudget: INITIAL_BUDGET.toString(),
        vaultBalance,
        active: ledger.active,
        recoveredAmount: this.recoveredAmount?.toString() ?? null,
        lastRecoveryTransactionId: this.recoveryTxId,
        policySecret: 'local-only-not-returned',
      },
      agent: {
        mode: this.mode,
        instruction: this.instruction,
        proposal: this.proposal,
        lastPaymentTransactionId: this.paymentTxId,
      },
      observer: {
        networkId: 'undeployed',
        contractAddress: String(ready.client.contractAddress),
        policyCommitment: bytesToHex(ledger.policy_commitment),
        ownerCommitment: bytesToHex(ledger.owner_commitment),
        active: ledger.active,
        vaultColor: ledger.has_vault_color ? bytesToHex(ledger.vault_color) : null,
        vaultBalance,
        paymentCount: ledger.payment_count.toString(),
        cumulativeSpend: ledger.cumulative_spend.toString(),
        usedNullifiers: ledger.used_nullifiers.size().toString(),
        paymentReceipts: ledger.payment_receipts.size().toString(),
      },
      vendorBalance,
      attacks: { ...this.attackStatus },
      events: [...this.events],
    };
  }

  async publicObserverSnapshot(): Promise<PublicObserverSnapshot> {
    if (!this.client) {
      return {
        phase: 'cold',
        observer: null,
        vendorBalance: null,
        events: [],
      };
    }

    const ready = this.ready();
    const ledger = await ready.client.inspect();
    const vaultBalance = ledger.night_balances.lookup(ready.color).toString();
    const vendorBalance = balanceFor(await walletState(ready.vendor), ready.colorHex).toString();

    return {
      phase: !ledger.active ? 'closed' : ledger.payment_count > 0n ? 'paid' : 'ready',
      observer: {
        networkId: 'undeployed',
        contractAddress: String(ready.client.contractAddress),
        policyCommitment: bytesToHex(ledger.policy_commitment),
        ownerCommitment: bytesToHex(ledger.owner_commitment),
        active: ledger.active,
        vaultColor: ledger.has_vault_color ? bytesToHex(ledger.vault_color) : null,
        vaultBalance,
        paymentCount: ledger.payment_count.toString(),
        cumulativeSpend: ledger.cumulative_spend.toString(),
        usedNullifiers: ledger.used_nullifiers.size().toString(),
        paymentReceipts: ledger.payment_receipts.size().toString(),
      },
      vendorBalance,
      events: this.events.filter(
        (event) =>
          event.kind === 'system' || event.kind === 'payment' || event.kind === 'recovery',
      ),
    };
  }

  async close(): Promise<void> {
    await Promise.allSettled([this.owner?.stop(), this.vendor?.stop()]);
    this.owner = undefined;
    this.vendor = undefined;
    this.client = undefined;
  }
}
