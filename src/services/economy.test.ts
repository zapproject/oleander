import { describe, expect, test } from "bun:test";
import type { Observation } from "../domain.js";
import { defaultBurnTreasuryPolicy, stablecoinBountyFromWork, workReceiptFromObservation, zapRewardFromWork } from "./economy.js";

const observation: Observation = {
  claimId: "claim:test:economy",
  witnessRole: "research",
  nodeId: "node-a",
  response: { type: "no_answer_possible", reason: "insufficient evidence" },
  confidence: 0.2,
  evidence: [{ uri: "https://example.com", note: "http ok sha256:a" }],
  rationale: "test",
  observedAt: "2026-01-01T00:00:00.000Z",
  signature: "sig-a"
};

describe("witness economy receipts", () => {
  test("creates verifiable work receipt from signed observation", () => {
    const receipt = workReceiptFromObservation(observation, "2026-01-01T00:00:01.000Z");
    expect(receipt.category).toBe("observation");
    expect(receipt.claimId).toBe(observation.claimId);
    expect(receipt.signature).toBe("sig-a");
  });

  test("derives stablecoin bounty receipt from work", () => {
    const receipt = workReceiptFromObservation(observation);
    expect(stablecoinBountyFromWork(receipt, {
      stablecoin: "USDC",
      amountAtomic: "1000000",
      payoutAddress: "0x0000000000000000000000000000000000000001"
    })).toEqual({
      workReceiptId: receipt.id,
      stablecoin: "USDC",
      amountAtomic: "1000000",
      payoutAddress: "0x0000000000000000000000000000000000000001"
    });
  });

  test("derives ZAP reward from work", () => {
    const receipt = workReceiptFromObservation(observation);
    expect(zapRewardFromWork(receipt, "100")).toEqual({
      workReceiptId: receipt.id,
      zapAmountAtomic: "100",
      reason: "observation"
    });
  });

  test("defines burn and treasury policy", () => {
    expect(defaultBurnTreasuryPolicy.burnShareBps + defaultBurnTreasuryPolicy.treasuryShareBps).toBe(10000);
  });
});
