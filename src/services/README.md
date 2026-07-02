# services

Effect services for the ZAP Witness Council harness.

## Service Map

- [config.ts](config.ts): reads runtime config, DeepSeek key path, witness filters, and schedule settings.
- [deepseek.ts](deepseek.ts): shared DeepSeek Pro client plus mock/smoke behavior.
- [claim-feed.ts](claim-feed.ts): strict JSON claim feed parser.
- [validator.ts](validator.ts): typed claim and response validation boundary.
- [tool-call-witness.ts](tool-call-witness.ts): agentic witness planning, model assessment, validated observation construction.
- [evidence.ts](evidence.ts): HTTP, price-feed, and hash-document evidence normalization.
- [signer.ts](signer.ts): deterministic dev signing and verification boundary.
- [gossip.ts](gossip.ts): append-only CRDT-style message set for signed oracle messages.
- [oracle.ts](oracle.ts): optimistic oracle reducer for request/propose/dispute/settle.
- [scheduler.ts](scheduler.ts): cron-style witness schedule and daemon loop support.
- [council.ts](council.ts): council role execution over claims.
- [economy.ts](economy.ts): work receipts, stablecoin bounty receipts, ZAP reward receipts, burn/treasury policy.
- [harness-balances.ts](harness-balances.ts): pure OUSD balance reducer over harness events for sponsor budgets and witness earnings.
- [harness-events.ts](harness-events.ts): shared typed event contract and ordering checks for UI, artifacts, replay, and run engines.
- [harness-run-engine.ts](harness-run-engine.ts): minimal event-driven local run engine for witness observations, gossip, oracle reductions, OUSD receipts, and balances.
- [run-artifact.ts](run-artifact.ts): structured JSON artifact writer, verifier, and harness-event replay parser for saved runs.
- [ui-cockpit-state.ts](ui-cockpit-state.ts): pure UI cockpit reducer over harness events for claims, witnesses, proposals, balances, selection, and failures.
- [ui-cockpit-renderer.ts](ui-cockpit-renderer.ts): pure text renderer for the standalone Oleander network cockpit.
- [ui-scenario.ts](ui-scenario.ts): terminal controller/renderer for the sponsored x402 oracle run.
- [ui-scenario-core.ts](ui-scenario-core.ts): pure UI harness steps, regimes, state helpers, and output summaries.
- [ui-scenario-process.ts](ui-scenario-process.ts): process adapter for Docker-backed UI harness steps.
- [x402-scenario.ts](x402-scenario.ts): mock x402 funding, staking, payment, and council incentive receipts.
- [x402-mock-server.ts](x402-mock-server.ts): Paybot-style mock facilitator and protected claim resource.
- [x402-work.ts](x402-work.ts): converts signed oracle observations into sponsor-funded payout and reward receipts.
- [adversarial.test.ts](adversarial.test.ts): integrated adversarial coverage.

## Boundaries

```text
Evidence service
  fetches and normalizes source material

DeepSeek tool-call witness
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
