# claims

Typed claim feeds for the witness harness.

## Files

- [demo.json](demo.json): initial stablecoin claim pack.
- [x402-mock.json](x402-mock.json): small mock x402-funded work claim pack.
- [x402-ten-claims.json](x402-ten-claims.json): 10 sponsored claims for the full sponsor/oracle incentive run.
- [x402-fifty-claims.json](x402-fifty-claims.json): 50 sponsored claims for larger regime and incentive runs.

## Current Demo Claims

- `claim:stablecoin:usdc-demo-001`
  - kind: `yes_no`
  - purpose: peg-status workflow

- `claim:stablecoin:reserve-attestation-demo-001`
  - kind: `hash_attestation`
  - purpose: reserve-attestation workflow

These claims intentionally return `no_answer_possible` until stronger evidence adapters and claim-specific source metadata are added. That is expected behavior: the harness should not assert truth when the claim does not provide enough verifiable evidence.

## Feed Requirements

Each claim must include:

```json
{
  "id": "claim:domain:name",
  "kind": "yes_no",
  "domain": "stablecoins",
  "statement": "Human-readable typed assertion.",
  "sources": ["https://example.com/source"],
  "livenessSeconds": 300
}
```

Supported kinds:

```text
yes_no
uint32_multi_value
scalar_int
categorical
hash_attestation
```
