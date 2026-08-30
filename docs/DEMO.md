# Two-minute demo

## Required opening

> “Hi, we are [team], and this is Midnight Mandate, our project for Midnight Hackathon: August 2026.”

Say this first. Target a final duration of 1:50–1:55.

## Prepare

```bash
yarn demo:ui
```

Open the owner console at `http://127.0.0.1:5173` and public-only view at `http://127.0.0.1:5173/observer`. Close notifications and any secret-bearing windows. Use the deterministic proposal mode for recording reliability.

## Script

### 0:00–0:12 — Problem

“AI spending guardrails are usually public, bypassable, or disconnected from the wallet that moves money. Midnight Mandate makes a private rule causally control a contract-held payment.”

### 0:12–0:30 — Privacy boundary

Initialize the vault. Show owner per-payment cap `10`, cumulative ceiling `12`, recipient `vendor`, and deposit `50`. Switch briefly to `/observer`.

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
