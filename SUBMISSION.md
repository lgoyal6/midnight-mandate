# Midnight Mandate — Submission Packet

This file is the source of truth for the final Devpost entry and two-minute video. Replace only the bracketed team/link placeholders. Do not upgrade a local-devnet claim to Preprod unless `yarn test:preprod` has printed `MIDNIGHT_MANDATE_PREPROD_PASS` and produced public identifiers.

## Submission identity

- **Project:** Midnight Mandate
- **Tagline:** Private spending rules. Atomic agent payments.
- **Primary track:** AI
- **Repository:** `https://github.com/lgoyal6/midnight-mandate`
- **Demo video:** `[PUBLIC_VIDEO_URL]`
- **Team:** `[TEAM_MEMBER_NAMES_AND_DISCORD_IDS]`

## Short description

Midnight Mandate is a contract-custodied NIGHT vault for AI-agent payments. An agent can propose a payment, but one Compact circuit releases funds only when the exact amount and recipient satisfy a privately committed mandate. The rule stays private; the prototype's unshielded settlement remains public.

## What it does

An owner privately configures a maximum per-payment amount, a lifetime cumulative ceiling, and one approved recipient, then deposits test NIGHT into a Compact contract. The public ledger receives only a commitment to that policy.

An AI adapter turns a natural-language instruction into a tightly constrained proposal: amount, allow-listed recipient alias, and purpose. Deterministic code—not the model—selects the actual address, network, contract, token color, nonce, and request hash.

When the agent requests payment, `agent_pay` opens the committed policy through private witnesses, verifies both caps and the recipient, checks a replay nullifier and vault balance, and sends the exact checked amount to the checked recipient in the same transaction. An over-cap, cumulative-budget, wrong-recipient, replayed, malformed, or underfunded request fails without moving funds or advancing contract state. A separate owner-secret proof can recover the entire remaining balance and permanently close the vault.

## How we built it

- Compact `0.31.1` contract with private policy/owner witnesses, public commitments, replay nullifiers, receipts, owner-authenticated close, and contract-held unshielded NIGHT.
- Midnight.js wallet, proof-server, indexer, node, and contract providers for deployment, funding, proving, submission, and authoritative balance observation.
- A strict TypeScript `PaymentProposalV1` boundary plus deterministic and optional schema-guided AI extraction paths.
- A React/Vite command center with separate owner, agent, and public-observer experiences, including the real owner recovery lifecycle. The `/observer` route uses a separate public-only API projection.
- Simulator, proposal, local integration, browser, privacy-projection, dependency-audit, secret-scan, and fresh-clone reproducibility checks.

## Why Midnight

This product needs privacy and enforcement at the same time. A normal server can conceal the spending rule but can bypass it. A transparent contract can enforce the rule but exposes it. Midnight lets the vault verify a private rule and make that verification causally control the payment.

The prototype deliberately does not claim private settlement: successful amount and recipient are visible because the payment uses unshielded NIGHT. What stays hidden from the public is the mandate before and between uses.

## Verified evidence

- Compact simulator: 17/17 tests passed.
- Proposal authority boundary: 12/12 tests passed.
- Live AI extraction: a current paid schema-guided call returned the exact allowed three-field proposal in 5.2 seconds; the deterministic adapter remains the recording-safe path.
- Real local proof/payment: vault `50 → 45`, vendor `+5`.
- Exact receipt binding: the indexed public receipt map contains the consumed nullifier and maps it to the successful proposal's exact request hash.
- Real recovery: a distinct owner-secret proof returned the remaining `45`, left vault balance `0`, and set it permanently inactive.
- Browser recovery: the owner control stayed disabled until 4/4 rejection checks passed, then confirmed close transaction `00e768b67c3160dfba50b5c5182e85f629e5f046116fe5229789abbe053e305ac3`; the public observer showed `closed` without either secret.
- Two-window observer regression: the untouched public window automatically advanced from payment count `0`/vault `50` to `1`/`45`, then to vault `0`/`closed`; the response contained zero forbidden owner, proposal, instruction, or attack keys.
- Real negative paths: over-cap, cumulative-budget, wrong-recipient, replay, and post-close payment all rejected with unchanged balances and state.
- Fresh public-clone reproduction: frozen install, full verification, and the complete one-command payment/recovery smoke all passed from commit `33fb4b4`; its independent Linux CI gate also passed.
- Public-clone local transactions: payment `00899429e1988283d4b1580ed1e5135a4899a72d59bbd04ba1376e6d47f3f94648`; owner close `00b9ed3bffa711075165aa5bbc6f21402a46541270c1646864ef1f0eb2850b9cbe`.
- Preprod: network and runner verified, but no deployment is claimed without a team-owned funded test wallet.

The public repository contains machine-readable receipts in [`evidence/`](evidence/), the contract in [`contracts/mandate.compact`](contracts/mandate.compact), the security boundary in [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md), and upstream attribution in [`UPSTREAM.md`](UPSTREAM.md).

## Challenges

The hardest part was making the proof causal. A local policy check followed by a wallet call would still let a compromised agent bypass the rule. We instead made the contract hold the funds and perform `sendUnshielded` inside the same circuit call that checks the private opening.

Midnight's evolving package graph also exposed duplicate nominal runtime and ledger types. We pinned mutually compatible packages and kept a clean-clone gate. Wallet recipes required the unshielded keystore, and public-key bytes had to use the SDK's `UserAddress` representation before balance observation targeted the correct address.

Finally, a combined owner/observer response was visually private but not a real data boundary. We replaced it with an isolated public endpoint and DOM-tested it for forbidden private fields.

Pressure testing also exposed a custody failure: a private lifetime ceiling below the deposit could strand the excess. We added a separately committed owner secret, constrained the vault to one token color, and made recovery an exact full-balance close so no partial owner drain can masquerade as an agent payment.

## What we are proud of

- A confirmed proof is tied to a real balance-moving payment, not an advisory badge.
- Every judge-visible failure goes through the real contract path and asserts zero balance movement.
- Owner recovery is a proved contract path, not an admin mutation, and permanently disables new deposits and payments.
- The model cannot choose an arbitrary address, network, contract, color, nonce, or request hash.
- The README is reproducible from a fresh clone with one smoke command.
- Privacy claims explicitly distinguish a private mandate from public unshielded settlement.

## What we learned

Zero-knowledge is most useful here as a control boundary, not as decoration. The important design question was not only “can this rule be proved privately?” but “does the protected action become impossible unless that proof succeeds?”

We also learned that UI separation is not sufficient privacy evidence: the network payload and public projection must be separated and tested too.

## What's next

The next contract revision turns the lifetime cumulative ceiling into epoch/day budgets and adds expiry, policy/owner-key rotation, recovery guardians, dynamic private merchant sets, and shielded payout. The broader direction is a reusable private-mandate SDK: agents receive narrowly scoped capabilities for payments and tools without publishing a user's complete policy or receiving unrestricted wallet authority.

## Built with

Compact, Midnight Network, Midnight.js, TypeScript, Node.js, Docker, React, Vite, Vitest, and an optional schema-guided AI extractor through Zero.

## Two-minute video script

Target length: 1:50–1:55. The event name must be spoken before the product explanation.

### 0:00–0:10 — required opening

> Hi, we are [TEAM NAME], and this is Midnight Mandate, our project for Midnight Hackathon: August 2026. AI agents can propose payments, but their guardrails are usually public, bypassable, or disconnected from the wallet.

Show: title and the owner/agent/observer interface.

### 0:10–0:27 — private rule, public commitment

> The owner privately sets vendor A, ten per payment, and twelve total. The outside observer sees only a commitment. This version keeps the mandate private, while successful unshielded settlement and running spend are public.

Show: owner view, then `/observer`. Do not reveal any wallet seed or secret.

### 0:27–0:55 — real proposal, proof, and payment

> The agent proposes five test NIGHT for a data job. The AI can suggest only amount, an approved alias, and purpose. Deterministic code binds the real address and request data. Now one Compact circuit checks the private mandate, pays the checked recipient from the contract-held vault, and records this exact request hash as its receipt.

Show: create proposal, select **Prove & pay**, then the transaction ID, balances `50 → 45`, vendor `+5`, and **Exact request verified** receipt card. Trim only inactive proof wait; do not splice a different request into the success.

### 0:55–1:23 — two different budget attacks

> Eleven exceeds the hidden per-payment cap. Then eight is individually valid, but the earlier five plus eight exceeds the hidden cumulative ceiling. The real contract rejects both; no receipt is added and balances stay unchanged.

Show: **Spend 11 NIGHT**, then **Spend 8 more NIGHT**, each ending in `Rejected · zero balance movement`.

### 1:23–1:37 — recipient and replay defenses

> Changing the recipient also fails. Reusing the successful nonce fails too, so one valid instruction cannot become a different or repeated payment.

Show: **Wrong recipient**, then **Replay**. Keep the frozen count and balances visible.

### 1:37–1:52 — distinction and future

> Midnight Mandate combines private policy with contract custody and puts the payment inside the proof-checked call. Next, the mandate becomes a reusable capability with epoch budgets, expiry, revocation, sponsored fees, and selective audit for agent commerce.

Show: the three-step architecture and roadmap, then stop recording.

## Recording runbook

1. Close notifications and any window containing secrets.
2. Start the pinned local stack and UI with `yarn demo:ui`.
3. Open `http://127.0.0.1:5173` and initialize one fresh vault.
4. Open `http://127.0.0.1:5173/observer` in a second clean browser window.
5. Record one silent backup of the complete real flow.
6. Reset/restart the session and record the narrated take above.
7. Export at 1080p and confirm the final duration is no more than 2:00.
8. Confirm the opening audibly states “Midnight Hackathon: August 2026.”
9. Watch the entire export once for legibility, correct request/result continuity, audio, and secret leakage.
10. Upload the video publicly and verify it in a signed-out/incognito window.

## Final public-release gate

- [ ] Team has 5 or fewer members.
- [ ] Every teammate completed Devpost registration and MLH registration/check-in with matching email addresses.
- [ ] Repository and video are public and will remain public after the event.
- [ ] Repository was not submitted to another hackathon.
- [ ] Only one project will be submitted by this team.
- [ ] Video was recorded during this event weekend and is `≤ 2:00`.
- [ ] Hackathon name is stated at the beginning.
- [ ] Local development network is labeled honestly; no Preprod/mainnet claim appears.
- [ ] `yarn verify`, `yarn demo:smoke`, and `yarn audit --groups dependencies --level moderate` pass on the final commit.
- [ ] `git status --short` is empty and no secrets, private wallet state, `.env` values, or raw provider output are tracked.
- [ ] Repository and video links work in a signed-out/incognito browser.
- [ ] Devpost preview includes project name, tagline, description, built-with list, track, team, repository, and video.
- [ ] Final public submission page opens and every link works.

## Claims to avoid

Do not say the prototype provides private settlement, production-safe custody, arbitrary safe tool execution, ZK-proved LLM reasoning, a generic wallet SDK, mainnet deployment, or Preprod deployment. Those are roadmap items unless new evidence is produced before submission.
