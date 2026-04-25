import { describe, expect, test } from "bun:test";
import type { Observation } from "../domain.js";
import { x402WorkReportFromObservations } from "./x402-work.js";

const observation = (claimId: string): Observation => ({
  claimId,
  witnessRole: "research",
  nodeId: "oracle-a",
  response: { type: "no_answer_possible", reason: "mock run" },
  confidence: 0.2,
  evidence: [{ uri: `local-evidence://${claimId}`, note: "http ok sha256:a" }],
  rationale: "mock",
  observedAt: "2026-01-01T00:00:00.000Z",
  signature: `sig:${claimId}`
});

describe("x402 work incentives", () => {
  test("creates one payout and reward per signed observation", () => {
    const report = x402WorkReportFromObservations(
      [observation("claim:a"), observation("claim:b")],
      {
        sponsorId: "sponsor:test",
        bountyPerObservationAtomic: "1000000",
        zapRewardPerObservationAtomic: "250"
      }
    );

    expect(report.sponsor.id).toBe("sponsor:test");
    expect(report.oracle.nodeId).toBe("oracle-a");
    expect(report.incentives).toHaveLength(2);
    expect(report.incentives[0]?.stablecoinBounty.amountAtomic).toBe("1000000");
    expect(report.incentives[0]?.zapReward.zapAmountAtomic).toBe("250");
    expect(report.totals).toEqual({
      observations: 2,
      stablecoinAtomic: "2000000",
      zapAtomic: "500"
    });
  });
});
