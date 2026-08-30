import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export {
  Contract,
  ledger,
  pureCircuits,
  type Ledger,
  type Witnesses,
} from './managed/mandate/contract/index.js';
import { Contract } from './managed/mandate/contract/index.js';
import { makeWitnesses } from '../src/witnesses.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
export const zkConfigPath = path.resolve(currentDir, 'managed', 'mandate');

export const CompiledMandateContract = CompiledContract.make(
  'MidnightMandate',
  Contract,
).pipe(
  CompiledContract.withWitnesses(makeWitnesses()),
  CompiledContract.withCompiledFileAssets(zkConfigPath),
);

