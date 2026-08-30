import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { PaymentIntentModel } from './model.js';

const execFileAsync = promisify(execFile);
const CAPABILITY = 'relaystation-llm-extract-3f700fa6';
const ENDPOINT = 'https://api.relaystation.ai/v1/llm/extract';

type ZeroEnvelope = {
  ok?: boolean;
  body?: {
    result?: unknown;
    truncated?: unknown;
  };
  diagnostics?: {
    failureCode?: unknown;
  };
};

export class ZeroExtractionModel implements PaymentIntentModel {
  readonly name = 'zero-json-extractor';

  constructor(
    private readonly binary = process.env.ZERO_RUNNER || 'zero',
    private readonly maxPay = '0.02',
  ) {}

  async extract(instruction: string, allowedAliases: readonly string[]): Promise<unknown> {
    const schema = {
        type: 'object',
        additionalProperties: false,
        required: ['amount', 'recipientAlias', 'purpose'],
        properties: {
          amount: { type: 'integer', minimum: 1 },
          recipientAlias: { type: 'string', enum: [...allowedAliases] },
          purpose: { type: 'string', minLength: 1, maxLength: 280 },
        },
    };
    const request = {
      tier: 'budget',
      input: instruction,
      params: { schema: JSON.stringify(schema) },
    };
    const { stdout } = await execFileAsync(
      this.binary,
      [
        'fetch',
        '--json',
        '--timeout',
        '60',
        '--max-pay',
        this.maxPay,
        '--capability',
        CAPABILITY,
        ENDPOINT,
        '-d',
        JSON.stringify(request),
      ],
      { timeout: 90_000, maxBuffer: 2 * 1024 * 1024 },
    );
    const envelope = JSON.parse(stdout) as ZeroEnvelope;
    if (
      !envelope.ok ||
      !envelope.body ||
      envelope.body.truncated === true ||
      typeof envelope.body.result !== 'string'
    ) {
      throw new Error(
        `Zero extraction failed${envelope.diagnostics?.failureCode ? `: ${String(envelope.diagnostics.failureCode)}` : ''}`,
      );
    }
    return JSON.parse(envelope.body.result) as unknown;
  }
}
