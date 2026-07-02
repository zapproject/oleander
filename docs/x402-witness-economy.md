# x402 Witness Economy

ZAP should treat x402 as the HTTP-native stablecoin payment rail, not as the oracle truth layer.

## Current x402 Assumption

Coinbase describes x402 as an open payment protocol using HTTP `402 Payment Required` for automatic stablecoin payments. A buyer requests a resource, the server returns payment requirements, the client sends a signed payment payload, and the server verifies/settles through a facilitator before returning the resource.

In ZAP:

```text
x402 pays for access and completed work
ZAP staking/reputation qualifies and ranks witnesses
typed claims and oracle reducer decide truth state
Council governs incentives, not truth
```

## Who Funds What

```text
Claim Sponsor
  funds OUSD bounty supply through x402 payment requirements
  examples: stablecoin protocol, data buyer, treasury, risk desk

Witness Worker
  stakes ZAP or reputation to qualify for claim work
  earns OUSD for accepted work receipts
  earns ZAP for quality, uptime, amplification, valid disputes

Disputer
  stakes ZAP dispute bond
  earns when a dispute is valid

Council
  sets weights, burn policy, treasury policy, eligibility policy
  does not decide claim truth

x402 Facilitator
  verifies and settles stablecoin payments
  may receive facilitator fee depending on provider/config
```

## Mock Scenario

Run the local x402 witness work scenario:

```bash
./scripts/test-x402-mock.sh
```

Services:

```text
x402-facilitator
  mock facilitator with /payments/create, /verify, /settle, /health

x402-resource
  protected claim feed resource; returns HTTP 402 unless X-PAYMENT is present

x402-scenario
  prints the funding/staking/payment scenario

sponsor-feed
  fetches the typed x402 mock claim feed through the paid resource path

witness-peg
  works stablecoin peg yes/no claims and emits incentive receipts

witness-attestation
  works reserve hash-attestation claims and emits incentive receipts

witness-availability
  works paid endpoint availability claims and emits incentive receipts
```

All worker services run in mock model mode. They still execute the real claim feed, evidence normalization, validation, signing, work receipt, OUSD bounty receipt, and ZAP reward receipt path.

The mock follows the Paybot-style compose story: facilitator service, protected resource service, client workers, and a shared Docker network. The mock `X-PAYMENT` header stands in for a real signed x402 payment payload until the real SDK/facilitator integration is added.

The default script uses [claims/x402-fifty-claims.json](../claims/x402-fifty-claims.json), which gives the sponsor 50 paid claims and routes them to the matching oracle workers.

See [production-boundaries.md](production-boundaries.md) for the explicit mock-to-real replacement points and production runtime guardrails.
