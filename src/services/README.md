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
- [run-artifact.ts](run-artifact.ts): structured JSON artifact writer for harness and x402 runs.
- [tui-harness.ts](tui-harness.ts): terminal controller/renderer for the sponsored x402 oracle run.
- [tui-harness-core.ts](tui-harness-core.ts): pure TUI harness steps, regimes, state helpers, and output summaries.
- [tui-harness-process.ts](tui-harness-process.ts): process adapter for Docker-backed TUI harness steps.
- [x402-scenario.ts](x402-scenario.ts): mock x402 funding, staking, payment, and council incentive receipts.
- [x402-mock-server.ts](x402-mock-server.ts): Paybot-style mock facilitator and protected claim resource.
- [x402-work.ts](x402-work.ts): converts signed oracle observations into sponsor-funded payout and reward receipts.
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
