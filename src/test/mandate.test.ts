import { beforeEach, describe, expect, it } from 'vitest';
import { MandateSimulator, type Policy } from '../simulator.js';
import { paymentNullifier, policyCommitment } from '../contract.js';
import { bytesToHex, hexToBytes32, randomBytes32 } from '../wallet/hex.js';

const NIGHT = hexToBytes32('01');
const ALLOWED = hexToBytes32('aa');
const OTHER = hexToBytes32('bb');
const REQUEST = hexToBytes32('cafe');

let policy: Policy;
let sim: MandateSimulator;

beforeEach(() => {
  policy = {
    policySecret: randomBytes32(),
    maxPerPayment: 10n,
    allowedRecipient: ALLOWED,
  };
  sim = new MandateSimulator(policy);
});

function recipient(bytes: Uint8Array) {
  return { bytes };
}

function snapshot() {
  const state = sim.ledger();
  return {
    balance: state.night_balances.member(NIGHT)
      ? state.night_balances.lookup(NIGHT)
      : 0n,
    count: state.payment_count,
    nullifiers: state.used_nullifiers.size(),
  };
}

describe('private policy primitives', () => {
  it('derives stable policy commitments and nullifiers', () => {
    const nonce = hexToBytes32('01');
    expect(bytesToHex(policyCommitment(policy.policySecret, 10n, ALLOWED))).toBe(
      bytesToHex(policyCommitment(policy.policySecret, 10n, ALLOWED)),
    );
    expect(bytesToHex(paymentNullifier(policy.policySecret, nonce))).toBe(
      bytesToHex(paymentNullifier(policy.policySecret, nonce)),
    );
  });

  it('binds secret, cap, and recipient', () => {
    const baseline = bytesToHex(
      policyCommitment(policy.policySecret, policy.maxPerPayment, ALLOWED),
    );
    expect(bytesToHex(policyCommitment(randomBytes32(), 10n, ALLOWED))).not.toBe(baseline);
    expect(bytesToHex(policyCommitment(policy.policySecret, 11n, ALLOWED))).not.toBe(baseline);
    expect(bytesToHex(policyCommitment(policy.policySecret, 10n, OTHER))).not.toBe(baseline);
  });
});

describe('contract-custodied mandate enforcement', () => {
  beforeEach(() => {
    sim.call('deposit_night', NIGHT, 50n);
  });

  it('pays the exact allowed recipient within the private cap', () => {
    const nonce = randomBytes32();
    sim.call('agent_pay', NIGHT, 5n, recipient(ALLOWED), REQUEST, nonce);

    const state = sim.ledger();
    const nullifier = paymentNullifier(policy.policySecret, nonce);
    expect(state.night_balances.lookup(NIGHT)).toBe(45n);
    expect(state.payment_count).toBe(1n);
    expect(state.used_nullifiers.member(nullifier)).toBe(true);
    expect(bytesToHex(state.payment_receipts.lookup(nullifier))).toBe(bytesToHex(REQUEST));
  });

  it('accepts an amount exactly at the cap', () => {
    sim.call('agent_pay', NIGHT, 10n, recipient(ALLOWED), REQUEST, randomBytes32());
    expect(sim.ledger().night_balances.lookup(NIGHT)).toBe(40n);
  });

  it('rejects over-cap payment without changing state', () => {
    const before = snapshot();
    expect(() =>
      sim.call('agent_pay', NIGHT, 11n, recipient(ALLOWED), REQUEST, randomBytes32()),
    ).toThrow(/private payment cap exceeded/);
    expect(snapshot()).toEqual(before);
  });

  it('rejects a different recipient without changing state', () => {
    const before = snapshot();
    expect(() =>
      sim.call('agent_pay', NIGHT, 5n, recipient(OTHER), REQUEST, randomBytes32()),
    ).toThrow(/recipient outside mandate/);
    expect(snapshot()).toEqual(before);
  });

  it('rejects replay without changing state', () => {
    const nonce = randomBytes32();
    sim.call('agent_pay', NIGHT, 5n, recipient(ALLOWED), REQUEST, nonce);
    const before = snapshot();
    expect(() => sim.call('agent_pay', NIGHT, 5n, recipient(ALLOWED), REQUEST, nonce)).toThrow(
      /payment nonce already used/,
    );
    expect(snapshot()).toEqual(before);
  });

  it('rejects a wrong private opening', () => {
    const before = snapshot();
    sim.as({ ...policy, policySecret: randomBytes32() });
    expect(() =>
      sim.call('agent_pay', NIGHT, 5n, recipient(ALLOWED), REQUEST, randomBytes32()),
    ).toThrow(/private policy does not open commitment/);
    expect(snapshot()).toEqual(before);
  });

  it('rejects zero and insufficient-balance payments', () => {
    expect(() =>
      sim.call('agent_pay', NIGHT, 0n, recipient(ALLOWED), REQUEST, randomBytes32()),
    ).toThrow(/payment amount must be positive/);
    expect(() =>
      sim.call('agent_pay', NIGHT, 51n, recipient(ALLOWED), REQUEST, randomBytes32()),
    ).toThrow(/private payment cap exceeded/);

    const highCap = { ...policy, maxPerPayment: 100n };
    const highCapSim = new MandateSimulator(highCap);
    highCapSim.call('deposit_night', NIGHT, 50n);
    expect(() =>
      highCapSim.call(
        'agent_pay',
        NIGHT,
        51n,
        recipient(ALLOWED),
        REQUEST,
        randomBytes32(),
      ),
    ).toThrow(/insufficient balance/);
  });
});

describe('public projection', () => {
  it('contains no clear policy cap, recipient, or secret fields', () => {
    const publicKeys = Object.keys(sim.ledger()).sort();
    expect(publicKeys).toContain('policy_commitment');
    expect(publicKeys).not.toContain('max_per_payment');
    expect(publicKeys).not.toContain('allowed_recipient');
    expect(publicKeys).not.toContain('policy_secret');
  });
});

