import { describe, expect, test } from "bun:test";
import { Effect, Layer } from "effect";
import type { ClaimSpec, WitnessRole } from "../domain.js";
import { ConfigService, type AppConfig } from "./config.js";
import { DeepSeek } from "./deepseek.js";
import { Evidence } from "./evidence.js";
import { OpenClaw, OpenClawLive, responseFromModel } from "./openclaw.js";
import { SignerLive } from "./signer.js";
import { ValidatorLive } from "./validator.js";

const claim: ClaimSpec = {
  id: "claim:test:openclaw",
  kind: "yes_no",
  domain: "stablecoins",
  statement: "USDC stayed within configured tolerance for the observation window.",
  sources: ["https://example.com/usdc"],
  livenessSeconds: 60
};

const role: WitnessRole = {
  id: "research",
  title: "Research Witness",
  responsibility: "Evaluate evidence collection strategy through OpenCLAW."
};

const config: AppConfig = {
  runtimeMode: "local",
  nodeId: "test-node",
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
  deepseekMock: true,
  signerMode: "dev",
  x402Mode: "mock"
};

const runOpenClaw = <A>(effect: Effect.Effect<A, Error, OpenClaw>, modelOutput: string) =>
  Effect.runPromise(
    Effect.provide(
      effect,
      OpenClawLive.pipe(
        Layer.provide(
          Layer.mergeAll(
            Layer.succeed(ConfigService, config),
            ValidatorLive,
            SignerLive.pipe(Layer.provide(Layer.succeed(ConfigService, config))),
            Layer.succeed(Evidence, {
              collect: () =>
                Effect.succeed([
                  {
                    uri: "https://example.com/usdc",
                    adapter: "http",
                    ok: true,
                    hash: "a".repeat(64),
                    contentType: "text/plain",
                    status: 200,
                    bytes: 5,
                    snippet: "hello",
                    error: undefined,
                    observedAt: "2026-01-01T00:00:00.000Z"
                  }
                ])
            }),
            Layer.succeed(DeepSeek, {
              complete: () => Effect.succeed(modelOutput),
              smoke: Effect.succeed("mock")
            })
          )
        )
      )
    )
  );

describe("responseFromModel", () => {
  test("parses structured yes/no response", () => {
    expect(responseFromModel(claim, '{"type":"yes_no","value":true}')).toEqual({ type: "yes_no", value: true });
  });

  test("falls back to insufficient evidence", () => {
    expect(responseFromModel(claim, "insufficient evidence")).toEqual({
      type: "no_answer_possible",
      reason: "Council analysis found insufficient evidence."
    });
  });
});

describe("OpenClaw", () => {
  test("creates an evidence plan from a ClaimSpec", async () => {
    const plan = await runOpenClaw(
      Effect.gen(function* () {
        const openclaw = yield* OpenClaw;
        return yield* openclaw.plan(role, claim);
      }),
      "unused"
    );

    expect(plan.claimId).toBe(claim.id);
    expect(plan.roleId).toBe(role.id);
    expect(plan.steps.length).toBeGreaterThan(0);
  });

  test("emits a signed structured observation", async () => {
    const observation = await runOpenClaw(
      Effect.gen(function* () {
        const openclaw = yield* OpenClaw;
        return yield* openclaw.observe(role, claim);
      }),
      '{"type":"yes_no","value":true}'
    );

    expect(observation.claimId).toBe(claim.id);
    expect(observation.witnessRole).toBe(role.id);
    expect(observation.response).toEqual({ type: "yes_no", value: true });
    expect(observation.evidence).toEqual([{ uri: "https://example.com/usdc", note: `http ok sha256:${"a".repeat(64)}` }]);
    expect(observation.signature.length).toBeGreaterThan(10);
  });

  test("cannot emit a mismatched response past validation", async () => {
    await expect(
      runOpenClaw(
        Effect.gen(function* () {
          const openclaw = yield* OpenClaw;
          return yield* openclaw.observe(role, claim);
        }),
        '{"type":"scalar_int","value":100,"decimals":2}'
      )
    ).rejects.toThrow("Response type scalar_int does not match claim kind yes_no");
  });
});
