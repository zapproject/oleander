# src

This folder contains the ZAP Witness Council CLI application.

## Key Files

- [cli.ts](cli.ts): command routing for the default Oleander UI, saved-run replay, headless JSON/NDJSON runs, `claims`, `council`, and DeepSeek smoke checks.
- [domain.ts](domain.ts): shared protocol types for claims, observations, evidence, council roles, and responses.
- [runtime.ts](runtime.ts): Effect layer composition for the application services.
- [services](services/README.md): service implementations and tests.

## Runtime Shape

```text
cli.ts
  -> runtime.ts
  -> services/*
  -> domain.ts types
```

Keep CLI code thin. Protocol behavior belongs in services, and shared shapes belong in [domain.ts](domain.ts).
