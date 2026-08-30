import {
  createCircuitContext,
  createConstructorContext,
  sampleContractAddress,
  type CircuitContext,
} from '@midnight-ntwrk/compact-runtime';
import {
  Contract,
  ledger,
  ownerCommitment,
  policyCommitment,
  type Ledger,
} from './contract.js';
import {
  makeWitnesses,
  privateStateFromPolicy,
  type MandatePrivateState,
} from './witnesses.js';

const COIN_PUBLIC_KEY = '00'.repeat(32);

export interface Policy {
  policySecret: Uint8Array;
  maxPerPayment: bigint;
  maxTotalSpend: bigint;
  allowedRecipient: Uint8Array;
  ownerSecret: Uint8Array;
}

export class MandateSimulator {
  readonly contract: any;
  readonly address = sampleContractAddress();
  ctx: CircuitContext<MandatePrivateState>;

  constructor(policy: Policy) {
    this.contract = new (Contract as any)(makeWitnesses());
    const constructorContext = createConstructorContext(
      privateStateFromPolicy(policy),
      COIN_PUBLIC_KEY,
    );
    const initial = this.contract.initialState(
      constructorContext,
      policyCommitment(
        policy.policySecret,
        policy.maxPerPayment,
        policy.maxTotalSpend,
        policy.allowedRecipient,
      ),
      ownerCommitment(policy.ownerSecret),
    );
    this.ctx = createCircuitContext(
      this.address,
      initial.currentZswapLocalState,
      initial.currentContractState,
      initial.currentPrivateState,
    );
  }

  as(policy: Policy): this {
    this.ctx = { ...this.ctx, currentPrivateState: privateStateFromPolicy(policy) };
    return this;
  }

  call(circuit: string, ...args: unknown[]): unknown {
    const result = this.contract.impureCircuits[circuit](this.ctx, ...args);
    this.ctx = result.context;
    return result.result;
  }

  ledger(): Ledger {
    return ledger(this.ctx.currentQueryContext.state);
  }
}
