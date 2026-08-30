# Two-minute demo

## Required opening

> “Hi, we are [team], and this is Midnight Mandate, our project for Midnight Hackathon: August 2026.”

Say this first. Target a final duration of 1:50–1:55.

## Prepare

```bash
yarn demo:ui
```

Open the owner console at `http://127.0.0.1:5173` and public-only view at `http://127.0.0.1:5173/observer`. Close notifications and any secret-bearing windows. Use the deterministic proposal mode for recording reliability.

Initialize the vault **before** starting the final recording. A measured cold initialization took 45 seconds and made an otherwise valid raw take 137.2 seconds long. With the vault already ready, the complete proposal, real proof/payment, and four-attack sequence recorded in 34.5 seconds. That leaves 85.5 seconds for the required opening, explanation, and deliberate pacing.

The checked-in rehearsal evidence is [`evidence/demo-rehearsal.json`](../evidence/demo-rehearsal.json). The silent WebM stays local and is intentionally ignored; it is evidence for the team, not the final public submission.

## Operator self-test

Run this once before the final take. It is deliberately the same path the video uses:

1. Wait until the terminal prints both `MIDNIGHT_STACK_READY` and `MANDATE_DEMO_API_READY`.
2. Select **Initialize real vault** and wait for **Vault ready**. Do this before recording.
3. Open `/observer` in a second window. It should show payment count `0`, cumulative spend `0`, vault `50`, and no private caps or invoice text.
4. In the owner window, select **Create typed proposal**, then **Prove & pay**. Wait for the transaction ID and `50 → 45` vault change.
5. Without reloading the observer window, confirm it updates within three seconds to payment count `1`, cumulative spend `5`, and vault `45`.
6. Run each attack once. Each card must become disabled with **Rejected · zero balance movement**, ending at **4/4 blocked**.
7. For the rehearsal only, select **Recover 45 & close**. Confirm owner and observer both reach vault `0` and lifecycle `closed`; the observer must update without a manual reload.
8. Stop and restart `yarn demo:ui`, initialize a fresh vault, and then record the shorter script below without the recovery beat.

Use **Deterministic** for the final take. The paid **Live AI** extractor has been verified separately, but it is intentionally not a recording dependency.

## Script

### 0:00–0:12 — Problem

“AI spending guardrails are usually public, bypassable, or disconnected from the wallet that moves money. Midnight Mandate makes a private rule causally control a contract-held payment.”

### 0:12–0:30 — Privacy boundary

Show the already-initialized vault: owner per-payment cap `10`, cumulative ceiling `12`, recipient `vendor`, and deposit `50`. Switch briefly to `/observer`.

“The public endpoint receives only a policy commitment and public custody state. This prototype uses unshielded settlement, so a successful amount and recipient become public.”

### 0:30–0:58 — Valid payment

Use: `Pay 5 NIGHT to vendor for invoice INV-42`.

Create the typed proposal, then select **Prove & pay**.

“The model can propose only an amount, allow-listed alias, and purpose. Code binds the real address, network, contract, nonce, and request hash. The same Compact circuit verifies the private rule and sends the exact checked values.”

Show transaction ID, vault `50 → 45`, and vendor `+5`.

### 0:58–1:30 — Break it

Run **Spend 11 NIGHT**, then **Spend 8 more NIGHT** after the valid 5. If time permits, flash the already-verified recipient/replay cards too.

“The public did not learn either ceiling beforehand. Eleven breaks the per-payment cap. Eight is individually valid, but five plus eight breaks the hidden cumulative limit. A different recipient and reused nonce fail too. Every denial leaves balances and state unchanged.”

### 1:30–1:49 — Why Midnight

Show the three columns.

“A private server rule requires trusting the server. A transparent contract reveals the policy. Midnight lets the vault verify the hidden mandate before releasing funds.”

### 1:49–1:56 — Vision

“Next, mandates become reusable private authority for agent commerce: epoch budgets, expiry, merchant sets, sponsored execution, and selective audit.”

The required take can stop here. For judge Q&A or a longer live walkthrough, run all four rejection buttons and then select **Recover 45 & close**. Show the owner recovery transaction, vault `45 → 0`, and public lifecycle `closed`; explain that the distinct owner opening is still local to one trusted prototype process.

## Recording integrity

- Show the local-devnet label; do not imply Preprod unless `MIDNIGHT_MANDATE_PREPROD_PASS` exists.
- Trimming proof wait time is fine, but do not splice a success onto a different proposal.
- Never show a mnemonic, seed, private `.env`, proof preimage, API credential, notification, or personal browser data.
- Confirm the public video is two minutes or less and remains public.

Measure the exported file rather than trusting the editor timeline:

```bash
ffprobe -v error -show_entries format=duration \
  -of default=noprint_wrappers=1:nokey=1 final-demo.mp4
```

The printed value must be `120.0` seconds or less. Watch the entire export once after this check; duration alone does not verify the opening, audio, legibility, continuity, or secret safety.
