# Midnight Mandate

Private spending rules. Atomic agent payments.

Midnight Mandate is a contract-custodied NIGHT vault. An AI agent may propose a payment, but the contract sends funds only when the same Compact circuit proves that the exact amount and recipient satisfy a privately committed mandate.

Status: active event-window build. Do not treat unverified roadmap claims as implemented behavior.

## Current verification targets

1. Compile the Compact contract.
2. Pass policy, custody, replay, and rejection simulator tests.
3. Move real local test NIGHT through a proved `agent_pay` transaction.
4. Reproduce the full story with `yarn demo:smoke`.

## Development

```bash
yarn install --frozen-lockfile
yarn compile
yarn test:contract
yarn demo:smoke
```

See [UPSTREAM.md](UPSTREAM.md) for attribution and event-window provenance.

