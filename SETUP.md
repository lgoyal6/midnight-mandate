# Midnight Mandate setup

This is the teammate runbook for the exact environment verified on 2026-08-29 PDT. The official prerequisites are macOS or Linux (Windows through WSL), Node.js 22 or later, Docker running, and the Compact toolchain; the official proof-server port is `6300`. ([Midnight installation guide](https://docs.midnight.network/getting-started/installation), [local proving guide](https://docs.midnight.network/guides/local-proving))

## Verified versions

| Component | Pin used by this repository |
| --- | --- |
| Node.js | `>=22`; verified with `v24.19.0` and `v26.8.1` |
| Yarn | `1.22.22` |
| Compact launcher | locally installed `0.5.2` |
| Compact compiler | `0.31.1` |
| Compact language pragma | `0.23` |
| Compact runtime | `0.16.0` |
| Midnight.js | `4.1.1` |
| Wallet SDK | `1.2.0` |
| Proof server | `8.1.0` |
| Local node image | `1.0.0` |
| Local indexer image | `4.3.3` |

The current support matrix specifies Compact devtools `0.5.1`, compiler `0.31.1`, runtime `0.16.0`, Midnight.js `4.1.1`, Wallet SDK `1.2.0`, and proof server `8.1.0`. The installer on this machine reported launcher `0.5.2`; this documented launcher discrepancy did not change the selected compiler and the clean-clone gate passed. ([Compatibility matrix](https://docs.midnight.network/relnotes/support-matrix))

## 1. Install prerequisites

Install Docker Desktop from the official download and start it. Install a supported Node.js release from the official Node.js download if `node --version` is older than 22. Rust and Nix are not prerequisites named by the current Midnight installation guide and were not required by this build. ([Docker Desktop](https://www.docker.com/products/docker-desktop/), [Node.js downloads](https://nodejs.org/en/download), [Midnight installation guide](https://docs.midnight.network/getting-started/installation))

Verify before continuing:

```bash
node --version
docker --version
docker compose version
docker info >/dev/null
```

`docker info` must exit zero. On Windows, run all remaining commands inside WSL. ([Midnight installation guide](https://docs.midnight.network/getting-started/installation))

## 2. Install the pinned Compact compiler

Run the vendor installer and select compiler `0.31.1`, exactly as the current installation guide directs: ([Midnight installation guide](https://docs.midnight.network/getting-started/installation))

```bash
curl --proto '=https' --tlsv1.2 -LsSf \
  https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh \
  | sh
```

Open a new terminal. If `compact` is still missing, use the install location reported by the installer or temporarily add both documented locations:

```bash
export PATH="$HOME/.local/bin:$HOME/.compact/bin:$PATH"
compact update 0.31.1
compact --version
compact compile --version
which compact
```

The final command must report compiler `0.31.1`. The contract begins with `pragma language_version 0.23;`, which this compiler accepts. ([Contract source](https://github.com/lgoyal6/midnight-mandate/blob/main/contracts/mandate.compact))

## 3. Clone and install frozen dependencies

```bash
git clone https://github.com/lgoyal6/midnight-mandate.git
cd midnight-mandate
corepack enable
corepack prepare yarn@1.22.22 --activate
yarn install --frozen-lockfile
```

Do not delete or regenerate `yarn.lock`. It contains compatibility resolutions that prevent duplicate Midnight runtime classes.

## 4. Run the pinned vendor Hello World checkpoint

The official Hello World repository is tutorial scaffolding: at pinned commit `67b8c9a0c76eebadfcc6d2de638dae21a20fb2fc`, its README instructs the developer to create `contracts/hello-world.compact` from the supplied snippet before compiling. That is expected, not a missing download. ([Official Hello World repository](https://github.com/midnightntwrk/example-hello-world/tree/67b8c9a0c76eebadfcc6d2de638dae21a20fb2fc))

```bash
git clone https://github.com/midnightntwrk/example-hello-world.git midnight-hello-world
cd midnight-hello-world
git checkout 67b8c9a0c76eebadfcc6d2de638dae21a20fb2fc
corepack yarn install --frozen-lockfile
```

Create `contracts/hello-world.compact` with the vendor's exact contract:

```compact
pragma language_version 0.23;

export ledger message: Opaque<"string">;

export circuit storeMessage(newMessage: Opaque<"string">): [] {
  message = disclose(newMessage);
}
```

Then compile, start the vendor stack if the ports are not already served by a compatible stack, and run the TypeScript integration test:

```bash
corepack yarn compile
corepack yarn env:up
corepack yarn test:local
corepack yarn env:down
```

The verified compile reported one `storeMessage` circuit with `k=6` and 26 rows. The local test deployed contract `d0d2b728b27c2b839ce6aa77047deba68f12e2e1001ca2c640026b42a922273c` and passed 2/2 tests: deployment plus storing `Hello World!`. This local address belongs only to the disposable devnet run. ([Official Hello World repository](https://github.com/midnightntwrk/example-hello-world/tree/67b8c9a0c76eebadfcc6d2de638dae21a20fb2fc))

Return to `midnight-mandate` before continuing.

## 5. Compile and run the complete project checkpoint

The single smoke command is:

```bash
yarn demo:smoke
```

It compiles the Compact contract, runs 17 contract tests and 12 proposal-boundary tests, type-checks the client, starts or reuses the pinned node/indexer/proof stack, deploys a fresh vault, deposits 50 test NIGHT, proves and pays 5, verifies four attack rejections, proves owner recovery of 45, closes the vault, and rejects a post-close payment. The checked-in receipt schema and latest sanitized result are public. ([Smoke script](https://github.com/lgoyal6/midnight-mandate/blob/main/scripts/smoke.ts), [latest local evidence](https://github.com/lgoyal6/midnight-mandate/blob/main/evidence/local-smoke.json))

A valid run ends with:

```text
MIDNIGHT_MANDATE_SMOKE_PASS
vault_delta=-5
vendor_delta=+5
cumulative_spend=5
owner_recovered=+45
vault_after_close=0
rejected=over-cap,cumulative-budget,wrong-recipient,replay,closed-vault
```

This is the one command teammates should use as the environment acceptance test. It exits nonzero if compilation, proving, deployment, settlement, recovery, or a negative-path assertion fails.

## 6. Verify the proof server directly

The smoke command starts or reuses `midnightntwrk/proof-server:8.1.0` on loopback port `6300`. Check all three vendor endpoints: ([Local proving guide](https://docs.midnight.network/guides/local-proving))

```bash
curl http://127.0.0.1:6300/health
curl http://127.0.0.1:6300/version
curl http://127.0.0.1:6300/ready
```

Expect `status: ok`, version `8.1.0`, and zero queued jobs when idle.

## 7. Run the real local UI and CLI-backed flow

```bash
yarn demo:ui
```

Open `http://127.0.0.1:5173`. **Initialize real vault** deploys and funds a fresh contract. **Prove & pay** drives the Compact call through the TypeScript client and proof server. The four attack buttons must each report zero balance movement; **Recover 45 & close** then proves the owner opening and permanently closes the vault. The isolated public projection is at `http://127.0.0.1:5173/observer`. ([Demo runbook](https://github.com/lgoyal6/midnight-mandate/blob/main/docs/DEMO.md), [architecture](https://github.com/lgoyal6/midnight-mandate/blob/main/docs/ARCHITECTURE.md))

Stop only this repository's owned Compose stack when finished:

```bash
yarn env:down
```

## 8. Preprod: individual wallet and faucet step

Midnight documents `undeployed` for local iteration, Preview for early shared testing, and Preprod for final validation before mainnet; a proof server stays local for every network. The current hackathon rules do not require a public-testnet deployment, and Midnight's July winner review says stopping on local is normal for a 48-hour build, though a verified Preprod deployment can differentiate a submission. ([Networks guide](https://docs.midnight.network/guides/networks-and-environments), [July winner review](https://midnight.network/blog/celebrating-seven-winners-from-mlh-x-midnight-july-hack))

Only the teammate who owns the test wallet does this step:

```bash
cp .env.example .env.preprod
chmod 600 .env.preprod
```

Set exactly one test-only secret in `.env.preprod`:

```text
MIDNIGHT_PREPROD_MNEMONIC="twenty four test-only words ..."
```

or:

```text
MIDNIGHT_PREPROD_SEED=<64 lowercase hexadecimal characters>
```

Fund that wallet through the [Preprod faucet](https://midnight-tmnight-preprod.nethermind.dev/), finish its current tDUST registration/delegation flow, and run:

```bash
yarn test:preprod
```

Do not share the mnemonic, seed, `.env.preprod`, wallet database, or raw private provider output. Preprod is not claimed unless the command prints `MIDNIGHT_MANDATE_PREPROD_PASS` and yields public identifiers. ([Preprod runbook](https://github.com/lgoyal6/midnight-mandate/blob/main/docs/PREPROD.md))

## Errors encountered and their fixes

| Error | Cause | Fix now in the repository |
| --- | --- | --- |
| `expected instance of StateValue` | Duplicate incompatible ledger/runtime classes after dependency resolution | Pin `@midnight-ntwrk/ledger-v8@8.1.0` and `@midnight-ntwrk/onchain-runtime-v3@3.0.0`; always use `yarn install --frozen-lockfile` |
| `InputsSignaturesLengthMismatch` | Unshielded transfer recipe signed by the wrong wallet path | Sign through the Wallet SDK unshielded keystore in `src/wallet.ts` |
| Balance observer waited on the wrong identity | Raw public-key bytes were used instead of the SDK address representation | Extract canonical `UserAddress` bytes in `src/wallet-state.ts` |
| `port is already allocated` on `127.0.0.1:6300` | A compatible proof server was already running | `scripts/env-up.ts` health-checks and reuses compatible node/indexer/proof services |
| Live schema model returned HTTP `502` | Upstream provider failure/rate limiting | Adapter fails closed; deterministic proposal path remains the recording baseline |
| Observer UI looked isolated but response contained owner data | UI selected public fields from a combined private response | `/api/observer` now builds a separate public-only projection and is leak-tested |
| Recovery existed only in CLI | Contract/client milestone had no judge-visible control | Real owner-console demo endpoint/button now appears only after the success plus 4/4 rejection flow |

The longer evidence narrative is in [docs/REPRODUCE.md](https://github.com/lgoyal6/midnight-mandate/blob/main/docs/REPRODUCE.md).

## Browser-wallet recommendation

Use the verified local TypeScript CLI-backed UI for the two-minute demo. Midnight's current wallet guide says Lace has no in-browser proving and still lacks `getProvingProvider` and `signData`; it needs a local proof server, while 1AM and Kuira have different proving paths. A browser connector is worthwhile after the core demo is recorded, but changing the trust and failure surface now is a poor trade for this build. This is a reliability recommendation, not a gate against web or mobile ideas. ([Midnight community-wallet guide](https://docs.midnight.network/sdks/community/wallets/community-wallets-overview))
