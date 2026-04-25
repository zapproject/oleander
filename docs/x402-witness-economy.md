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
  funds USDC bounty supply through x402 payment requirements
  examples: stablecoin protocol, data buyer, treasury, risk desk

Witness Worker
  stakes ZAP or reputation to qualify for claim work
  earns USDC for accepted work receipts
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
docker compose -f docker-compose.x402-mock.yml up --build
```

Services:

```text
x402-scenario
  prints the funding/staking/payment scenario

sponsor-feed
  publishes the typed x402 mock claim feed

witness-peg
  works stablecoin peg yes/no claims

witness-attestation
  works reserve hash-attestation claims

witness-availability
  works paid endpoint availability claims
```

All worker services run in mock model mode. They still execute the real claim feed, evidence normalization, validation, signing, and scheduled witness path.
