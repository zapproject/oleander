# Production Boundaries

Oleander defaults to a local harness. These defaults are useful for repeatable witness demos, but they are not production adapters.

## Runtime Mode

Local mode is the default:

```bash
ZAP_RUNTIME_MODE=local
```

Production intent must be explicit:

```bash
ZAP_RUNTIME_MODE=production
ZAP_SIGNER_MODE=production
X402_MODE=production
DEEPSEEK_MOCK=0
```

`ConfigLive` rejects production runtime when mock/dev boundaries are still enabled. `SignerLive` also rejects `ZAP_SIGNER_MODE=production` because the current implementation is a deterministic development signer.

## Adapter Replacement Points

| Boundary | Local implementation | Production requirement |
| --- | --- | --- |
| Signing | `SignerLive` HMAC signer scoped by `ZAP_NODE_ID` | Wallet, KMS, or node-key signer behind the same `Signer` service |
| x402 facilitator | `x402-mock-server.ts` facilitator endpoints | Real x402 facilitator SDK/API for payment creation, verification, and settlement |
| x402 resource | mock `X-PAYMENT` header check | Signed payment payload validation and facilitator settlement before resource access |
| Work payout | mock wallet address in `x402-work.ts` | Sponsor-funded payout address and settlement receipt from the real payment rail |
| ZAP reward | local accounting receipt | Token/reputation reward adapter governed by council policy |
| Model provider | `DEEPSEEK_MOCK=1` deterministic local response | Live provider key, model, timeout, retry, and failure policy |

## Guardrails

Production runtime must not use:

- `DEEPSEEK_MOCK=1`
- `ZAP_SIGNER_MODE=dev`
- `X402_MODE=mock`
- `X402_PAYMENT_HEADER=mock-paid`

The current code intentionally does not provide a production signer. That keeps production mode from silently using deterministic development signatures.

## Local Harness

The local x402 scenario remains mock-first:

```bash
./scripts/test-x402-mock.sh
bun run dev -- x402 scenario
bun run dev -- x402 work --once
```

Those commands are valid for demos and regression checks. They prove claim parsing, evidence normalization, response validation, signing shape, gossip/oracle accounting, and receipt generation, not real payment settlement.
