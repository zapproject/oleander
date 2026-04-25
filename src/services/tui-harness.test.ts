import { describe, expect, test } from "bun:test";
import {
  defaultHarnessEnv,
  extractJsonValues,
  harnessRegimes,
  statusGlyph,
  summarizeHarnessOutput,
  x402HarnessSteps
} from "./tui-harness.js";

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

  test("defines selectable regimes", () => {
    expect(harnessRegimes.map((regime) => regime.id)).toEqual([
      "full",
      "sponsor",
      "availability",
      "attestation",
      "peg",
      "stablecoins"
    ]);
  });

  test("maps statuses to ascii glyphs", () => {
    expect(statusGlyph("pending")).toBe("-");
    expect(statusGlyph("running")).toBe(">");
    expect(statusGlyph("passed")).toBe("+");
    expect(statusGlyph("failed")).toBe("!");
  });

  test("extracts JSON values from docker output", () => {
    expect(extractJsonValues("Container running\n[{\"id\":\"claim:a\",\"kind\":\"yes_no\",\"domain\":\"stablecoins\",\"statement\":\"A claim.\"}]\n")).toHaveLength(1);
  });

  test("summarizes sponsored claim output", () => {
    const summary = summarizeHarnessOutput(
      "sponsor",
      "[{\"id\":\"claim:a\",\"kind\":\"yes_no\",\"domain\":\"stablecoins\",\"statement\":\"A claim.\"}]"
    );
    expect(summary.claims?.[0]?.id).toBe("claim:a");
  });

  test("summarizes oracle incentive reports", () => {
    const summary = summarizeHarnessOutput(
      "peg",
      JSON.stringify({
        type: "x402_oracle_work",
        oracle: { nodeId: "witness-peg", observationCount: 4 },
        observations: [{ claimId: "claim:a" }],
        totals: { stablecoinAtomic: "4000000", zapAtomic: "4000000000000000000" }
      })
    );
    expect(summary.report).toEqual({
      nodeId: "witness-peg",
      observationCount: 4,
      stablecoinAtomic: "4000000",
      zapAtomic: "4000000000000000000",
      claimIds: ["claim:a"]
    });
  });
});
