import * as MandateModule from '../contracts/managed/mandate/contract/index.js';
import type { Ledger } from '../contracts/managed/mandate/contract/index.js';

export const { Contract, ledger, pureCircuits } = MandateModule;
export type { Ledger };

export function policyCommitment(
  secret: Uint8Array,
  cap: bigint,
  recipient: Uint8Array,
): Uint8Array {
  return MandateModule.pureCircuits.derive_policy_commitment(secret, cap, recipient);
}

export function paymentNullifier(secret: Uint8Array, nonce: Uint8Array): Uint8Array {
  return MandateModule.pureCircuits.derive_payment_nullifier(secret, nonce);
}

