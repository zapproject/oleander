import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseClaimFeed } from "./claim-feed.js";

export interface X402ServerOptions {
  readonly port: number;
  readonly claimFeedPath: string;
  readonly paymentHeader: string;
}

const json = (value: unknown, init?: ResponseInit): Response =>
  new Response(JSON.stringify(value, null, 2), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {})
    }
  });

const readClaims = (path: string) =>
  parseClaimFeed(readFileSync(resolve(process.cwd(), path), "utf8"));

export const serveX402FacilitatorMock = (port: number) => {
  Bun.serve({
    port,
    fetch: async (request) => {
      const url = new URL(request.url);
      if (url.pathname === "/health") {
        return json({ ok: true, service: "zap-x402-facilitator-mock" });
      }
      if (url.pathname === "/verify" || url.pathname === "/settle") {
        const body = await request.json().catch(() => ({})) as { payment?: string };
        if (!body.payment) return json({ ok: false, error: "Missing payment" }, { status: 400 });
        return json({
          ok: true,
          payment: body.payment,
          txHash: `0x${"a".repeat(64)}`,
          network: "mock-base",
          asset: "OUSD"
        });
      }
      if (url.pathname === "/payments/create") {
        return json({
          payment: "mock-paid",
          amountAtomic: "1000000",
          asset: "OUSD",
          network: "mock-base",
          expiresInSeconds: 300
        });
      }
      return json({ error: "Not found" }, { status: 404 });
    }
  });
  console.log(`x402 facilitator mock listening on :${port}`);
};

export const serveX402ResourceMock = (options: X402ServerOptions) => {
  Bun.serve({
    port: options.port,
    fetch: async (request) => {
      const url = new URL(request.url);
      if (url.pathname === "/health") {
        return json({ ok: true, service: "zap-x402-resource-mock" });
      }
      if (url.pathname === "/claims") {
        const payment = request.headers.get("X-PAYMENT");
        if (payment !== options.paymentHeader) {
          return json(
            {
              error: "Payment required",
              accepts: [
                {
                  scheme: "exact",
                  network: "mock-base",
                  asset: "OUSD",
                  amountAtomic: "1000000",
                  payTo: "zap-claim-sponsor",
                  resource: "/claims"
                }
              ]
            },
            {
              status: 402,
              headers: {
                "PAYMENT-REQUIRED": "mock-paid"
              }
            }
          );
        }
        return json(readClaims(options.claimFeedPath));
      }
      return json({ error: "Not found" }, { status: 404 });
    }
  });
  console.log(`x402 resource mock listening on :${options.port}`);
};
