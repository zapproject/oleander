import { describe, expect, test } from "bun:test";
import { defaultHarnessEnv, statusGlyph, x402HarnessSteps } from "./tui-harness.js";

describe("tui harness", () => {
  test("defines the sponsor/oracle x402 run sequence", () => {
    expect(x402HarnessSteps("compose.yml").map((step) => step.id)).toEqual([
      "build",
      "resource",
      "sponsor",
      "availability",
      "attestation",
      "peg",
      "cleanup"
    ]);
  });

  test("uses the ten claim sponsored feed by default", () => {
    expect(defaultHarnessEnv.ZAP_SPONSORED_CLAIM_FEED).toBe("claims/x402-ten-claims.json");
    expect(defaultHarnessEnv.X402_SPONSOR_ID).toBe("sponsor:x402:mock");
  });

  test("maps statuses to ascii glyphs", () => {
    expect(statusGlyph("pending")).toBe("-");
    expect(statusGlyph("running")).toBe(">");
    expect(statusGlyph("passed")).toBe("+");
    expect(statusGlyph("failed")).toBe("!");
  });
});
