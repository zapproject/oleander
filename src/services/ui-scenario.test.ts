import { describe, expect, test } from "bun:test";
import {
  activeRegime,
  applyStructuredOutput,
  defaultHarnessEnv,
  extractJsonValues,
  harnessRegimes,
  resetSteps,
  statusGlyph,
  summarizeHarnessOutput,
  type HarnessState,
  x402HarnessSteps
} from "./ui-scenario-core.js";

describe("ui harness", () => {
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

  test("uses the fifty claim sponsored feed by default", () => {
    expect(defaultHarnessEnv.ZAP_SPONSORED_CLAIM_FEED).toBe("claims/x402-fifty-claims.json");
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

  test("builds pending steps for the active regime", () => {
    const state = { selectedRegime: 5 };
    expect(activeRegime(state).id).toBe("stablecoins");
    expect(resetSteps(state).map((step) => [step.id, step.status])).toEqual([
      ["build", "pending"],
      ["resource", "pending"],
      ["sponsor", "pending"],
      ["attestation", "pending"],
      ["peg", "pending"],
      ["cleanup", "pending"]
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

  test("applies structured output to state summaries", () => {
    const state: HarnessState = {
      running: false,
      runCount: 0,
      selectedRegime: 0,
      showVerbose: false,
      logs: [],
      verboseLogs: [],
      steps: [],
      claims: [],
      reports: []
    };
    applyStructuredOutput(
      state,
      { ...x402HarnessSteps("compose.yml")[2]!, status: "passed", exitCode: 0 },
      "[{\"id\":\"claim:a\",\"kind\":\"yes_no\",\"domain\":\"stablecoins\",\"statement\":\"A claim.\"}]"
    );
    expect(state.claims).toHaveLength(1);
    expect(state.logs.at(-1)).toBe("parsed 1 sponsored claims");
  });
});
