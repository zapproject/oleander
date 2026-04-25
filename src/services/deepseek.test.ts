import { describe, expect, test } from "bun:test";
import { Context, Effect, Layer } from "effect";
import { DeepSeek, DeepSeekLive } from "./deepseek.js";
import { ConfigService, type AppConfig } from "./config.js";

const baseConfig: AppConfig = {
  nodeId: "test-node",
  claimFeedPath: "claims/demo.json",
  witnessDomain: undefined,
  deepseekApiKey: undefined,
  deepseekBaseUrl: "https://api.deepseek.com",
  deepseekModel: "deepseek-chat",
  deepseekMock: false
};

const runWithConfig = <A>(effect: Effect.Effect<A, Error, DeepSeek>, config: AppConfig) =>
  Effect.runPromise(
    Effect.provide(
      effect,
      DeepSeekLive.pipe(Layer.provide(Layer.succeed(ConfigService, config)))
    )
  );

describe("DeepSeek service", () => {
  test("smoke fails cleanly without key", async () => {
    await expect(
      runWithConfig(
        Effect.gen(function* () {
          const deepseek = yield* DeepSeek;
          return yield* deepseek.smoke;
        }),
        baseConfig
      )
    ).rejects.toThrow("Missing DeepSeek API key");
  });

  test("mock mode does not require a key", async () => {
    const result = await runWithConfig(
      Effect.gen(function* () {
        const deepseek = yield* DeepSeek;
        return yield* deepseek.complete([{ role: "user", content: "claim" }]);
      }),
      { ...baseConfig, deepseekMock: true }
    );

    expect(result).toContain("Mock DeepSeek response");
  });

  test("smoke succeeds when a key is configured", async () => {
    const result = await runWithConfig(
      Effect.gen(function* () {
        const deepseek = yield* DeepSeek;
        return yield* deepseek.smoke;
      }),
      { ...baseConfig, deepseekApiKey: "sk-test" }
    );

    expect(result).toBe("DeepSeek API key is configured.");
  });
});
