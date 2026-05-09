# Browser Harness

D3 browser cockpit for the ZAP x402 oracle scenario.

```bash
bun run harness
```

That command builds the browser app, serves it at `http://localhost:5174`, and
streams claim work into the graph over Server-Sent Events from `/events`. The
browser auto-scans every 3 minutes; set `ZAP_HARNESS_AUTO_RUN_MS` to change the
cadence.

For frontend-only iteration without the live stream:

```bash
bun run browser
```

The app reads the 50-claim scenario from [../../claims/x402-fifty-claims.json](../../claims/x402-fifty-claims.json), visualizes claim routing through x402 and oracle workers, and can toggle verbose generated receipt output. If `/events` is unavailable, the Run button falls back to an in-browser simulation so D3 work can continue under Vite.

The reusable event/state model lives in [src/harness-model.ts](src/harness-model.ts). [src/main.ts](src/main.ts) owns the D3 graph, DOM rendering, SSE wiring, and user controls.
