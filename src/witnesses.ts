import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';
import type { Ledger } from '../contracts/managed/mandate/contract/index.js';
import { bytesToHex, hexToBytes } from './wallet/hex.js';

export interface MandatePrivateState {
  policySecretHex: string;
  maxPerPayment: string;
  allowedRecipientHex: string;
}

export function privateStateFromPolicy(policy: {
  policySecret: Uint8Array;
  maxPerPayment: bigint;
  allowedRecipient: Uint8Array;
}): MandatePrivateState {
  return {
    policySecretHex: bytesToHex(policy.policySecret),
    maxPerPayment: policy.maxPerPayment.toString(),
    allowedRecipientHex: bytesToHex(policy.allowedRecipient),
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
    allowed_recipient(ctx: Ctx): [MandatePrivateState, Uint8Array] {
      return [ctx.privateState, hexToBytes(ctx.privateState.allowedRecipientHex)];
    },
  };
}

