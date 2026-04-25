import { describe, expect, test } from "bun:test";
import { Effect, Layer } from "effect";
import { ConfigService, type AppConfig } from "./config.js";
import { Signer, SignerLive, stableJson } from "./signer.js";

const config = (nodeId: string): AppConfig => ({
  nodeId,
  claimFeedPath: "claims/demo.json",
  witnessDomain: undefined,
  witnessKinds: undefined,
  claimScanCron: "*/2 * * * *",
  livenessWatchCron: "*/1 * * * *",
  claimScanIntervalMs: 120000,
  x402PaymentHeader: undefined,
  deepseekApiKey: undefined,
  deepseekBaseUrl: "https://api.deepseek.com",
  deepseekModel: "deepseek-v4-pro",
  deepseekMock: true
});

const signWith = (nodeId: string, payload: unknown) =>
  Effect.runPromise(
    Effect.provide(
      Effect.gen(function* () {
        const signer = yield* Signer;
        return yield* signer.sign(payload);
      }),
      SignerLive.pipe(Layer.provide(Layer.succeed(ConfigService, config(nodeId))))
    )
  );

describe("stableJson", () => {
  test("canonicalizes object key order", () => {
    expect(stableJson({ b: 2, a: 1 })).toBe(stableJson({ a: 1, b: 2 }));
  });

  test("preserves array order", () => {
    expect(stableJson([2, 1])).not.toBe(stableJson([1, 2]));
  });
});

describe("Signer", () => {
  test("signs deterministically for equivalent payloads", async () => {
    const first = await signWith("node-a", { b: 2, a: 1 });
    const second = await signWith("node-a", { a: 1, b: 2 });
    expect(first).toBe(second);
  });

  test("node identity changes dev signature domain", async () => {
    const first = await signWith("node-a", { claimId: "claim:test:1" });
    const second = await signWith("node-b", { claimId: "claim:test:1" });
    expect(first).not.toBe(second);
  });

  test("verifies matching dev signature", async () => {
    const payload = { claimId: "claim:test:1" };
    const signature = await signWith("node-a", payload);
    const verified = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* () {
          const signer = yield* Signer;
          return yield* signer.verify(payload, signature);
        }),
        SignerLive.pipe(Layer.provide(Layer.succeed(ConfigService, config("node-a"))))
      )
    );

    expect(verified).toBe(true);
  });
});
