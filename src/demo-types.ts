import type { PaymentProposalV1 } from './agent/proposal.js';

export type DemoMode = 'deterministic' | 'live-ai';
export type AttackKind = 'over-cap' | 'cumulative-budget' | 'wrong-recipient' | 'replay';
export type AttackStatus = 'not-run' | 'rejected-no-movement';

export type DemoEvent = {
  at: string;
  kind: 'system' | 'proposal' | 'payment' | 'rejection' | 'recovery';
  message: string;
  transactionId?: string;
};

export type DemoSnapshot = {
  phase: 'cold' | 'ready' | 'proposed' | 'paid' | 'closed';
  owner: null | {
    maxPerPayment: string;
    maxTotalSpend: string;
    remainingPrivateBudget: string;
    allowedRecipientAlias: string;
    allowedRecipient: string;
    initialBudget: string;
    vaultBalance: string;
    active: boolean;
    recoveredAmount: string | null;
    lastRecoveryTransactionId: string | null;
    policySecret: 'local-only-not-returned';
  };
  agent: {
    mode: DemoMode;
    instruction: string;
    proposal: PaymentProposalV1 | null;
    lastPaymentTransactionId: string | null;
  };
  observer: null | {
    networkId: string;
    contractAddress: string;
    policyCommitment: string;
    ownerCommitment: string;
    active: boolean;
    vaultColor: string | null;
    vaultBalance: string;
    paymentCount: string;
    cumulativeSpend: string;
    usedNullifiers: string;
    paymentReceipts: string;
  };
  vendorBalance: string | null;
  attacks: Record<AttackKind, AttackStatus>;
  events: DemoEvent[];
};

export type PublicObserverSnapshot = {
  phase: DemoSnapshot['phase'];
  observer: DemoSnapshot['observer'];
  vendorBalance: string | null;
  events: DemoEvent[];
};
