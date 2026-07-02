import { describe, expect, test } from "bun:test";
import type { ClaimSpec, Observation } from "../domain.js";
import { validateHarnessEventOrder } from "./harness-events.js";
import { collectHarnessRunEvents, type HarnessWitnessRunner } from "./harness-run-engine.js";

const claim: ClaimSpec = {
  id: "claim:ousd:availability:001",
  kind: "yes_no",
  domain: "availability",
  statement: "The OUSD paid claim feed was available to witnesses.",
  sources: ["local-evidence://availability/ousd-feed"],
  livenessSeconds: 120
};

const fakeWitness: HarnessWitnessRunner = {
  nodeId: "witness-availability",
  witnessRole: "research",
  observe: async (input): Promise<Observation> => ({
    claimId: input.claim.id,
    witnessRole: "research",
    nodeId: "witness-availability",
    response: { type: "yes_no", value: true },
    confidence: 0.8,
    evidence: [{ uri: input.claim.sources[0]!, note: "local evidence ok" }],
    rationale: "Fake witness observed the local OUSD feed fixture.",
    observedAt: "2026-01-01T00:00:06.000Z",
    signature: "sig:fake"
  })
};

describe("HarnessRunEngine", () => {
  test("emits an ordered local run with gossip, proposal, OUSD receipt, and balance events", async () => {
    const events = await collectHarnessRunEvents({
      runId: "run:test",
      claims: [claim],
      witness: fakeWitness,
      now: () => "2026-01-01T00:00:00.000Z"
    });

    expect(validateHarnessEventOrder(events)).toEqual([]);
    expect(events.map((event) => event.type)).toEqual([
      "run_started",
      "balance_changed",
      "claim_loaded",
      "witness_started",
      "tool_call_started",
      "tool_call_finished",
      "observation_signed",
      "gossip_published",
      "proposal_created",
      "work_receipt_created",
      "balance_changed",
      "balance_changed",
      "run_finished"
    ]);
    expect(events.find((event) => event.type === "balance_changed" && event.reason === "sponsor_funded")).toMatchObject({
      type: "balance_changed",
      accountId: "sponsor:local",
      asset: "OUSD",
      deltaAtomic: "1000000",
      balanceAtomic: "1000000"
    });
    expect(events.find((event) => event.type === "work_receipt_created")).toMatchObject({
      type: "work_receipt_created",
      asset: "OUSD",
      amountAtomic: "1000000",
      claimId: claim.id,
      nodeId: "witness-availability"
    });
    expect(events.find((event) =>
      event.type === "balance_changed" && event.reason === "settlement"
    )).toMatchObject({
      type: "balance_changed",
      accountId: "sponsor:local",
      asset: "OUSD",
      deltaAtomic: "-1000000",
      balanceAtomic: "0"
    });
    expect(events.find((event) =>
      event.type === "balance_changed" && event.reason === "work_receipt"
    )).toMatchObject({
      type: "balance_changed",
      accountId: "witness-availability",
      asset: "OUSD",
      deltaAtomic: "1000000",
      balanceAtomic: "1000000"
    });
  });

  test("emits run_failed with useful context when the witness throws", async () => {
    const events = await collectHarnessRunEvents({
      runId: "run:failed",
      claims: [claim],
      witness: {
        ...fakeWitness,
        observe: async () => {
          throw new Error("model timeout");
        }
      },
      now: () => "2026-01-01T00:00:00.000Z"
    });

    expect(validateHarnessEventOrder(events)).toEqual([]);
    expect(events.at(-1)).toMatchObject({
      type: "run_failed",
      error: "model timeout"
    });
    expect(events.map((event) => event.type)).toEqual([
      "run_started",
      "balance_changed",
      "claim_loaded",
      "witness_started",
      "tool_call_started",
      "tool_call_finished",
      "run_failed"
    ]);
  });
});
