import { randomBytes32, bytesToHex } from '../wallet/hex.js';
import {
  createPaymentProposal,
  type PaymentProposalV1,
} from './proposal.js';

export type ExtractedPaymentIntent = {
  amount: bigint;
  recipientAlias: string;
  purpose: string;
};

export type ProposalContext = {
  networkId: PaymentProposalV1['networkId'];
  contractAddress: string;
  tokenColor: string;
  recipients: Readonly<Record<string, string>>;
  nonce?: string;
};

export interface PaymentIntentModel {
  readonly name: string;
  extract(instruction: string, allowedAliases: readonly string[]): Promise<unknown>;
}

const INTENT_KEYS = ['amount', 'recipientAlias', 'purpose'] as const;

function parseModelAmount(value: unknown): bigint {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      throw new Error('model amount must be a safe integer');
    }
    value = value.toString();
  }
  if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value)) {
    throw new Error('model amount must be a positive base-10 integer');
  }
  return BigInt(value);
}

export function parseExtractedIntent(
  value: unknown,
  allowedAliases: readonly string[],
): ExtractedPaymentIntent {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('model output must be a JSON object');
  }
  const record = value as Record<string, unknown>;
  const actual = Object.keys(record).sort();
  const expected = [...INTENT_KEYS].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error('model output must contain exactly amount, recipientAlias, and purpose');
  }
  if (typeof record.recipientAlias !== 'string' || !allowedAliases.includes(record.recipientAlias)) {
    throw new Error('model selected a recipient alias outside the allow-list');
  }
  if (typeof record.purpose !== 'string') throw new Error('model purpose must be a string');
  const purpose = record.purpose.normalize('NFC').trim();
  if (purpose.length === 0 || purpose.length > 280) {
    throw new Error('model purpose must contain 1-280 characters');
  }
  return {
    amount: parseModelAmount(record.amount),
    recipientAlias: record.recipientAlias,
    purpose,
  };
}

export async function proposalFromModel(
  instruction: string,
  context: ProposalContext,
  model: PaymentIntentModel,
): Promise<PaymentProposalV1> {
  const normalizedInstruction = instruction.normalize('NFC').trim();
  if (normalizedInstruction.length === 0 || normalizedInstruction.length > 1_000) {
    throw new Error('instruction must contain 1-1000 characters');
  }
  const aliases = Object.keys(context.recipients).sort();
  if (aliases.length === 0) throw new Error('at least one recipient alias is required');

  const intent = parseExtractedIntent(
    await model.extract(normalizedInstruction, aliases),
    aliases,
  );
  const recipient = context.recipients[intent.recipientAlias];
  if (!recipient) throw new Error('resolved recipient alias is missing');

  return createPaymentProposal({
    networkId: context.networkId,
    contractAddress: context.contractAddress,
    tokenColor: context.tokenColor,
    amount: intent.amount,
    recipient,
    purpose: intent.purpose,
    nonce: context.nonce ?? bytesToHex(randomBytes32()),
  });
}

export class FixturePaymentIntentModel implements PaymentIntentModel {
  readonly name = 'deterministic-fixture';

  async extract(instruction: string, allowedAliases: readonly string[]): Promise<unknown> {
    const match = /^pay ([1-9][0-9]*) night to ([a-z][a-z0-9_-]{0,31}) for (.+)$/i.exec(
      instruction.trim(),
    );
    if (!match) {
      throw new Error('fixture instruction must match: Pay <amount> NIGHT to <alias> for <purpose>');
    }
    const alias = match[2]!.toLowerCase();
    if (!allowedAliases.includes(alias)) throw new Error('fixture recipient alias is not allowed');
    return {
      amount: match[1]!,
      recipientAlias: alias,
      purpose: match[3]!.trim(),
    };
  }
}
