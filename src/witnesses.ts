import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';
import type { Ledger } from '../contracts/managed/mandate/contract/index.js';
import { bytesToHex, hexToBytes } from './wallet/hex.js';

export interface MandatePrivateState {
  policySecretHex: string;
  maxPerPayment: string;
  maxTotalSpend: string;
  allowedRecipientHex: string;
  ownerSecretHex: string;
}

export function privateStateFromPolicy(policy: {
  policySecret: Uint8Array;
  maxPerPayment: bigint;
  maxTotalSpend: bigint;
  allowedRecipient: Uint8Array;
  ownerSecret: Uint8Array;
}): MandatePrivateState {
  return {
    policySecretHex: bytesToHex(policy.policySecret),
    maxPerPayment: policy.maxPerPayment.toString(),
    maxTotalSpend: policy.maxTotalSpend.toString(),
    allowedRecipientHex: bytesToHex(policy.allowedRecipient),
    ownerSecretHex: bytesToHex(policy.ownerSecret),
  };
}

type Ctx = WitnessContext<Ledger, MandatePrivateState>;

export function makeWitnesses() {
  return {
    policy_secret(ctx: Ctx): [MandatePrivateState, Uint8Array] {
      return [ctx.privateState, hexToBytes(ctx.privateState.policySecretHex)];
    },
    max_per_payment(ctx: Ctx): [MandatePrivateState, bigint] {
      return [ctx.privateState, BigInt(ctx.privateState.maxPerPayment)];
    },
    max_total_spend(ctx: Ctx): [MandatePrivateState, bigint] {
      return [ctx.privateState, BigInt(ctx.privateState.maxTotalSpend)];
    },
    allowed_recipient(ctx: Ctx): [MandatePrivateState, Uint8Array] {
      return [ctx.privateState, hexToBytes(ctx.privateState.allowedRecipientHex)];
    },
    owner_secret(ctx: Ctx): [MandatePrivateState, Uint8Array] {
      return [ctx.privateState, hexToBytes(ctx.privateState.ownerSecretHex)];
    },
  };
}
