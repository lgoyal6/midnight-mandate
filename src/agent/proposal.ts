import { createHash } from 'node:crypto';
import type { MandatePayment } from '../client.js';
import { bytesToHex, hexToBytes } from '../wallet/hex.js';

const UINT128_MAX = (1n << 128n) - 1n;
const HEX_32 = /^(?:0x)?[0-9a-fA-F]{64}$/;
const NETWORK_ID = /^(?:undeployed|preview|preprod)$/;

export type PaymentProposalV1 = {
  version: 1;
  networkId: 'undeployed' | 'preview' | 'preprod';
  contractAddress: string;
  tokenColor: string;
  amount: string;
  recipient: string;
  purpose: string;
  requestHash: string;
  nonce: string;
};

export type NewPaymentProposal = Omit<PaymentProposalV1, 'version' | 'amount' | 'requestHash'> & {
  amount: bigint;
};

export type ProposalBinding = {
  networkId: PaymentProposalV1['networkId'];
  contractAddress: string;
};

const PROPOSAL_KEYS = [
  'version',
  'networkId',
  'contractAddress',
  'tokenColor',
  'amount',
  'recipient',
  'purpose',
  'requestHash',
  'nonce',
] as const;

function assertRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object`);
  }
}

function assertExactKeys(value: Record<string, unknown>): void {
  const expected = [...PROPOSAL_KEYS].sort();
  const actual = Object.keys(value).sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    const unknown = actual.filter((key) => !expected.includes(key as (typeof PROPOSAL_KEYS)[number]));
    const missing = expected.filter((key) => !actual.includes(key));
    throw new Error(
      `proposal fields must match PaymentProposalV1 exactly; missing=${missing.join(',') || 'none'} unknown=${unknown.join(',') || 'none'}`,
    );
  }
}

function normalizeBytes32(value: unknown, label: string): string {
  if (typeof value !== 'string' || !HEX_32.test(value)) {
    throw new Error(`${label} must be exactly 32 bytes of hexadecimal`);
  }
  return value.replace(/^0x/, '').toLowerCase();
}

function normalizeAmount(value: unknown): string {
  if (typeof value !== 'string' || !/^(?:0|[1-9][0-9]*)$/.test(value)) {
    throw new Error('amount must be a canonical base-10 integer string');
  }
  const amount = BigInt(value);
  if (amount <= 0n) throw new Error('amount must be positive');
  if (amount > UINT128_MAX) throw new Error('amount exceeds Compact Uint<128>');
  return amount.toString();
}

export function hashPurpose(purpose: string): string {
  const normalized = purpose.normalize('NFC').trim();
  if (normalized.length === 0 || normalized.length > 280) {
    throw new Error('purpose must contain 1-280 characters');
  }
  return createHash('sha256')
    .update('midnight-mandate:request:v1\0', 'utf8')
    .update(normalized, 'utf8')
    .digest('hex');
}

export function parsePaymentProposal(value: unknown): PaymentProposalV1 {
  assertRecord(value, 'proposal');
  assertExactKeys(value);

  if (value.version !== 1) throw new Error('version must equal 1');
  if (typeof value.networkId !== 'string' || !NETWORK_ID.test(value.networkId)) {
    throw new Error('networkId must be undeployed, preview, or preprod');
  }
  if (typeof value.purpose !== 'string') throw new Error('purpose must be a string');

  const purpose = value.purpose.normalize('NFC').trim();
  const proposal: PaymentProposalV1 = {
    version: 1,
    networkId: value.networkId as PaymentProposalV1['networkId'],
    contractAddress: normalizeBytes32(value.contractAddress, 'contractAddress'),
    tokenColor: normalizeBytes32(value.tokenColor, 'tokenColor'),
    amount: normalizeAmount(value.amount),
    recipient: normalizeBytes32(value.recipient, 'recipient'),
    purpose,
    requestHash: normalizeBytes32(value.requestHash, 'requestHash'),
    nonce: normalizeBytes32(value.nonce, 'nonce'),
  };

  const expectedHash = hashPurpose(proposal.purpose);
  if (proposal.requestHash !== expectedHash) {
    throw new Error('requestHash does not commit to the canonical purpose');
  }
  return proposal;
}

export function createPaymentProposal(input: NewPaymentProposal): PaymentProposalV1 {
  return parsePaymentProposal({
    version: 1,
    networkId: input.networkId,
    contractAddress: input.contractAddress,
    tokenColor: input.tokenColor,
    amount: input.amount.toString(),
    recipient: input.recipient,
    purpose: input.purpose,
    requestHash: hashPurpose(input.purpose),
    nonce: input.nonce,
  });
}

export function canonicalizeProposal(input: PaymentProposalV1): string {
  const proposal = parsePaymentProposal(input);
  return JSON.stringify({
    version: proposal.version,
    networkId: proposal.networkId,
    contractAddress: proposal.contractAddress,
    tokenColor: proposal.tokenColor,
    amount: proposal.amount,
    recipient: proposal.recipient,
    purpose: proposal.purpose,
    requestHash: proposal.requestHash,
    nonce: proposal.nonce,
  });
}

export function proposalToMandatePayment(
  input: PaymentProposalV1,
  expected?: ProposalBinding,
): MandatePayment {
  const proposal = parsePaymentProposal(input);
  if (expected) {
    const contractAddress = normalizeBytes32(expected.contractAddress, 'expected contractAddress');
    if (proposal.networkId !== expected.networkId) {
      throw new Error('proposal network does not match the active client');
    }
    if (proposal.contractAddress !== contractAddress) {
      throw new Error('proposal contract does not match the active client');
    }
  }
  return {
    color: hexToBytes(proposal.tokenColor),
    amount: BigInt(proposal.amount),
    recipient: hexToBytes(proposal.recipient),
    requestCommitment: hexToBytes(proposal.requestHash),
    nonce: hexToBytes(proposal.nonce),
  };
}

export function publicProposalProjection(input: PaymentProposalV1): Omit<PaymentProposalV1, 'purpose'> {
  const { purpose: _purpose, ...publicFields } = parsePaymentProposal(input);
  return publicFields;
}

export function proposalFingerprint(input: PaymentProposalV1): string {
  return bytesToHex(createHash('sha256').update(canonicalizeProposal(input)).digest());
}
