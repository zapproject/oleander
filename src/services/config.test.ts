import { describe, expect, test } from "bun:test";
import { extractDeepSeekApiKey, validateProductionBoundaries, type AppConfig } from "./config.js";

describe("extractDeepSeekApiKey", () => {
  test("reads env-style key assignment", () => {
    expect(extractDeepSeekApiKey("DEEPSEEK_API_KEY=sk-test_123")).toBe("sk-test_123");
  });

  test("reads quoted env-style key assignment", () => {
    expect(extractDeepSeekApiKey('DEEPSEEK_API_KEY="sk-quoted.123"')).toBe("sk-quoted.123");
  });

  test("reads bare sk-style key from prose", () => {
    expect(extractDeepSeekApiKey("key: sk-from-prose_123")).toBe("sk-from-prose_123");
  });

  test("does not treat multi-line prose as a key", () => {
    expect(extractDeepSeekApiKey("hello\nworld")).toBeUndefined();
  });
});

const baseConfig: AppConfig = {
  runtimeMode: "local",
  nodeId: "local-council",
  claimFeedPath: "claims/demo.json",
  witnessDomain: undefined,
  witnessKinds: undefined,
  claimScanCron: "*/2 * * * *",
  livenessWatchCron: "*/1 * * * *",
  claimScanIntervalMs: 120_000,
  x402PaymentHeader: "mock-paid",
  deepseekApiKey: undefined,
  deepseekBaseUrl: "https://api.deepseek.com",
  deepseekModel: "deepseek-v4-pro",
  deepseekMock: false,
  signerMode: "dev",
  x402Mode: "mock"
};

describe("validateProductionBoundaries", () => {
  test("allows local mock defaults", () => {
    expect(() => validateProductionBoundaries(baseConfig)).not.toThrow();
  });

  test("rejects production runtime with mock/dev boundaries", () => {
    expect(() =>
      validateProductionBoundaries({
        ...baseConfig,
        runtimeMode: "production",
        deepseekMock: true
      })
    ).toThrow("Production runtime cannot use mock/dev boundaries");
  });

  test("allows production runtime when explicit production modes are set", () => {
    expect(() =>
      validateProductionBoundaries({
        ...baseConfig,
        runtimeMode: "production",
        x402PaymentHeader: undefined,
        signerMode: "production",
        x402Mode: "production"
      })
    ).not.toThrow();
  });
});
