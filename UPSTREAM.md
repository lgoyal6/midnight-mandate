# Upstream and provenance

This repository was created during the Midnight Hackathon event window on 2026-08-29 PDT.

The project implementation is original event-window work. It uses these official vendor sources as attributed references and setup scaffolding:

- [`midnightntwrk/example-hello-world`](https://github.com/midnightntwrk/example-hello-world) commit `67b8c9a0c76eebadfcc6d2de638dae21a20fb2fc`: wallet/provider setup and pinned local Docker stack.
- [`midnightntwrk/passport-demo`](https://github.com/midnightntwrk/passport-demo) commit `1b6987561bdfd2b16c4d2e7ef0b48eedffdbf43d`: contract-custody patterns for `receiveUnshielded`, `sendUnshielded`, simulator construction, and wallet address encoding.
- [Midnight token-transfer examples](https://docs.midnight.network/examples/contracts/token-transfers) and [security guidance](https://docs.midnight.network/guides/security-best-practices): persistent commitments and unshielded contract transfers.

The upstream repositories were used as references; their application source trees were not copied into this project. Package dependencies remain under their own licenses.

No pre-event team project source was copied into this repository. Generated Compact artifacts are reproducible and intentionally ignored by Git.
