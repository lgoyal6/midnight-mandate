# Teammate handoff and next steps

This repository is being built during the Midnight Hackathon event window. Pull from `main` before starting, create a short-lived branch, and keep every claim behind a reproducible check.

## Join the build

Direct collaborator:

```bash
git clone https://github.com/lgoyal6/midnight-mandate.git
cd midnight-mandate
```

Contributor without direct write access:

```bash
gh repo fork lgoyal6/midnight-mandate --clone
cd midnight-mandate
```

Then:

```bash
corepack enable
corepack prepare yarn@1.22.22 --activate
yarn install --frozen-lockfile
yarn verify
git switch -c teammate/<short-task-name>
```

Read [`SETUP.md`](SETUP.md) first. It contains the pinned Compact/Docker setup, every encountered environment error, the optional Preprod wallet step, and the acceptance command:

```bash
yarn demo:smoke
```

For product/track context, use [`RESEARCH.md`](RESEARCH.md). For the non-negotiable Devpost gate, use [`submission_req.md`](submission_req.md) and [`SUBMISSION.md`](SUBMISSION.md).

## What is already verified

- Private per-payment cap, cumulative ceiling, recipient, and policy secret are bound into one Compact commitment.
- One real local transaction paid 5 NIGHT from contract custody and advanced public cumulative spend to 5.
- Four real adversarial calls reject with zero movement: over-cap, cumulative-budget, wrong-recipient, and replay.
- A separately committed owner secret recovered the remaining 45, set the vault balance to zero, and permanently closed deposits and agent payments.
- The aggregate case is deliberately nontrivial: after spending 5, a fresh 8 is below the 10-per-payment cap but exceeds the hidden total of 12.
- The isolated observer API/DOM exposes public cumulative spend but not the private ceiling or remaining allowance.
- `yarn verify` covers Compact compile, 17 contract tests, 12 proposal tests, both TypeScript builds, production web build, and secret scan.

## Best parallel next steps

### 1. Demo and submission owner — highest urgency

- Rehearse [`docs/DEMO.md`](docs/DEMO.md) and [`SUBMISSION.md`](SUBMISSION.md).
- Read [`evidence/demo-rehearsal.json`](evidence/demo-rehearsal.json): initialize before recording. The measured cold-start take was 137.2 seconds; the initialized real flow was 34.5 seconds.
- Complete the operator self-test in [`docs/DEMO.md`](docs/DEMO.md). The second observer window now refreshes automatically after payment and recovery; do not accept stale values or manually reload during the test.
- Record a new video during the event; keep it at or below two minutes and say “Midnight Hackathon: August 2026” at the beginning.
- Show the valid 5 payment, then the 11 per-payment rejection and fresh 8 cumulative rejection.
- Verify the public repository and video in a signed-out browser before Devpost submission.

No code change is required for this lane. Do not claim Preprod, mainnet, private settlement, production custody, or ZK-proved LLM reasoning.

### 2. Preprod owner — independent network lane

- Use a test-only wallet you control; never share its seed in chat or commit it.
- Follow [`docs/PREPROD.md`](docs/PREPROD.md).
- Run `yarn test:preprod` and retain public contract/payment identifiers only if it prints `MIDNIGHT_MANDATE_PREPROD_PASS`.
- If it fails, preserve the sanitized error and leave the local claim unchanged.

### 3. Policy/security reviewer

- Review [`contracts/mandate.compact`](contracts/mandate.compact) and [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md).
- Check that every ledger mutation on a denied aggregate request rolls back.
- Look specifically for overflow, owner/prover authority separation, lost-owner-key, stale-private-state, and concurrent fresh-nonce edge cases.
- Add a failing test before changing contract behavior.

### 4. UI/demo reviewer

- Run `yarn demo:ui` and execute the full four-attack flow.
- After all four reject, select **Recover 45 & close** and confirm the owner view and `/observer` both show balance `0` and lifecycle `closed`.
- Inspect `/observer` and its network payload for private fields.
- Improve legibility or recording flow only; do not add a mock success path.

## Integration rules

1. Do not import pre-event project code. Vendor examples are allowed only with attribution in [`UPSTREAM.md`](UPSTREAM.md).
2. Never commit wallet state, seeds, mnemonics, `.env` values, API keys, or raw proof preimages.
3. Do not reimplement the policy in React or treat a TypeScript check as contract evidence.
4. Run `yarn verify` before every push. Run `yarn demo:smoke` for any contract, witness, client, wallet, or provider change.
5. Push branches normally; do not force-push `main`.
6. In the PR/handoff, include the exact command run and transaction/rejection evidence when relevant.
7. Wait for the public `Verify` workflow to pass before merging; it independently installs the pinned Compact launcher/compiler and reruns the full non-Docker gate on Linux.
8. Treat `/api/close-vault` as a local owner-console demo endpoint, not production authentication. Do not expose this server to an untrusted network.

## Current honest limitations

- Settlement is unshielded and public.
- The cumulative ceiling is lifetime-only; there is no epoch/day reset.
- Recovery is all-or-nothing and permanently closes the vault; there is no partial withdrawal or reopen.
- Policy rotation, owner-key rotation/guardians, expiry, multisig, and shielded payout are not implemented.
- Policy and owner secrets currently share one trusted local private-state runtime, so the prototype has cryptographic key separation but not process isolation.
- Loss of the owner secret makes recovery unavailable.
- Local devnet is the verified baseline; Preprod remains wallet-gated.
