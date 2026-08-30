import { describe, expect, it } from 'vitest';
import {
  canonicalizeProposal,
  createPaymentProposal,
  hashPurpose,
  parsePaymentProposal,
  proposalToMandatePayment,
  publicProposalProjection,
} from '../agent/proposal.js';
import {
  FixturePaymentIntentModel,
  proposalFromModel,
  type PaymentIntentModel,
} from '../agent/model.js';
import { bytesToHex } from '../wallet/hex.js';

const CONTRACT = '11'.repeat(32);
const COLOR = '22'.repeat(32);
const VENDOR = '33'.repeat(32);
const NONCE = '44'.repeat(32);

const context = {
  networkId: 'undeployed' as const,
  contractAddress: CONTRACT,
  tokenColor: COLOR,
  recipients: { vendor: VENDOR },
  nonce: NONCE,
};

describe('PaymentProposalV1', () => {
  it('canonicalizes a strict proposal and converts it to the contract client input', () => {
    const proposal = createPaymentProposal({
      ...context,
      recipient: VENDOR,
      amount: 5n,
      purpose: 'invoice INV-42',
    });
    expect(canonicalizeProposal(proposal)).toBe(canonicalizeProposal({ ...proposal }));
    expect(proposal.requestHash).toBe(hashPurpose('invoice INV-42'));

    const payment = proposalToMandatePayment(proposal);
    expect(bytesToHex(payment.color)).toBe(COLOR);
    expect(payment.amount).toBe(5n);
    expect(bytesToHex(payment.recipient)).toBe(VENDOR);
    expect(bytesToHex(payment.requestCommitment)).toBe(proposal.requestHash);
    expect(bytesToHex(payment.nonce)).toBe(NONCE);
  });

  it.each([
    ['unknown field', { extra: true }, /fields must match/],
    ['missing nonce', { nonce: undefined }, /fields must match|nonce must/],
    ['malformed recipient', { recipient: 'abcd' }, /recipient must be exactly/],
    ['zero amount', { amount: '0' }, /amount must be positive/],
    ['unsafe syntax', { amount: '1e3' }, /canonical base-10/],
    ['uint128 overflow', { amount: (1n << 128n).toString() }, /exceeds Compact/],
    ['wrong request hash', { requestHash: 'ff'.repeat(32) }, /does not commit/],
  ])('rejects %s', (_label, mutation, pattern) => {
    const baseline = createPaymentProposal({
      ...context,
      recipient: VENDOR,
      amount: 5n,
      purpose: 'invoice INV-42',
    }) as Record<string, unknown>;
    const candidate: Record<string, unknown> = { ...baseline, ...mutation };
    if ('nonce' in mutation && mutation.nonce === undefined) {
      delete candidate.nonce;
    }
    expect(() => parsePaymentProposal(candidate)).toThrow(pattern as RegExp);
  });

  it('keeps the natural-language purpose out of the public projection', () => {
    const proposal = createPaymentProposal({
      ...context,
      recipient: VENDOR,
      amount: 5n,
      purpose: 'invoice INV-42',
    });
    expect(publicProposalProjection(proposal)).not.toHaveProperty('purpose');
    expect(publicProposalProjection(proposal)).toHaveProperty('requestHash');
  });

  it('rejects a proposal bound to another network or contract', () => {
    const proposal = createPaymentProposal({
      ...context,
      recipient: VENDOR,
      amount: 5n,
      purpose: 'invoice INV-42',
    });
    expect(() =>
      proposalToMandatePayment(proposal, {
        networkId: 'preprod',
        contractAddress: CONTRACT,
      }),
    ).toThrow(/network does not match/);
    expect(() =>
      proposalToMandatePayment(proposal, {
        networkId: 'undeployed',
        contractAddress: 'ff'.repeat(32),
      }),
    ).toThrow(/contract does not match/);
  });
});

describe('model authority boundary', () => {
  it('routes deterministic natural language through the strict proposal type', async () => {
    const proposal = await proposalFromModel(
      'Pay 5 NIGHT to vendor for invoice INV-42',
      context,
      new FixturePaymentIntentModel(),
    );
    expect(proposal).toEqual(
      createPaymentProposal({
        ...context,
        recipient: VENDOR,
        amount: 5n,
        purpose: 'invoice INV-42',
      }),
    );
  });

  it('rejects unknown model fields and recipient aliases', async () => {
    const extraField: PaymentIntentModel = {
      name: 'malicious-extra-field',
      async extract() {
        return { amount: 5, recipientAlias: 'vendor', purpose: 'invoice', walletSeed: 'steal' };
      },
    };
    await expect(proposalFromModel('pay it', context, extraField)).rejects.toThrow(
      /exactly amount/,
    );

    const wrongRecipient: PaymentIntentModel = {
      name: 'malicious-recipient',
      async extract() {
        return { amount: 5, recipientAlias: 'attacker', purpose: 'invoice' };
      },
    };
    await expect(proposalFromModel('pay it', context, wrongRecipient)).rejects.toThrow(
      /outside the allow-list/,
    );
  });
});
