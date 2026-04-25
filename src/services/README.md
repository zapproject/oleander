# services

Effect services for the ZAP Witness Council harness.

## Service Map

- [config.ts](config.ts): reads runtime config, DeepSeek key path, witness filters, and schedule settings.
- [deepseek.ts](deepseek.ts): shared DeepSeek Pro client plus mock/smoke behavior.
- [claim-feed.ts](claim-feed.ts): strict JSON claim feed parser.
- [validator.ts](validator.ts): typed claim and response validation boundary.
- [openclaw.ts](openclaw.ts): agentic witness planning, model assessment, validated observation construction.
- [evidence.ts](evidence.ts): HTTP, price-feed, and hash-document evidence normalization.
- [signer.ts](signer.ts): deterministic dev signing and verification boundary.
- [gossip.ts](gossip.ts): append-only CRDT-style message set for signed oracle messages.
- [oracle.ts](oracle.ts): optimistic oracle reducer for request/propose/dispute/settle.
- [scheduler.ts](scheduler.ts): cron-style witness schedule and daemon loop support.
- [council.ts](council.ts): council role execution over claims.
- [economy.ts](economy.ts): work receipts, stablecoin bounty receipts, ZAP reward receipts, burn/treasury policy.
- [adversarial.test.ts](adversarial.test.ts): integrated adversarial coverage.

## Boundaries

```text
Evidence service
  fetches and normalizes source material

OpenCLAW
  plans, asks DeepSeek, builds candidate observations

Validator
  rejects invalid claims/responses before signing

Signer
  signs canonical observation payloads

Gossip
  converges signed messages, does not decide truth

Oracle reducer
  derives proposal, dispute, or settlement state

Economy
  accounts for verifiable work, not truth
```

Tests live beside each service as `*.test.ts`. Run all checks from the repo root:

```bash
bun run typecheck
bun test
bun run build
```
