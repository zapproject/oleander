import { describe, expect, test } from "bun:test";
import type { ClaimSpec, Observation } from "../domain.js";
import { reduceOracle } from "./oracle.js";

const claim: ClaimSpec = {
  id: "claim:test:oracle",
  kind: "yes_no",
  domain: "stablecoins",
  statement: "A stablecoin remained inside the configured tolerance.",
  sources: ["https://example.com"],
  livenessSeconds: 60
};

const observation = (nodeId: string, value: boolean, observedAt = "2026-01-01T00:00:00.000Z"): Observation => ({
  claimId: claim.id,
  witnessRole: "research",
  nodeId,
  response: { type: "yes_no", value },
  confidence: 0.5,
  evidence: [{ uri: "https://example.com", note: "http ok sha256:a" }],
  rationale: "test",
  observedAt,
  signature: `${nodeId}-sig`
});

describe("reduceOracle", () => {
  test("starts requested without observations", () => {
    expect(reduceOracle(claim, [], new Date("2026-01-01T00:00:01.000Z")).state).toBe("requested");
  });

  test("derives proposal from agreeing observations", () => {
    const reduced = reduceOracle(
      claim,
      [observation("node-a", true), observation("node-b", true)],
      new Date("2026-01-01T00:00:30.000Z")
    );

    expect(reduced.state).toBe("proposed");
    expect(reduced.proposal?.support).toEqual(["node-a-sig", "node-b-sig"]);
  });

  test("creates dispute from conflicting observations", () => {
    const reduced = reduceOracle(
      claim,
      [observation("node-a", true), observation("node-b", false)],
      new Date("2026-01-01T00:00:30.000Z")
    );

    expect(reduced.state).toBe("disputed");
    expect(reduced.dispute?.reason).toBe("conflicting_observations");
  });

  test("settles after liveness", () => {
    const reduced = reduceOracle(
      claim,
      [observation("node-a", true)],
      new Date("2026-01-01T00:01:01.000Z")
    );

    expect(reduced.state).toBe("settled");
    expect(reduced.settlement?.response).toEqual({ type: "yes_no", value: true });
  });
});
