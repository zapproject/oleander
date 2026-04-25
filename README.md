# Oleander

Oleander is the first CLI harness for the ZAP Witness Council.

The harness runs agentic witnesses over typed claim feeds using TypeScript and Effect services. DeepSeek is used through one shared API-key service; the key is read from `DEEPSEEK_API_KEY` or a local key file such as `../deepseek.md`. Set `DEEPSEEK_MOCK=1` to exercise the CLI without live model calls.

## Start Here

- [src](src/README.md): CLI entrypoint, shared domain types, and Effect runtime wiring.
- [src/services](src/services/README.md): Witness Council services, oracle reducer, gossip set, evidence adapters, economy receipts, and tests.
- [claims](claims/README.md): Typed demo claim feed for stablecoin work.
- [docs/x402-witness-economy.md](docs/x402-witness-economy.md): x402 payment/staking plan and mock scenario.
- [Dockerfile](Dockerfile): Bun container image for witness clients.
- [docker-compose.yml](docker-compose.yml): Local multi-witness harness.
- [docker-compose.x402-mock.yml](docker-compose.x402-mock.yml): Mock x402-funded work scenario.
- [.env.example](.env.example): Runtime config surface.

## Commands

```bash
bun install
bun run build
bun test
bun run dev -- claims list
bun run dev -- deepseek smoke
bun run dev -- roles list
bun run dev -- x402 scenario
bun run dev -- council hello
bun run dev -- council --once
bun run dev -- council --role law --once
bun run dev -- run --once
bun run dev -- run --daemon --ticks 1
```

Docker testbed:

```bash
docker compose up --build
```

x402 mock work scenario:

```bash
docker compose -f docker-compose.x402-mock.yml up --build
```

## Architecture

```text
zap CLI
  -> claim feed
  -> scheduled witness runtime
  -> OpenCLAW evidence and model workflow
  -> typed validator
  -> signer
  -> gossip evidence set
  -> optimistic oracle reducer
  -> work and reward receipts
```

The important rule: gossip converges signed evidence, OpenCLAW gathers and critiques, the validator enforces typed boundaries, and the oracle reducer derives proposal/dispute/settlement state.

## Council Roles

```text
High Witness      protocol architecture
Law Witness       claim schemas
Cut Witness       deterministic validation
Signal Witness    gossip / CRDT readiness
Forge Witness     runtime packaging
Fault Witness     adversarial validation
Research Witness  OpenCLAW evidence work
Gate Witness      admission control
```

## Boundary

DeepSeek can help each witness analyze claims and produce structured observations. The protocol boundary still lives in typed claim validation, signed observations, explicit disputes, and deterministic reducers.

## Signing Boundary

The current signer is a deterministic development signer scoped by `ZAP_NODE_ID`. It is suitable for local harness work and reproducible tests. Production signing should replace `SignerLive` behind the same Effect service boundary with wallet, KMS, or node-key signing; observation payload shape should remain canonical so signatures stay auditable.

## Witness Economy Boundary

Stablecoins pay for completed oracle work. ZAP accounts for utility, staking, reputation, amplification, and council-governed incentives. Rewards must derive from verifiable work receipts such as signed observations, valid disputes, availability proofs, or quality/amplification receipts. The Council governs incentive policy; typed claims and the oracle reducer govern truth.

## Current Capstone Slice

The current repo proves the local client harness:

- Bun + Effect TS CLI
- DeepSeek Pro council activity check
- typed claim feed and validator
- OpenCLAW observation runtime
- normalized evidence adapters
- deterministic dev signing
- append-only gossip/CRDT-style message set
- optimistic oracle reducer
- scheduled witness loop
- adversarial validation suite

Run `bun test` for the fastest confidence check.
