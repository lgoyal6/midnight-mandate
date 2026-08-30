# Reproducible build runbook

Verified on Apple silicon macOS during the event window. Linux uses the same commands; Windows should use WSL per Midnight's installation guide.

## Pinned versions

| Tool | Version |
| --- | --- |
| Compact launcher | `0.5.2` |
| Compact compiler | `0.31.1` |
| Compact language pragma | `0.23` |
| Compact runtime | `0.16.0` |
| Midnight.js packages | `4.1.1` |
| Proof server | `8.1.0` |
| Node image | `1.0.0` |
| Indexer image | `4.3.3` |
| Yarn | `1.22.22` |

## Clean setup

```bash
node --version
docker --version
docker compose version
docker info >/dev/null
compact --version
compact compile --version
```

Required: Node `>=22`, a running Docker daemon, Compact launcher `0.5.2`, and compiler `0.31.1`.

```bash
corepack enable
corepack prepare yarn@1.22.22 --activate
yarn install --frozen-lockfile
yarn verify
```

## Single smoke command

```bash
yarn demo:smoke
```

This command:

1. compiles Compact;
2. runs 17 contract and 12 proposal tests;
3. type-checks the Node/client code;
4. reuses or starts a compatible local Midnight node/indexer/proof stack;
5. deploys a fresh vault;
6. deposits 50 test NIGHT;
7. sends 5 through `agent_pay`;
8. checks exact vault/vendor deltas;
9. runs over-cap, cumulative-budget, wrong-recipient, and replay attacks;
10. proves owner recovery of the entire remaining 45 and permanently closes the vault;
11. rejects a post-close payment without state/balance movement;
12. exits zero only when all payment, rejection, and recovery assertions hold.

## Visual flow

```bash
yarn demo:ui
```

The first **Initialize real vault** click takes roughly 35–45 seconds locally because deployment/funding wait for confirmed blocks. Payment and owner recovery each take roughly 20 seconds. Rejection cases fail during proof/circuit construction and usually return quickly. The cumulative case submits 8 after a successful 5 under the hidden 10-per-payment / 12-total policy. After all four rejections, **Recover 45 & close** proves the owner opening, empties the vault, and disables the remaining controls.

## Errors encountered and fixes

### Duplicate nominal Midnight runtime types

Fresh dependency resolution introduced incompatible duplicate ledger/runtime classes, producing errors such as `expected instance of StateValue`. The lockfile/resolutions pin:

```json
"@midnight-ntwrk/ledger-v8": "8.1.0",
"@midnight-ntwrk/onchain-runtime-v3": "3.0.0"
```

Always use `yarn install --frozen-lockfile`.

### Unshielded signing failure

The node rejected an early transfer recipe with `InputsSignaturesLengthMismatch`. Unshielded transaction recipes must be signed through the wallet SDK's unshielded keystore as implemented in `src/wallet.ts`.

### Wrong observer address

Using raw public-key bytes caused balance observation to wait on the wrong identity. `src/wallet-state.ts` now extracts canonical `UserAddress` bytes from the wallet SDK state.

### Occupied proof-server port

Starting a second proof server produced `Bind for 127.0.0.1:6300 failed: port is already allocated`. `scripts/env-up.ts` checks node/indexer/proof health and reuses a compatible existing stack.

### Live model provider failure

One schema extractor returned paid HTTP `502` after its upstream model rate-limited. The adapter failed closed and was switched to a verified schema-guided provider. The deterministic path remains the recording baseline.

### Public projection was not isolated

The first observer panel selected fields from a combined owner/observer response. That was not a real privacy boundary. `/api/observer` and `/observer` now use a separate public-only projection; response and DOM leak scans passed.

### Recovery existed only in the CLI

The first recovery milestone was contract/client/smoke complete but not visible in the owner UI. The real demo API now exposes a gated owner-console action only after the valid payment and all four rejection checks. Browser verification confirmed the close transaction, owner recovery `+45`, vault `0`, lifecycle `closed`, disabled payment controls, and an isolated observer response with no private-key fields. This local server is not a production authentication boundary and must not be exposed to an untrusted network.

### Cold-start take exceeded the video limit

The first real browser recording included vault initialization and lasted 137.2 seconds, exceeding the 120-second submission limit. Initialization alone took 45 seconds. Initializing before recording produced a 34.5-second silent clean take containing proposal creation, a real proof-backed payment, and all four rejection paths. Rehearsal timing and transaction identifiers are recorded in [`evidence/demo-rehearsal.json`](../evidence/demo-rehearsal.json). The final narrated take still needs the required hackathon-name opening and public signed-out verification.

### A pre-opened observer window became stale

The isolated observer originally fetched its public projection only once. In a two-window rehearsal it stayed at payment count `0`, vault `50`, and lifecycle `active` after the owner window had paid and closed the vault. The observer now refreshes when focused or made visible and every three seconds while open. Its server path also derives the response directly from ledger/indexer-visible state instead of constructing the combined owner snapshot and discarding fields afterward.

## Individual teammate steps

- Everyone: install pinned Node/Yarn/Compact/Docker and run `yarn demo:smoke`.
- Demo operator: run `yarn demo:ui` and rehearse [`DEMO.md`](DEMO.md).
- Preprod owner only: create/fund a test wallet and follow [`PREPROD.md`](PREPROD.md). Never share that secret.
- Submission owner: publish the repository/video and verify both in an incognito window.
