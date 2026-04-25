# Oleander

Oleander is the first CLI harness for the ZAP Witness Council.

The harness runs agentic witnesses over typed claim feeds using TypeScript and Effect services. DeepSeek is used through one shared API-key service; the key is read from `DEEPSEEK_API_KEY` or a local key file such as `../deepseek.md`.

## Commands

```bash
bun install
bun run build
bun run dev -- claims list
bun run dev -- roles list
bun run dev -- council --once
bun run dev -- council --role law --once
bun run dev -- run --once
```

Docker testbed:

```bash
docker compose up --build
```

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
