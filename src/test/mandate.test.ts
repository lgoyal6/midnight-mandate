import { beforeEach, describe, expect, it } from 'vitest';
import { MandateSimulator, type Policy } from '../simulator.js';
import { ownerCommitment, paymentNullifier, policyCommitment } from '../contract.js';
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
    maxTotalSpend: 12n,
    allowedRecipient: ALLOWED,
    ownerSecret: randomBytes32(),
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
    cumulativeSpend: state.cumulative_spend,
    nullifiers: state.used_nullifiers.size(),
    active: state.active,
    hasVaultColor: state.has_vault_color,
  };
}

describe('private policy primitives', () => {
  it('derives stable policy commitments and nullifiers', () => {
    const nonce = hexToBytes32('01');
    expect(bytesToHex(policyCommitment(policy.policySecret, 10n, 12n, ALLOWED))).toBe(
      bytesToHex(policyCommitment(policy.policySecret, 10n, 12n, ALLOWED)),
    );
    expect(bytesToHex(paymentNullifier(policy.policySecret, nonce))).toBe(
      bytesToHex(paymentNullifier(policy.policySecret, nonce)),
    );
  });

  it('derives a stable owner identity distinct from the policy secret', () => {
    expect(bytesToHex(ownerCommitment(policy.ownerSecret))).toBe(
      bytesToHex(ownerCommitment(policy.ownerSecret)),
    );
    expect(bytesToHex(ownerCommitment(randomBytes32()))).not.toBe(
      bytesToHex(ownerCommitment(policy.ownerSecret)),
    );
    expect(bytesToHex(ownerCommitment(policy.policySecret))).not.toBe(
      bytesToHex(ownerCommitment(policy.ownerSecret)),
    );
  });

  it('binds secret, both caps, and recipient', () => {
    const baseline = bytesToHex(
      policyCommitment(
        policy.policySecret,
        policy.maxPerPayment,
        policy.maxTotalSpend,
        ALLOWED,
      ),
    );
    expect(bytesToHex(policyCommitment(randomBytes32(), 10n, 12n, ALLOWED))).not.toBe(baseline);
    expect(bytesToHex(policyCommitment(policy.policySecret, 11n, 12n, ALLOWED))).not.toBe(baseline);
    expect(bytesToHex(policyCommitment(policy.policySecret, 10n, 13n, ALLOWED))).not.toBe(baseline);
    expect(bytesToHex(policyCommitment(policy.policySecret, 10n, 12n, OTHER))).not.toBe(baseline);
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
    expect(state.cumulative_spend).toBe(5n);
    expect(state.used_nullifiers.member(nullifier)).toBe(true);
    expect(bytesToHex(state.payment_receipts.lookup(nullifier))).toBe(bytesToHex(REQUEST));
  });

  it('accepts an amount exactly at the cap', () => {
    sim.call('agent_pay', NIGHT, 10n, recipient(ALLOWED), REQUEST, randomBytes32());
    expect(sim.ledger().night_balances.lookup(NIGHT)).toBe(40n);
    expect(sim.ledger().cumulative_spend).toBe(10n);
  });

  it('accepts cumulative spend exactly at the hidden total', () => {
    sim.call('agent_pay', NIGHT, 5n, recipient(ALLOWED), REQUEST, randomBytes32());
    sim.call('agent_pay', NIGHT, 7n, recipient(ALLOWED), REQUEST, randomBytes32());
    expect(sim.ledger().cumulative_spend).toBe(12n);
    expect(sim.ledger().payment_count).toBe(2n);
    expect(sim.ledger().night_balances.lookup(NIGHT)).toBe(38n);
  });

  it('rejects a fresh individually valid payment that exceeds the cumulative budget', () => {
    sim.call('agent_pay', NIGHT, 5n, recipient(ALLOWED), REQUEST, randomBytes32());
    const before = snapshot();
    expect(() =>
      sim.call('agent_pay', NIGHT, 8n, recipient(ALLOWED), REQUEST, randomBytes32()),
    ).toThrow(/private cumulative budget exceeded/);
    expect(snapshot()).toEqual(before);
  });

  it('rejects over-cap payment without changing state', () => {
    const before = snapshot();
    expect(() =>
      sim.call('agent_pay', NIGHT, 11n, recipient(ALLOWED), REQUEST, randomBytes32()),
    ).toThrow(/private payment cap exceeded/);
    expect(snapshot()).toEqual(before);
  });

  it('rejects deposits of a second token color', () => {
    const before = snapshot();
    expect(() => sim.call('deposit_night', OTHER, 1n)).toThrow(
      /vault accepts one token color/,
    );
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

    const highCap = { ...policy, maxPerPayment: 100n, maxTotalSpend: 100n };
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

  it('rejects owner recovery with the policy secret or a wrong owner secret', () => {
    const before = snapshot();
    sim.as({ ...policy, ownerSecret: policy.policySecret });
    expect(() => sim.call('close_vault', NIGHT, 50n, recipient(OTHER))).toThrow(
      /not vault owner/,
    );
    expect(snapshot()).toEqual(before);
  });

  it('rejects partial recovery and the wrong token color without changing state', () => {
    const before = snapshot();
    expect(() => sim.call('close_vault', NIGHT, 49n, recipient(OTHER))).toThrow(
      /recovery must empty vault/,
    );
    expect(() => sim.call('close_vault', OTHER, 50n, recipient(OTHER))).toThrow(
      /wrong vault color/,
    );
    expect(snapshot()).toEqual(before);
  });

  it('lets the owner recover the full balance and permanently closes the vault', () => {
    sim.call('agent_pay', NIGHT, 5n, recipient(ALLOWED), REQUEST, randomBytes32());
    sim.call('close_vault', NIGHT, 45n, recipient(OTHER));
    expect(sim.ledger().night_balances.lookup(NIGHT)).toBe(0n);
    expect(sim.ledger().active).toBe(false);
    expect(sim.ledger().cumulative_spend).toBe(5n);

    const before = snapshot();
    expect(() =>
      sim.call('agent_pay', NIGHT, 1n, recipient(ALLOWED), REQUEST, randomBytes32()),
    ).toThrow(/vault closed/);
    expect(() => sim.call('deposit_night', NIGHT, 1n)).toThrow(/vault closed/);
    expect(snapshot()).toEqual(before);
  });
});

describe('public projection', () => {
  it('contains no clear policy cap, recipient, or secret fields', () => {
    const publicKeys = Object.keys(sim.ledger()).sort();
    expect(publicKeys).toContain('policy_commitment');
    expect(publicKeys).toContain('owner_commitment');
    expect(publicKeys).toContain('active');
    expect(publicKeys).toContain('cumulative_spend');
    expect(publicKeys).not.toContain('max_per_payment');
    expect(publicKeys).not.toContain('max_total_spend');
    expect(publicKeys).not.toContain('allowed_recipient');
    expect(publicKeys).not.toContain('policy_secret');
    expect(publicKeys).not.toContain('owner_secret');
  });
});
