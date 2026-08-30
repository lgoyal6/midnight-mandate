import { deployContract, submitCallTx } from '@midnight-ntwrk/midnight-js-contracts';
import type { ContractAddress } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import {
  CompiledMandateContract,
  type Contract,
  ledger,
} from '../contracts/index.js';
import { ownerCommitment, policyCommitment } from './contract.js';
import type { MandateProviders } from './providers.js';
import { privateStateFromPolicy } from './witnesses.js';

export type PrivateMandate = {
  policySecret: Uint8Array;
  maxPerPayment: bigint;
  maxTotalSpend: bigint;
  allowedRecipient: Uint8Array;
  ownerSecret: Uint8Array;
};

export type MandatePayment = {
  color: Uint8Array;
  amount: bigint;
  recipient: Uint8Array;
  requestCommitment: Uint8Array;
  nonce: Uint8Array;
};

export type Deployment = {
  client: MandateClient;
  deploymentTxId: string;
};

export function transactionId(result: any): string {
  const value = result?.public?.txId ?? result?.public?.transactionHash;
  if (!value) throw new Error('transaction result did not include a transaction id');
  return String(value);
}

export class MandateClient {
  private constructor(
    readonly providers: MandateProviders,
    readonly privateStateId: string,
    readonly contractAddress: ContractAddress,
  ) {}

  static async deploy(
    providers: MandateProviders,
    privateStateId: string,
    mandate: PrivateMandate,
  ): Promise<Deployment> {
    const commitment = policyCommitment(
      mandate.policySecret,
      mandate.maxPerPayment,
      mandate.maxTotalSpend,
      mandate.allowedRecipient,
    );
    const deployed = await deployContract<Contract>(providers, {
      compiledContract: CompiledMandateContract,
      privateStateId,
      initialPrivateState: privateStateFromPolicy(mandate),
      args: [commitment, ownerCommitment(mandate.ownerSecret)],
    });
    const contractAddress = deployed.deployTxData.public.contractAddress;
    return {
      client: new MandateClient(providers, privateStateId, contractAddress),
      deploymentTxId: transactionId(deployed.deployTxData),
    };
  }

  async inspect(): Promise<ReturnType<typeof ledger>> {
    const state = await this.providers.publicDataProvider.queryContractState(
      this.contractAddress,
    );
    if (!state) throw new Error(`contract ${this.contractAddress} was not indexed`);
    return ledger(state.data);
  }

  async deposit(color: Uint8Array, amount: bigint): Promise<string> {
    const result = await submitCallTx<Contract, 'deposit_night'>(this.providers, {
      compiledContract: CompiledMandateContract,
      contractAddress: this.contractAddress,
      privateStateId: this.privateStateId,
      circuitId: 'deposit_night',
      args: [color, amount],
    });
    return transactionId(result);
  }

  async pay(payment: MandatePayment): Promise<string> {
    const result = await submitCallTx<Contract, 'agent_pay'>(this.providers, {
      compiledContract: CompiledMandateContract,
      contractAddress: this.contractAddress,
      privateStateId: this.privateStateId,
      circuitId: 'agent_pay',
      args: [
        payment.color,
        payment.amount,
        { bytes: payment.recipient },
        payment.requestCommitment,
        payment.nonce,
      ],
    });
    return transactionId(result);
  }

  async closeVault(
    color: Uint8Array,
    amount: bigint,
    recipient: Uint8Array,
  ): Promise<string> {
    const result = await submitCallTx<Contract, 'close_vault'>(this.providers, {
      compiledContract: CompiledMandateContract,
      contractAddress: this.contractAddress,
      privateStateId: this.privateStateId,
      circuitId: 'close_vault',
      args: [color, amount, { bytes: recipient }],
    });
    return transactionId(result);
  }
}
