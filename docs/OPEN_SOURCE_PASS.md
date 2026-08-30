# Open-source pressure test — 2026-08-30

This pass asked one narrow question: **what can improve the two-minute proof without weakening the verified payment path?** It used the current [Midnight Awesome dApps catalog at `941efc1`](https://github.com/midnightntwrk/midnight-awesome-dapps/tree/941efc1f51d620402dbc8587fd37279becbc99e2) for discovery, then inspected the linked repositories and contracts at the commits below.

## Closest implementations

| Project | What exists at the inspected commit | Pressure-test result |
| --- | --- | --- |
| [Aegis `efcc039`](https://github.com/1shanpanta/aegis/tree/efcc039b34470805d23c1421b649c556f0d2fae3) | Compact checks a private allowance and whitelist, records a last-transaction commitment, and supports revocation. Its README explicitly describes it as a policy layer rather than a vault. | Do not copy more policy switches. Mandate's defensible distinction is that contract custody and `sendUnshielded` make the proof causal. |
| [MidPilot `1c18977`](https://github.com/ANPAN27/MidPilot/tree/1c189775e8d7e2417d2a8c6e7321e025cb0ae25e) | Strong natural-language and MCP wallet UX. Its README says real transfers are gated by the local policy engine and the Compact validation is not wired into that payment path. | Do not spend the weekend rebuilding its chat UX. Keep the model narrow and make the contract enforcement visible. |
| [Latch `5153e6b`](https://github.com/CipherCollective/Latch/tree/5153e6b7e46483ba0f4e785e945396323446c607) | The Compact contract and real-client layer model private limits, categories, use counts, nullifiers, receipts, and revocation. The checked-in public UI still uses the deterministic mock path; its status notes leave the funded wallet/browser handoff and full proof-path integration outstanding. It authorizes a spend but does not custody and execute that payment. | This is the closest capability design. Mandate must show a real proof, exact receipt, and balance-moving settlement—not merely claim better feature breadth. |
| [Passport demo `1b69875`](https://github.com/midnightntwrk/passport-demo/tree/1b6987561bdfd2b16c4d2e7ef0b48eedffdbf43d) | The official account contract has contract custody, capped grant withdrawals, revocation, epoch invalidation, recovery, and shielded/unshielded paths. In [`account.compact`](https://github.com/midnightntwrk/passport-demo/blob/1b6987561bdfd2b16c4d2e7ef0b48eedffdbf43d/contracts/account.compact), grant cap and token color are public and a grant withdrawal accepts the supplied recipient. | Do not race an official account platform on breadth. Keep the smaller claim: privately committed caps plus a precommitted recipient, tied to the exact agent request and payment. |
| [Private Auction `a85b321`](https://github.com/pplmaverick/midnight-private-auction/tree/a85b3213d3e9c2d3c1a0b073d1a00191eb3d0077) | A polished contract, browser-wallet UI, proof modal, local scripts, and public deployment documentation for a sealed-bid flow. | Its lesson is presentation, not a feature to import: make the real proof result legible in one screen. |
| [Midnight Authenticator `d0a2b30`](https://github.com/subc0der/midnight-authenticator/tree/d0a2b30df1445473beea570db1b33f322fcd2c5b) | A time-window authentication design and extension UX. Its README labels browser-extension proofs as mocked in development. | Time-window semantics are useful roadmap evidence, but adding an expiry clock now would enlarge the contract and test surface without strengthening the current payment demo. |
| [Private Party `62ca6e7`](https://github.com/midnightntwrk/example-private-party/tree/62ca6e7e35f9df725f7f77d280d294ac37f2aca7) | An official, current local/testnet reference with private commitments and real fee custody/claim paths. | Retain its discipline: real wallet balance deltas and proof-server execution matter more than another dashboard feature. |
| [Wallet CLI hub `a44502f`](https://github.com/nel349/midnight-wallet-cli-hub/tree/a44502fa5167a5bb2cecab135221c9dc46d209a5) | Documents a CLI wallet, DApp-compatible connector server, and MCP surface, and points to the now-public source repository. | Useful future integration, but swapping the already-verified wallet/provider path this late adds failure modes without improving the core judging claim. |

## Decision

Add **exact on-ledger request-receipt verification** and stop there.

The contract already inserts `payment_receipts[nullifier] = request_commitment` in the same `agent_pay` call that sends funds. Before this pass, the UI showed the proposal hash, a transaction ID, and only the *count* of public receipts. A judge could see both ends but not their exact equality.

The added receipt view now:

1. derives the public nullifier from the successful proposal;
2. queries the indexed contract ledger after settlement;
3. requires that the nullifier is consumed;
4. requires that the map value equals the proposal's exact request commitment; and
5. exposes only that public receipt, nullifier, and transaction ID to the observer route.

This is additive evidence, not a new trust assumption or simulated feature. The demo session fails if the indexed receipt does not match.

## Rejected additions

- **Epoch/day reset or expiry:** useful product work, but it changes policy semantics and needs a trustworthy time/epoch definition plus new rollback tests.
- **Shielded payout:** strategically valuable, but significantly expands wallet, coin-selection, and public-network risk.
- **Browser-wallet migration:** hostable and polished when it works, but introduces wallet availability, permissions, funding, ZK asset delivery, and public-network dependencies into the critical path.
- **More AI autonomy:** weakens the security story. The model should not choose authority-bearing addresses, contracts, networks, colors, nonces, or hashes.
- **Generic identity or TOTP:** already well represented and orthogonal to contract-custodied agent payments.

The next feature after the hackathon should be epoch-scoped private mandates, but only after this receipt-and-settlement path remains green end to end.
