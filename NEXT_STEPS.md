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

For the real local proof/payment path, also install the pinned Compact toolchain and Docker services from [`docs/REPRODUCE.md`](docs/REPRODUCE.md), then run:

```bash
yarn demo:smoke
```

## What is already verified

- Private per-payment cap, cumulative ceiling, recipient, and policy secret are bound into one Compact commitment.
- One real local transaction paid 5 NIGHT from contract custody and advanced public cumulative spend to 5.
- Four real adversarial calls reject with zero movement: over-cap, cumulative-budget, wrong-recipient, and replay.
- The aggregate case is deliberately nontrivial: after spending 5, a fresh 8 is below the 10-per-payment cap but exceeds the hidden total of 12.
- The isolated observer API/DOM exposes public cumulative spend but not the private ceiling or remaining allowance.
- `yarn verify` covers Compact compile, 11 contract tests, 12 proposal tests, both TypeScript builds, production web build, and secret scan.

## Best parallel next steps

### 1. Demo and submission owner — highest urgency

- Rehearse [`docs/DEMO.md`](docs/DEMO.md) and [`SUBMISSION.md`](SUBMISSION.md).
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
- Look specifically for overflow, locked-fund, stale-private-state, and concurrent fresh-nonce edge cases.
- Add a failing test before changing contract behavior.

### 4. UI/demo reviewer

- Run `yarn demo:ui` and execute the full four-attack flow.
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

## Current honest limitations

- Settlement is unshielded and public.
- The cumulative ceiling is lifetime-only; there is no epoch/day reset.
- Deposits above the cumulative ceiling can become locked because owner withdrawal is not implemented.
- Policy rotation, revocation, expiry, recovery, multisig, and shielded payout are not implemented.
- Local devnet is the verified baseline; Preprod remains wallet-gated.
