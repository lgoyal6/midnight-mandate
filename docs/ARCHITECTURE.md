# Architecture

## Security objective

Midnight Mandate must make one statement causally true:

> A contract-held payment executes only when the exact amount, recipient, and cumulative spend satisfy a private committed mandate.

An off-chain pass/fail attestation is insufficient. Authorization and settlement happen inside the same `agent_pay` Compact transaction.

## Components

### Compact contract

[`contracts/mandate.compact`](../contracts/mandate.compact) stores only:

- `policy_commitment` — opaque commitment to secret, per-payment cap, cumulative cap, and allowed recipient;
- `owner_commitment` — opaque commitment to a distinct recovery secret;
- `active` — permanent open/closed state;
- `has_vault_color` and `vault_color` — constrain custody to one public token color so recovery can empty it exactly;
- `used_nullifiers` — replay-prevention set;
- `payment_receipts` — nullifier-to-request-hash mapping;
- `payment_count` — successful-payment counter;
- `cumulative_spend` — public running total of already-public successful amounts;
- `night_balances` — public mirror of unshielded contract custody.

It exposes three impure circuits:

- `deposit_night(color, amount)` receives unshielded NIGHT and credits the vault.
- `agent_pay(color, amount, recipient, request_commitment, nonce)` validates the private policy, rejects replay, debits the vault, records a receipt, and sends the exact checked values.
- `close_vault(color, amount, recipient)` proves the distinct owner opening, returns the exact full remaining balance, and permanently disables deposits and payments.

The constructor receives the policy and owner commitments. Neither opening is a ledger field.

### Private-state witnesses

[`src/witnesses.ts`](../src/witnesses.ts) supplies `policy_secret`, `max_per_payment`, `max_total_spend`, `allowed_recipient`, and the distinct `owner_secret` from the local private-state provider during proof generation. A secure circuit constrains each witness; it never treats witness data as trusted merely because it is private. The prototype keeps both roles in one trusted runtime; separating their storage/processes is future hardening.

### Typed proposal boundary

[`src/agent/proposal.ts`](../src/agent/proposal.ts) defines `PaymentProposalV1` and enforces:

- exact field set—unknown and missing fields reject;
- 32-byte addresses, colors, hashes, and nonces;
- canonical positive base-10 amounts within `Uint<128>`;
- a request hash that commits to the normalized purpose;
- explicit network and contract binding before client conversion.

[`src/agent/model.ts`](../src/agent/model.ts) lets a model select only amount, recipient alias, and purpose. The alias must exist in the local allow-list. Code fills every authority-bearing field.

### Midnight client

[`src/client.ts`](../src/client.ts) owns deploy, inspect, deposit, and pay operations. Both deterministic and live-model proposals enter the same `proposalToMandatePayment` conversion and the same `MandateClient.pay` method.

### Demo API and UI

[`src/demo-session.ts`](../src/demo-session.ts) maintains one local event-window demo session:

1. build/sync test wallets;
2. deploy a committed policy;
3. deposit 50 NIGHT;
4. produce a typed proposal;
5. submit real payment or attack calls;
6. assert exact before/after balances and state.

[`src/demo-server.ts`](../src/demo-server.ts) serializes mutations so concurrent browser clicks cannot race proof operations. The React command center calls this API; it never duplicates policy logic.

The isolated `/api/observer` endpoint returns a dedicated public projection. `/observer` never requests owner or agent state.

## Transaction flow

### Deploy

1. Owner generates independent random policy and owner-recovery secrets.
2. Compiled pure circuits derive a policy commitment from its secret, both caps, and canonical recipient bytes, plus a separately domain-separated owner commitment.
3. The constructor stores only those commitments and initializes the vault as active.

### Deposit

1. Owner submits unshielded color and amount.
2. `receiveUnshielded` transfers value to the contract.
3. The contract credits its public balance mirror.
4. The first deposit fixes the only accepted public token color; a second color rejects.

### Agent payment

1. Natural language becomes a strict `PaymentProposalV1`.
2. The client verifies network/contract binding and converts exact values to circuit types.
3. Witnesses provide the private policy opening locally.
4. `agent_pay` recomputes the commitment.
5. It checks allowed recipient, positive amount, private per-payment cap, private cumulative ceiling, unused nonce, and vault balance.
6. It inserts the nullifier/receipt, advances cumulative spend, and debits the mirror.
7. It calls `sendUnshielded` with the same amount/recipient.
8. Midnight transaction semantics commit everything together or reject everything.
9. The client waits for indexer confirmation and an exact recipient balance delta.

### Owner close

1. The owner supplies the distinct recovery-secret witness plus the public color, exact full balance, and recovery address.
2. `close_vault` recomputes the owner commitment, requires the one accepted color and exact full remaining balance, and debits it.
3. The same call sets `active = false` and sends the full balance unshielded.
4. Subsequent deposits and payments reject. Historical receipts, counters, and cumulative spend remain public and unchanged.

## Failure flow

Over-cap, cumulative-budget, wrong-recipient, wrong-opening, wrong-owner, wrong-color, zero, insufficient-balance, replay, and post-close failures occur before a successful transaction. Tests snapshot vault balance, cumulative spend, payment count, active state, nullifier/receipt sizes, and recipient balance; every required rejection must leave them unchanged.

## Network strategy

- `undeployed` local stack is the mandatory deterministic baseline.
- Preprod uses the same compiled contract/client path and a local proof server.
- No mainnet or valuable assets.

The Preprod runner refuses to initialize a wallet unless exactly one test-only secret is explicitly supplied. See [`PREPROD.md`](PREPROD.md).
