# Threat model

## Protected assets and properties

- Test NIGHT held by the contract.
- Secrecy of the policy secret, cap, and preconfigured recipient before execution.
- Integrity of amount, recipient, request commitment, nonce, network, and contract binding.
- Atomicity between authorization and settlement.
- Honest demo evidence: no mock may appear as a proof or payment.

## Trust assumptions

- Compact compiler/runtime, Midnight node/indexer/proof semantics, and pinned vendor packages behave as documented.
- The local proving runtime is trusted with policy witnesses.
- The owner's machine and test-wallet secret are not compromised.
- Unshielded settlement is intentionally public.

## Adversaries and mitigations

### Hallucinating or malicious model

**Attempt:** invent a recipient, unsafe amount, extra transaction field, network, or contract.

**Mitigation:** model output has exactly three fields. Recipient is an alias resolved through a deterministic allow-list. All authority-bearing values are filled locally; strict validation rejects unknown/malformed/unsafe fields.

### Confused-deputy proposal

**Attempt:** replay a valid-looking proposal against another network or contract.

**Mitigation:** `proposalToMandatePayment` verifies explicit network and contract binding against the active client before conversion.

### Policy bypass

**Attempt:** call a wallet transfer without the policy circuit.

**Mitigation:** the agent does not hold the vault wallet. Funds are contract-custodied, and the only agent-facing payout path is `agent_pay`.

### Amount/recipient substitution

**Attempt:** prove one request but settle another.

**Mitigation:** the exact circuit arguments checked against policy are passed directly to `sendUnshielded` in the same circuit.

### Replay

**Attempt:** reuse a previously successful proposal/nonce.

**Mitigation:** the circuit derives a domain-separated nullifier, checks non-membership, and inserts it atomically. Replay tests verify unchanged balances/counters.

### Wrong private opening

**Attempt:** delegated runtime supplies a different secret/cap/recipient.

**Mitigation:** the circuit recomputes the full domain-separated policy commitment and requires equality with the constructor value.

### UI data leak

**Attempt:** recover private fields from a supposedly public view through response inspection or CSS-hidden DOM.

**Mitigation:** `/observer` requests a distinct public-only endpoint. Private values are absent from its payload and DOM by construction.

### Concurrent UI operations

**Attempt:** double-click/race proof operations and create inconsistent demo state.

**Mitigation:** the local API serializes all mutating operations; contract nullifiers remain the on-chain replay authority.

### Provider/model outage

**Attempt/result:** external model fails, rate-limits, or returns malformed JSON.

**Mitigation:** adapter fails closed. The deterministic proposal path and cryptographic demo remain available. A model outage cannot generate a transaction.

### Secret exposure

**Attempt:** commit or log mnemonics/seeds/API credentials.

**Mitigation:** `.env*` is ignored except `.env.example`; wallet logs contain no derived seed prefix; evidence files are sanitized; `yarn secret:scan` checks common key material.

## Accepted prototype risks

- Prototype contract custody is unaudited and restricted to test assets.
- An authorized agent can submit many fresh compliant payments until the deposited public budget is exhausted.
- No hidden cumulative budget, expiry, revocation, policy rotation, recovery, or multisig.
- Contract policy is immutable; changing it requires redeployment.
- The delegated runtime knows the policy.
- Public unshielded settlement leaks amount and recipient.
- A denial can occur during local circuit simulation without producing a public failed transaction receipt.

## Roadmap mitigations

- Hidden cumulative/epoch budgets and expiry.
- Owner-secret authenticated revoke/withdraw/rotation.
- Merchant-set membership rather than one fixed recipient.
- Shielded outgoing settlement.
- Sponsored DUST and walletless agent execution.
- Audited custody, recovery, multisig, and key rotation.
- Selective audit proofs and scoped disclosure.
