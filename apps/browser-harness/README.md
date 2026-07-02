# Browser Harness

D3 browser cockpit for the ZAP x402 oracle scenario.

## Run It

```bash
bun run harness
```

That command builds the browser app, serves it at `http://localhost:5174`, and
streams claim work into the graph over Server-Sent Events from `/engine-events`.
The stream is the same shared harness event spine used by headless runs, saved
artifacts, replay, and OUSD budget accounting. The browser auto-scans every 3
minutes; set `ZAP_HARNESS_AUTO_RUN_MS` to change the cadence.

```mermaid
flowchart LR
  command["bun run harness"] --> build["vite build apps/browser-harness"]
  build --> server["oleander harness serve"]
  server --> browser["http://localhost:5174"]
  browser --> engine["/engine-events?regime=selected"]
  engine --> model["browser event model"]
  model --> graph["D3 network graph"]
  model --> balances["OUSD balances"]
  model --> receipts["receipts and event timeline"]
  browser -. fallback .-> legacy["/events"]
  legacy -. fallback .-> simulation["in-browser simulation"]
```

For frontend-only iteration without the live stream:

```bash
bun run browser
```

The app reads the 50-claim scenario from [../../claims/x402-fifty-claims.json](../../claims/x402-fifty-claims.json), visualizes claim routing through x402 and oracle workers, and can toggle verbose generated receipt output. It renders sponsor funded OUSD, sponsor remaining OUSD, and witness OUSD earnings from engine `balance_changed` events. If `/engine-events` is unavailable, the Run button tries the compatibility `/events` stream before falling back to an in-browser simulation so D3 work can continue under Vite.

The reusable event/state model lives in [src/harness-model.ts](src/harness-model.ts). [src/main.ts](src/main.ts) owns the D3 graph, DOM rendering, SSE wiring, and user controls.
