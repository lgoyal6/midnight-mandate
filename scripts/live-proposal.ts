import { ZeroExtractionModel } from '../src/agent/zero-extractor.js';
import { proposalFromModel } from '../src/agent/model.js';
import { publicProposalProjection } from '../src/agent/proposal.js';

function arg(name: string): string {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`missing --${name}`);
  return value;
}

const instruction = arg('instruction');
const proposal = await proposalFromModel(
  instruction,
  {
    networkId: 'undeployed',
    contractAddress: arg('contract'),
    tokenColor: arg('color'),
    recipients: { vendor: arg('recipient') },
  },
  new ZeroExtractionModel(),
);

console.log('MIDNIGHT_MANDATE_LIVE_AI_PROPOSAL_PASS');
console.log(
  JSON.stringify(
    {
      provider: 'Zero schema-guided LLM extraction',
      instruction,
      proposal,
      publicProjection: publicProposalProjection(proposal),
    },
    null,
    2,
  ),
);
