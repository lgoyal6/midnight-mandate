# Preprod verification

Status on 2026-08-29: **runner ready; transaction human-gated by a funded test-only wallet**.

## What is already verified

- `https://rpc.preprod.midnight.network` answered `Midnight Preprod`.
- `https://indexer.preprod.midnight.network/api/v4/graphql` returned live block height `2325142` during the check.
- The Compact contract compiles before the public-network runner starts.
- The runner reuses a healthy local proof server instead of trying to bind a second service to port `6300`.
- Wallet secrets are accepted only from an ignored `.env.preprod` file and are never written to the evidence artifact or logger.

## Human-owned wallet step

Use a test-only wallet. Never paste a mnemonic or seed into chat, a shared shell command, or Git.

```bash
cp .env.example .env.preprod
chmod 600 .env.preprod
```

Edit `.env.preprod` and set exactly one value:

```text
MIDNIGHT_PREPROD_MNEMONIC="twenty four test-only words ..."
```

or:

```text
MIDNIGHT_PREPROD_SEED=<64 lowercase hexadecimal characters>
```

Fund that wallet with Preprod tNIGHT through the [Preprod faucet](https://midnight-tmnight-preprod.nethermind.dev/) and complete the wallet's current tDUST registration/delegation flow. Then run:

```bash
yarn test:preprod
```

A pass prints `MIDNIGHT_MANDATE_PREPROD_PASS` plus public contract/payment identifiers and writes a sanitized ignored artifact to `artifacts/preprod-smoke.json`.

## Current reproducible blocker

With no `.env.preprod`, the runner compiles the contract, reuses the healthy proof server, and stops before wallet initialization with:

```text
Error: set exactly one of MIDNIGHT_PREPROD_MNEMONIC or MIDNIGHT_PREPROD_SEED in .env.preprod
```

This is intentional. The project must not discover, generate, or borrow a wallet secret automatically.

## Error encountered and fixed

The first runner used `yarn proof:up`, which attempted to start a second proof-server container and failed:

```text
Bind for 127.0.0.1:6300 failed: port is already allocated
```

The script now uses the health-aware `yarn env:up`; it detects and reuses the compatible proof server already running on `6300`. The unused stopped container/network created by the failed attempt were removed with `docker compose down`; the working vendor stack was not touched.
