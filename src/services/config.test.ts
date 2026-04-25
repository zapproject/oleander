import { describe, expect, test } from "bun:test";
import { extractDeepSeekApiKey } from "./config.js";

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
