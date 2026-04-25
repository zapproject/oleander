import { describe, expect, test } from "bun:test";
import { Effect, Layer } from "effect";
import type { ClaimSpec, Observation } from "../domain.js";
import { parseClaimFeed } from "./claim-feed.js";
import { createGossipStore } from "./gossip.js";
import { reduceOracle } from "./oracle.js";
import { ConfigService, type AppConfig } from "./config.js";
import { Signer, SignerLive } from "./signer.js";
import { Validator, ValidatorLive } from "./validator.js";

const claim: ClaimSpec = {
  id: "claim:test:adversarial",
  kind: "yes_no",
  domain: "stablecoins",
  statement: "A stablecoin remained inside configured tolerance.",
  sources: ["https://example.com"],
  livenessSeconds: 60
};

const config: AppConfig = {
  nodeId: "node-a",
  claimFeedPath: "claims/demo.json",
  witnessDomain: undefined,
  witnessKinds: undefined,
  claimScanCron: "*/2 * * * *",
  livenessWatchCron: "*/1 * * * *",
  claimScanIntervalMs: 120000,
  deepseekApiKey: undefined,
  deepseekBaseUrl: "https://api.deepseek.com",
  deepseekModel: "deepseek-v4-pro",
  deepseekMock: true
};

const observation = (nodeId: string, value: boolean, signature = `${nodeId}-sig`): Observation => ({
  claimId: claim.id,
  witnessRole: "research",
  nodeId,
  response: { type: "yes_no", value },
  confidence: 0.5,
  evidence: [{ uri: "https://example.com", note: "http ok sha256:a" }],
  rationale: "test",
  observedAt: "2026-01-01T00:00:00.000Z",
  signature
});

describe("adversarial validation", () => {
  test("malformed claim feed is rejected", () => {
    expect(() => parseClaimFeed('[{"id":"claim:bad","kind":"free_text"}]')).toThrow("field 'kind' is unsupported");
  });

  test("invalid dev signature is rejected", async () => {
    const verified = await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* () {
          const signer = yield* Signer;
          return yield* signer.verify({ claimId: claim.id }, "bad-signature");
        }),
        SignerLive.pipe(Layer.provide(Layer.succeed(ConfigService, config)))
      )
    );

    expect(verified).toBe(false);
  });

  test("conflicting observations create dispute", () => {
    const reduced = reduceOracle(
      claim,
      [observation("node-a", true), observation("node-b", false)],
      new Date("2026-01-01T00:00:30.000Z")
    );

    expect(reduced.state).toBe("disputed");
  });

  test("dishonest witness cannot overwrite honest state", async () => {
    const store = createGossipStore();
    await Effect.runPromise(store.publishObservation(observation("honest", true, "honest-sig")));
    await Effect.runPromise(store.publishObservation(observation("dishonest", false, "dishonest-sig")));

    const snapshot = await Effect.runPromise(store.snapshot);
    expect(snapshot.messages).toHaveLength(2);
  });

  test("too_early and no_answer_possible remain valid special paths", async () => {
    await Effect.runPromise(
      Effect.provide(
        Effect.gen(function* () {
          const validator = yield* Validator;
          yield* validator.validateResponse(claim, { type: "too_early", reason: "market still open" });
          yield* validator.validateResponse(claim, { type: "no_answer_possible", reason: "source unavailable" });
        }),
        ValidatorLive
      )
    );
  });
});
