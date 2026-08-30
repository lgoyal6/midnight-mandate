# Privacy boundary

## Exact claim

Midnight Mandate provides **private mandate rules with public unshielded settlement**.

It does not provide private payments. After a successful payment, chain observers can see the amount, recipient, contract, circuit, timing, commitment/nullifier/receipt data, and public state transition.

## Who learns what

| Actor | Learns |
| --- | --- |
| Owner | Full policy, instruction, proposal, and transaction result |
| Delegated proving runtime | Witness values: secret, both caps, and allowed recipient |
| Model provider | Natural-language instruction, allowed recipient aliases, and extraction schema only |
| Midnight proof server | Proof request/private preimage; therefore it should remain local or controlled |
| Public ledger/indexer | Commitment, nullifiers, receipts, counters, cumulative successful spend, custody balance, and successful unshielded settlement |
| Isolated `/observer` route | Only the dedicated public API projection |

The model never receives the policy secret, raw allowed address, wallet material, or transaction method.

## Data by field

| Field | Storage | Disclosure behavior |
| --- | --- | --- |
| `policySecret` | Local private state | Never serialized to UI/API/ledger |
| `maxPerPayment` | Local private state | Owner view only; constrained in proof |
| `maxTotalSpend` | Local private state | Owner view only; constrained against public running spend in proof |
| `cumulative_spend` | Ledger | Public running sum; reveals no more than the already-public successful amounts |
| `allowedRecipient` | Local private state | Owner view only before payment; executed recipient later public |
| `policy_commitment` | Ledger | Public opaque value |
| `purpose` | Agent/owner UI | Not sent on-chain |
| `requestHash` | Proposal and ledger receipt | Public; binds normalized purpose without revealing it |
| `nonce` | Proposal | Nullifier derived and disclosed; raw nonce stays client-side |
| Successful amount/recipient | Transaction | Public due to `sendUnshielded` |

## Observer isolation evidence

The first UI implementation rendered an observer subset from a combined owner/observer response. That was rejected during pressure testing because DevTools could still recover owner fields.

The final structure uses `/api/observer`, which returns only:

- network and contract address;
- policy commitment;
- public vault balance;
- successful-payment/nullifier/receipt counts;
- cumulative successful spend;
- vendor's public unshielded balance;
- public deployment/payment events.

A response scan rejected the keys `maxPerPayment`, `maxTotalSpend`, `remainingPrivateBudget`, `allowedRecipient`, `policySecret`, `instruction`, `proposal`, and `attacks`. Browser verification also confirmed that the observer DOM contains neither private-cap display, private remaining allowance, preset address, nor invoice text. It intentionally shows `cumulativeSpend`, which is public state derived from public settlements.

## Inference limitations

- A successful payment reveals that the hidden cap is at least the paid amount.
- Repeated payments can reveal behavioral patterns and lower bounds.
- A rejected aggregate attempt produces no public failed transaction in this local client flow, so it does not reveal the hidden total ceiling to outside observers.
- A single-recipient vault eventually reveals that recipient after its first successful payment.
- Payment count and timing are public.
- Local endpoint isolation does not protect a compromised owner machine.

## Operational rules

- Keep the proof server local for this prototype.
- Never log private state, wallet material, or full proof preimages.
- Never paste a mnemonic/seed into chat or commit it.
- Use `/observer` when demonstrating what an outside observer can actually learn.
- Say “private mandate,” not “private payment.”
