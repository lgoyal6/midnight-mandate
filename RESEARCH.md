# Midnight Hackathon research brief

Verified 2026-08-29 PDT for the August 28–30, 2026 online event. Every external fact below has an inline source. `UNVERIFIED` means the current public sources did not resolve it; inferences are labeled as inferences.

## Decision in one page

Midnight is useful when an application must keep inputs or rules off the public ledger while still making a public state transition depend on those hidden values satisfying a Compact circuit. The contract runs locally, produces a public transcript and private witness transcript, and sends the network the public transcript plus a zero-knowledge proof; the network verifies constraints without receiving the hidden inputs. ([Local proving guide](https://docs.midnight.network/guides/local-proving))

The sponsor is not asking for generic “AI + blockchain.” The AI track asks for an AI application where Midnight protects sensitive data or verifies behavior, with agent guardrails, private inference gating, and verifiable AI claims as named shapes. ([Current event page](https://events.mlh.com/events/14510-midnight-hackathon))

Our strongest build is **Midnight Mandate**: a Compact vault that holds funds and releases the exact payment only when the same circuit proves the amount, recipient, cumulative spend, and nonce obey a privately committed mandate. It now has real local deployment, proving, settlement, five rejection paths, owner recovery, an isolated observer, 17 contract tests, 12 proposal tests, and a one-command clean-clone smoke path. ([Public repository](https://github.com/lgoyal6/midnight-mandate), [checked-in evidence](https://github.com/lgoyal6/midnight-mandate/tree/main/evidence))

Why this pick survives the existing-project check: MidPilot already demonstrates natural-language wallet actions, Latch already frames hidden agent spending rules, and Aegis already demonstrates private policy checks; Mandate's defensible distinction is that the contract itself holds the funds and the proof-checked circuit performs settlement atomically, so the policy proof is causal rather than advisory. ([MidPilot](https://github.com/ANPAN27/MidPilot), [Latch](https://github.com/CipherCollective/Latch), [Aegis](https://github.com/1shanpanta/aegis), [Mandate contract](https://github.com/lgoyal6/midnight-mandate/blob/main/contracts/mandate.compact))

For this weekend, demo through the verified TypeScript CLI-backed local UI. That recommendation is not a web/mobile technology gate: the current wallet matrix says browser DApps can target Lace and 1AM, and mobile can target 1AM/Kuira, but the proving and connector capabilities differ; Lace still needs a local proof server and lacks `getProvingProvider` and `signData`. ([Community wallet guide](https://docs.midnight.network/sdks/community/wallets/community-wallets-overview))

## A. What Midnight actually is

### Execution and ledger model

- A Compact circuit executes on the caller's device and emits a public transcript—ledger reads/writes and applied rules—and a private transcript containing witness data. The network receives the public transcript plus a proof that hidden inputs satisfied every circuit constraint. ([Local proving guide](https://docs.midnight.network/guides/local-proving))
- The ledger stores the contract's disclosed public state and the accepted state transition; it does not store raw witness values unless the contract explicitly discloses or derives public data from them. ([Hello World example](https://github.com/midnightntwrk/example-hello-world), [Compact documentation](https://docs.midnight.network/compact))
- A proof attests that the public transition was produced by valid circuit execution with some private inputs satisfying the constraints. It does **not** attest that an LLM reasoned honestly, that off-chain facts were true, or that an external action occurred unless the circuit cryptographically binds and controls the relevant evidence/action. ([Local proving guide](https://docs.midnight.network/guides/local-proving))
- Midnight's launch description calls this a hybrid ledger with client-side proofs, public/private state choices, shielded and unshielded assets, and selective disclosure. ([Midnight mainnet launch](https://midnight.network/blog/midnight-network-is-live))

### Compact vocabulary and current version

- Compact is Midnight's statically typed, TypeScript-influenced domain-specific contract language for expressing public state and zero-knowledge constraints. ([Midnight mainnet launch](https://midnight.network/blog/midnight-network-is-live), [Compact documentation](https://docs.midnight.network/compact))
- A **circuit** is a contract function whose execution becomes a constrained proof computation; an exported circuit can participate in a transaction and change ledger state. ([Hello World example](https://github.com/midnightntwrk/example-hello-world))
- A **ledger field** is persistent public contract state. A **witness** is private input supplied locally to the circuit; witness values remain private unless the contract discloses them or exposes a reversible derivative. ([Hello World example](https://github.com/midnightntwrk/example-hello-world), [Local proving guide](https://docs.midnight.network/guides/local-proving))
- The current tested compiler is `0.31.1`; the compatibility matrix pairs it with Compact runtime `0.16.0`, Midnight.js `4.1.1`, Wallet SDK `1.2.0`, Connector API `4.0.1`, and proof server `8.1.0`. ([Compatibility matrix](https://docs.midnight.network/relnotes/support-matrix))
- The current official Hello World template uses the exact line `pragma language_version 0.23;`; Mandate uses that line and compiles with compiler `0.31.1`. ([Hello World example](https://github.com/midnightntwrk/example-hello-world), [Mandate contract](https://github.com/lgoyal6/midnight-mandate/blob/main/contracts/mandate.compact))
- The support matrix lists Compact devtools `0.5.1`, while the official installer on this machine reported launcher `0.5.2`; the selected compiler remains `0.31.1`. This launcher mismatch is recorded rather than normalized away. ([Compatibility matrix](https://docs.midnight.network/relnotes/support-matrix), [setup runbook](https://github.com/lgoyal6/midnight-mandate/blob/main/SETUP.md))

### Proof server and viable interaction frequency

- The proof server is a native service distributed in Docker. It receives an unproven transaction plus proving key, verifier key, ZKIR, and witness data; it performs the expensive proof computation and returns proofs. ([Local proving guide](https://docs.midnight.network/guides/local-proving))
- It sees private witnesses, so the official guidance is to run it locally or on a controlled encrypted host. It does not hold wallet keys, sign transactions, or spend funds. ([Local proving guide](https://docs.midnight.network/guides/local-proving))
- The current stable image is `midnightntwrk/proof-server:8.1.0`; it listens on `6300`, exposes `/health`, `/version`, and `/ready`, and defaults to two proving workers. ([Installation guide](https://docs.midnight.network/getting-started/installation), [local proving guide](https://docs.midnight.network/guides/local-proving))
- Verification is roughly 3.3 ms plus a small size-dependent term under the deployed cost model, while proof creation is the expensive side and may incur a slow first-start parameter download. ([Local proving guide](https://docs.midnight.network/guides/local-proving))
- **Inference for product design:** per-request proof generation is viable for a low-frequency, high-value action such as “approve and pay,” but it is a bad fit for keystroke-level or rapid-loop UX. For repeated agent actions, prove or mint a narrowly scoped session/epoch capability once, then consume replay-protected uses until expiry/budget exhaustion. This follows from the official proving asymmetry and Mandate's observed approximately 20-second local payment/recovery steps. ([Local proving guide](https://docs.midnight.network/guides/local-proving), [Mandate reproduction notes](https://github.com/lgoyal6/midnight-mandate/blob/main/docs/REPRODUCE.md))

### Networks and faucets

- `undeployed` is the local Docker network with a pre-funded genesis wallet; `preview` is the early shared public test network; `preprod` is final validation closest to mainnet; `mainnet` is production with real value and no faucet. The proof server remains local for all four. ([Networks and environments](https://docs.midnight.network/guides/networks-and-environments))
- The [Preview faucet](https://midnight-tmnight-preview.nethermind.dev/) and [Preprod faucet](https://midnight-tmnight-preprod.nethermind.dev/) distribute rate-limited test NIGHT; local needs no faucet. ([Networks and environments](https://docs.midnight.network/guides/networks-and-environments))
- The current hackathon overview does not require a specific network. Midnight's July winner review explicitly says a local node is standard and expected for a 48-hour hackathon, while published Preprod addresses made Hermes and Moonray stand out. ([Current Devpost overview](https://midnight-hackathon-august-2026.devpost.com/), [July winner review](https://midnight.network/blog/celebrating-seven-winners-from-mlh-x-midnight-july-hack))
- **Decision:** local is the reliability baseline and honest submission claim; Preprod is a differentiator only after a teammate funds a test-only wallet and the runner prints `MIDNIGHT_MANDATE_PREPROD_PASS`. ([Preprod runbook](https://github.com/lgoyal6/midnight-mandate/blob/main/docs/PREPROD.md))

### Wallet story and browser-integration reality

- The standard DApp Connector is the browser boundary. The current wallet guide recommends feature-detecting Lace/1AM for browser DApps and using the wallet CLI/MCP path for automation and agents. ([Community wallet guide](https://docs.midnight.network/sdks/community/wallets/community-wallets-overview), [DApp Connector reference](https://docs.midnight.network/develop/reference/midnight-api/dapp-connector))
- Lace is live but exposes a partial Connected API: no in-browser proving, no `getProvingProvider`, no `signData`, and a required local proof server; the official wallet guide also notes Brave Shields and build-specific issues. ([Community wallet guide](https://docs.midnight.network/sdks/community/wallets/community-wallets-overview))
- 1AM provides in-browser proving and a connector; Kuira provides Android/on-device and embedded-wallet paths, with iOS and React Native described as later. Mobile is therefore a legitimate track, not prohibited by “prior work” or by an iOS technology gate; the weekend risk is finishing one consistent wallet/prover path. ([Community wallet guide](https://docs.midnight.network/sdks/community/wallets/community-wallets-overview), [Kuira Labs GitHub](https://github.com/kuiralabs))
- **Honest assessment:** browser integration is a known time sink because connector capability, proof location, wallet readiness, DUST, browser security settings, and network synchronization can fail independently. Record the CLI-backed UI first; add an extension path only if it preserves the existing end-to-end proof evidence. This is an inference from the documented wallet divergence and issue list. ([Community wallet guide](https://docs.midnight.network/sdks/community/wallets/community-wallets-overview))

### What Midnight cannot do—or does badly today

- It cannot prove arbitrary off-chain truth without a trustworthy input, credential, signature, oracle, or attestation; a ZK proof only proves the encoded predicate over supplied inputs. ([Local proving guide](https://docs.midnight.network/guides/local-proving))
- It cannot make a disclosed ledger value private. Successful unshielded transfers expose their public settlement data; shielded and unshielded choices must be designed intentionally. ([Midnight mainnet launch](https://midnight.network/blog/midnight-network-is-live))
- It cannot keep witnesses private from the proof-server process that receives them; hosting it with an untrusted party hands that party the witnesses. ([Local proving guide](https://docs.midnight.network/guides/local-proving))
- It has no native account abstraction/smart-account row today, so session keys, guardians, and programmable wallet authorization are application patterns rather than a turnkey platform primitive. ([Community wallet guide](https://docs.midnight.network/sdks/community/wallets/community-wallets-overview))
- Its developer stack is version-coupled across compiler/runtime/ledger, Midnight.js, wallet, indexer, node, and proof server; the compatibility matrix warns that only the listed combinations are tested. ([Compatibility matrix](https://docs.midnight.network/relnotes/support-matrix))
- Mainnet is live, but rollout remains federated and is intended to progress toward permissionless decentralization; the public node/runtime is also undergoing active hard-fork and migration work. ([Midnight mainnet launch](https://midnight.network/blog/midnight-network-is-live), [August network update](https://midnight.network/blog/state-of-the-network-august-2026))

### What the founders/network stewards want next, and what is blocked

- The long-term thesis is programmable privacy for real-world and regulated activity: hybrid public/private state, client-side proof, selective disclosure, predictable execution resources, and privacy that does not force every user to manage volatile gas assets. ([Midnight mainnet launch](https://midnight.network/blog/midnight-network-is-live))
- Current investments reveal near-term priorities: DUST sponsorship separates user authorization from fee payment, VIA provides live cross-chain messaging, and the ecosystem is adding wallets, storage, trading, audit, and live-chain upgrade infrastructure. ([DUST sponsorship](https://midnight.network/blog/dust-sponsorship-on-midnight), [August network update](https://midnight.network/blog/state-of-the-network-august-2026))
- **Assessment:** Midnight is not blocked on the core privacy thesis or a live chain. It is blocked on smooth adoption: proof setup, wallet/connector fragmentation, DUST onboarding, version lockstep, gradual decentralization, and proving to users why a private transition is materially better than a normal server. This is an inference from current platform limitations and the stated rollout. ([Community wallet guide](https://docs.midnight.network/sdks/community/wallets/community-wallets-overview), [Compatibility matrix](https://docs.midnight.network/relnotes/support-matrix), [Midnight mainnet launch](https://midnight.network/blog/midnight-network-is-live))
- A founder-aligned hack should therefore make one privacy constraint causally useful, show what stays private versus public, finish the action end to end, and hide chain/gas/prover complexity from the product story. Midnight's own hackathon guidance says a simple, focused, functional, documented DApp can beat a complex unfinished one. ([How developers level up](https://midnight.network/blog/how-developers-level-up-with-the-midnight-network))

## B. The four tracks

Exact current track entry counts are not public before submission, so “most crowded” and “least crowded” are **UNVERIFIED**. The crowding calls below are evidence-based inferences, not entrant counts. ([Current Devpost](https://midnight-hackathon-august-2026.devpost.com/), [current event page](https://events.mlh.com/events/14510-midnight-hackathon))

| Track | What the sponsor actually wants | Named shapes | Weekend technical risk | Crowding inference |
| --- | --- | --- | --- | --- |
| AI | AI handles sensitive data on user terms while Midnight protects data or verifies behavior | Agent guardrails, private inference gating, ZK-backed claims about data access/checks | The proof becomes decorative if the protected action can bypass it; LLM output must be constrained before contract use | Likely most familiar/crowded because MidPilot is explicitly featured and July already produced Latch; **UNVERIFIED as entrant count**. ([Event page](https://events.mlh.com/events/14510-midnight-hackathon), [July winners](https://midnight.network/blog/celebrating-seven-winners-from-mlh-x-midnight-july-hack)) |
| Mobile | A native app or mobile-first PWA where raw sensitive data stays on device and only proof/attestation leaves | Identity/eligibility, payments/ticketing, health/fitness/location | On-device/extension wallet and prover integration, device storage, and one reliable demo device; not “iOS prior work” | Possibly less saturated but this is **UNVERIFIED**; Kuira/1AM make it technically real, not a reason to avoid it. ([Event page](https://events.mlh.com/events/14510-midnight-hackathon), [wallet guide](https://docs.midnight.network/sdks/community/wallets/community-wallets-overview)) |
| Integrate / Upgrade | Add a meaningful Midnight privacy feature to an existing app and show before/after | Private rental/job/loan checks, ZK login/KYC, confidential DeFi/votes/bids/game state | Prior-work disclosure and proving that Midnight changes the product rather than adding a badge | Likely approachable and therefore competitive; **UNVERIFIED as entrant count**. ([Event page](https://events.mlh.com/events/14510-midnight-hackathon), [Devpost requirements](https://midnight-hackathon-august-2026.devpost.com/)) |
| Cross-Chain | Midnight holds private logic/proofs while another ecosystem consumes the result | Hidden-state games, cross-chain attestations/identity, confidential-leg trading, monitors/explorers | Two chains, message finality, relayer/configuration, and a legible failure-safe demo multiply integration risk | Probably fewer complete builds but not necessarily fewer attempts; **UNVERIFIED**. VIA and EffectStream reduce plumbing but do not remove two-chain failure modes. ([Event page](https://events.mlh.com/events/14510-midnight-hackathon), [EffectStream](https://github.com/effectstream/effectstream), [August network update](https://midnight.network/blog/state-of-the-network-august-2026)) |

### Pressure test of candidate directions

| Direction | Existing Midnight evidence | Clear gap | Kill condition | Verdict |
| --- | --- | --- | --- | --- |
| Private agent spending guardrail | MidPilot provides AI copilot UX; Latch and Aegis already cover hidden budgets/policies. ([MidPilot](https://github.com/ANPAN27/MidPilot), [Latch](https://github.com/CipherCollective/Latch), [Aegis](https://github.com/1shanpanta/aegis)) | Make the proof cause an atomic contract-held payment, show exact balance movement and unchanged balances on attacks | If policy is checked in TypeScript and a separate wallet call can bypass it, it is not differentiated | **Best pick, but only in the contract-custody form now built.** ([Mandate architecture](https://github.com/lgoyal6/midnight-mandate/blob/main/docs/ARCHITECTURE.md)) |
| Private AI usage receipt | Hilo's ZK.LY used AI evaluation plus Midnight proof, and Omega built AI-data compliance attestations. ([Hilo winners](https://midnight.network/blog/hilo-hackathon-winners-keep-privacy-on-track-across-four-categories), [Omega](https://devpost.com/software/omega-dk7mc3)) | Bind a signed/model-provider receipt or TEE evidence to a narrow claim | Without a trustworthy model-execution input, it proves the app asserted a claim, not that the model behaved | **Weaker in a weekend unless a real attestation source already exists.** |
| Mobile private eligibility | Mobile track explicitly wants on-device identity/eligibility; Kuira and 1AM offer real mobile paths. ([Event page](https://events.mlh.com/events/14510-midnight-hackathon), [wallet guide](https://docs.midnight.network/sdks/community/wallets/community-wallets-overview)) | A crisp scan → local proof → verifier decision flow can be excellent | If wallet/prover/device bridging consumes the weekend before one proof works | **Good separate team idea; no arbitrary iOS/prior-work gate, but higher demo-integration risk than the already working Mandate path.** |
| Cross-chain private credential | VIA is live and the event recommends EffectStream; cross-chain attestation is a named example. ([Event page](https://events.mlh.com/events/14510-midnight-hackathon), [August network update](https://midnight.network/blog/state-of-the-network-august-2026)) | Show another chain actually accepting a Midnight-derived result | A mocked relay or two disconnected transactions will not prove the bridge | **High upside, highest weekend dependency risk.** |
| Private donation restrictions | DonorProof already won with restricted-donation accountability and beneficiary privacy. ([May gallery](https://midnight-hackathon-2026.devpost.com/project-gallery)) | Atomic custody/disbursement or selective auditor disclosure could deepen it | Repeating “prove funds used correctly” without real causal settlement is crowded | **Clear product value, insufficient novelty for this event without the atomic action layer.** |

## C. What judges reward

The current Devpost names the Midnight Foundation as judge and lists six criteria: **Technology, Originality, Execution, Completion, Documentation, and Business Value**. The page does not publish numeric weights, so equal weighting is **UNVERIFIED**; only the six names and descriptions are confirmed. ([Current Devpost judging section](https://midnight-hackathon-august-2026.devpost.com/))

| Criterion | Current wording distilled into a build check |
| --- | --- |
| Technology | Is the technical problem difficult, clever, or composed of meaningful components? ([Devpost](https://midnight-hackathon-august-2026.devpost.com/)) |
| Originality | Is the privacy/identity/security concept fresh, bold, or distinctive? ([Devpost](https://midnight-hackathon-august-2026.devpost.com/)) |
| Execution | Does the core DApp or UI feel polished? ([Devpost](https://midnight-hackathon-august-2026.devpost.com/)) |
| Completion | Is the focused scope demonstrably complete? ([Devpost](https://midnight-hackathon-august-2026.devpost.com/)) |
| Documentation | Can a developer understand the goal and reproduce it from a concise README? ([Devpost](https://midnight-hackathon-august-2026.devpost.com/)) |
| Business Value | Could it become a launchable product? ([Devpost](https://midnight-hackathon-august-2026.devpost.com/)) |

### What recent winners actually had in common

- **July MLH x Midnight:** winners used privacy primitives because the use case needed them, finished contract/tests/interface layers, made the use case understandable in one sentence, and—when possible—published deployment evidence. Moonray was highlighted as the most complete build with a working contract, real tests, finished UI, and playable Preprod deployment. ([July winner review](https://midnight.network/blog/celebrating-seven-winners-from-mlh-x-midnight-july-hack))
- **May MLH x Midnight:** the winning gallery includes Omega, Cocoa Monster, Veil Protocol, ShadowKey, ZK-Bingo, and DonorProof. Omega's writeup separates a built attestation primitive from future TEE/regulator work; Cocoa Monster exposes a live product and explicitly lists unfinished shielded/arbitration work. The useful pattern is a polished core plus honest claim boundaries, not claiming the roadmap as complete. ([May gallery](https://midnight-hackathon-2026.devpost.com/project-gallery), [Omega](https://devpost.com/software/omega-dk7mc3), [Cocoa Monster](https://devpost.com/software/cocoa-monster))
- **Hilo:** VaxZK won with a straightforward working implementation of a familiar privacy need; KAAMOS impressed with progress and market scale; ZK.LY's modular contract was praised but judges wanted clearer UI navigation and value proposition; AnchorZK aligned a large AI-provenance market with privacy-preserving metadata. ([Hilo winner review](https://midnight.network/blog/hilo-hackathon-winners-keep-privacy-on-track-across-four-categories))
- **Concrete demo pattern:** one sentence problem, one private/public boundary, one successful proof-backed action, one visible adversarial rejection, a clean README, and an honest next-step slide. Midnight's developer guidance explicitly says focused and functional beats complex and unfinished. ([How developers level up](https://midnight.network/blog/how-developers-level-up-with-the-midnight-network))

### Judge-readiness of Midnight Mandate

- Technology: the contract both checks a private policy and moves contract-held funds; the real proof is causal. ([Contract](https://github.com/lgoyal6/midnight-mandate/blob/main/contracts/mandate.compact), [architecture](https://github.com/lgoyal6/midnight-mandate/blob/main/docs/ARCHITECTURE.md))
- Originality: the category is not new, so differentiation depends on showing custody + atomic payment + cumulative policy + owner recovery versus nearby advisory-policy projects. ([README comparison](https://github.com/lgoyal6/midnight-mandate#why-this-is-different-from-nearby-midnight-work))
- Execution/completion: the two-minute path must show a real payment, two materially different cap failures, recipient/replay rejection, and optionally recovery—not spend time on setup screens. ([Demo runbook](https://github.com/lgoyal6/midnight-mandate/blob/main/docs/DEMO.md))
- Documentation/business: the public repo now has a one-command smoke test, setup/research/security docs, evidence, explicit limitations, and a product direction toward reusable private capabilities for agents. ([README](https://github.com/lgoyal6/midnight-mandate), [submission packet](https://github.com/lgoyal6/midnight-mandate/blob/main/SUBMISSION.md))

## D. Submission mechanics

The event deadline is Sunday, August 30, 2026 at 8:45 AM PT / 11:45 AM ET. ([MLH event schedule](https://events.mlh.com/events/14510-midnight-hackathon), [Devpost](https://midnight-hackathon-august-2026.devpost.com/))

The project-specific requirements appear on the Devpost **Overview**, while the **Rules** tab links the standard MLH hackathon rules and contest terms. This distinction matters because reading only `/rules` misses the video/repository/team requirements. ([Devpost overview](https://midnight-hackathon-august-2026.devpost.com/), [Devpost Rules tab](https://midnight-hackathon-august-2026.devpost.com/rules))

- Video: two minutes or less; created during the hackathon weekend; it must state the hackathon name at the beginning. ([Devpost overview](https://midnight-hackathon-august-2026.devpost.com/))
- Code/video: public repository required, and both repo and video must remain public after the event to retain prize eligibility. ([Devpost overview](https://midnight-hackathon-august-2026.devpost.com/))
- Registration: complete Devpost plus MLH event registration/check-in, with the same email across both. ([Devpost overview](https://midnight-hackathon-august-2026.devpost.com/))
- Team/project: maximum five members; solo is eligible; one project per team; the project cannot be submitted to another hackathon. ([Devpost overview](https://midnight-hackathon-august-2026.devpost.com/))
- Prior work: “You may not submit projects that include prior work, unless you are submitting to the \"Integrate Midnight\" track and specifiy what was completed beforehand.” ([Devpost overview](https://midnight-hackathon-august-2026.devpost.com/))

The Integrate track says, “You don't have to start from zero. Take an app that already exists, your side project, an open-source app, a web2 product clone,” then asks the team to add Midnight privacy and show the before/after. ([Event page](https://events.mlh.com/events/14510-midnight-hackathon))

**How to read the two together:** new-project tracks cannot import team prior work; Integrate is the narrow exception, not a contradiction. In Integrate, disclose what predates the event, build the Midnight feature during the event, and make the before/after legible. Mandate is new event-window work and therefore does not depend on this exception. ([Devpost overview](https://midnight-hackathon-august-2026.devpost.com/), [event page](https://events.mlh.com/events/14510-midnight-hackathon), [Mandate provenance](https://github.com/lgoyal6/midnight-mandate/blob/main/UPSTREAM.md))

### Full current prize list

There are five prize categories—AI, Mobile, Integrate Midnight, Cross-Chain, and Best Beginner Hack—with one winner in each; every winning team member receives a $125 digital gift card. ([Current Devpost prizes](https://midnight-hackathon-august-2026.devpost.com/), [event page](https://events.mlh.com/events/14510-midnight-hackathon))

The current prize section does **not** offer Build Club, a fellowship, or an accelerator invitation. The May edition did advertise a Build Club invitation and potential Midnight Accelerator path, which is likely the source of the confusion, but that benefit is absent from the August prize list. ([Current Devpost](https://midnight-hackathon-august-2026.devpost.com/), [May Devpost](https://midnight-hackathon-2026.devpost.com/))

The exact supplied requirement text is preserved in [`submission_req.md`](submission_req.md).

## E. Build-related open questions only

Ask these in `#mlh-hackers` only if the answer changes an action; the [event Discord link](https://mlh.link/midnight-discord) points to the Midnight Discord.

1. Does the August judging team give any scoring advantage for Preprod, or is a reproducible real proof/transaction on `undeployed` fully equivalent for Completion? July guidance says local is expected, but this answer determines whether a teammate should spend time funding the Preprod wallet. ([July winner review](https://midnight.network/blog/celebrating-seven-winners-from-mlh-x-midnight-july-hack))
2. For the AI track, is private-policy enforcement with intentionally public unshielded settlement within the intended “Midnight proves the rules were followed” scope? This determines wording, not the implementation. ([AI track](https://events.mlh.com/events/14510-midnight-hackathon))
3. If the team wants a browser-wallet bonus after recording, which wallet/connector/version will judges use for testing this weekend? The current documented implementations have different proving capabilities. ([Community wallet guide](https://docs.midnight.network/sdks/community/wallets/community-wallets-overview))

No other unresolved research question currently blocks the build, recording, or submission.

## Primary-source and link audit

### Current required sources

- Event page: [Midnight Hackathon](https://events.mlh.com/events/14510-midnight-hackathon).
- Devpost overview/judges/prizes: [August 2026 Devpost](https://midnight-hackathon-august-2026.devpost.com/); separate [Rules](https://midnight-hackathon-august-2026.devpost.com/rules) and [Resources](https://midnight-hackathon-august-2026.devpost.com/resources) pages were checked.
- Core docs and developer material: [Midnight docs](https://mlh.link/midnight-docs), [developer hub](https://mlh.link/midnight-for-devs), [Midnight Academy](https://mlh.link/midnight-academy), and [Midnight Expert](https://mlh.link/midnight-expert).
- Community/platform resources: [Discord](https://mlh.link/midnight-discord), [mobile tooling](https://mlh.link/midnight-mobile), [ecosystem catalog](https://mlh.link/midnight-catalog), [EffectStream](https://mlh.link/effect-stream), [VIA Labs demo](https://mlh.link/VIA-labs-demo), and [AI inspiration](https://mlh.link/midnight-ai-inspo).
- Reference DApps: [midnight-awesome-dapps](https://github.com/midnightntwrk/midnight-awesome-dapps) and [MidPilot](https://github.com/ANPAN27/MidPilot).

### Earlier-edition links

None of the seven earlier MLH shortlinks returned a 404 on 2026-08-29. Each MLH page returned HTTP 200 and contained a redirect; the six docs destinations returned HTTP 429 when immediately bulk-rechecked, so destination availability in that burst is marked **UNVERIFIED**, not called broken.

| Earlier link | Redirect found in MLH page | Result |
| --- | --- | --- |
| [Installation guide](https://mlh.link/midnight-hackathon-installation-guide) | `https://docs.midnight.network/getting-started/installation` | Shortlink 200; no 404; target recheck rate-limited |
| [Example repo](https://mlh.link/midnight-hackathon-example-repo) | `https://docs.midnight.network/develop/tutorial/building/examples-repo` | Shortlink 200; no 404; target recheck rate-limited |
| [Technology overview](https://mlh.link/midnight-hackathon-tech-overview) | `https://docs.midnight.network/learn/understanding-midnights-technology` | Shortlink 200; no 404; target recheck rate-limited |
| [Compact reference](https://mlh.link/midnight-hackathon-compact-reference-doc) | `https://docs.midnight.network/develop/reference/compact/lang-ref` | Shortlink 200; no 404; target recheck rate-limited |
| [DApp Connector](https://mlh.link/midnight-hackathon-dapp-connector) | `https://docs.midnight.network/develop/reference/midnight-api/dapp-connector` | Shortlink 200; no 404; target recheck rate-limited |
| [Midnight.js](https://mlh.link/midnight-hackathon-js) | `https://docs.midnight.network/develop/reference/midnight-api/midnight-js` | Shortlink 200; no 404; target recheck rate-limited |
| [Community hub](https://mlh.link/midnight-hackathon-community-hub) | `https://github.com/midnightntwrk/community-hub` | Shortlink 200; target 200 |
