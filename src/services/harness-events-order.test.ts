import { describe, expect, test } from "bun:test";
import type { ClaimSpec } from "../domain.js";
import {
  assertValidHarnessEventOrder,
  validateHarnessEventOrder,
  type HarnessEvent
} from "./harness-events.js";

const claim: ClaimSpec = {
  id: "claim:ousd:availability:001",
  kind: "yes_no",
  domain: "availability",
  statement: "The OUSD paid claim feed was available to witnesses.",
  sources: ["local-evidence://availability/ousd-feed"],
  livenessSeconds: 120
};

const base = {
  runId: "run:test",
  emittedAt: "2026-01-01T00:00:00.000Z"
} as const;

const happyPath: HarnessEvent[] = [
  { ...base, type: "run_started", eventId: "evt:001", claimCount: 1 },
  { ...base, type: "claim_loaded", eventId: "evt:002", claim },
  {
    ...base,
    type: "witness_started",
    eventId: "evt:003",
    claimId: claim.id,
    nodeId: "witness-availability",
    witnessRole: "research"
  },
  {
    ...base,
    type: "tool_call_started",
    eventId: "evt:004",
    claimId: claim.id,
    nodeId: "witness-availability",
    callId: "call:evidence",
    toolName: "local-evidence"
  },
  {
    ...base,
    type: "tool_call_finished",
    eventId: "evt:005",
    claimId: claim.id,
    nodeId: "witness-availability",
    callId: "call:evidence",
    toolName: "local-evidence",
    ok: true,
    outputSummary: "1 record"
  },
  {
    ...base,
    type: "evidence_collected",
    eventId: "evt:006",
    claimId: claim.id,
    nodeId: "witness-availability",
    evidence: [{ uri: claim.sources[0]!, ok: true, hash: "abc123", adapter: "http" }]
  },
  {
    ...base,
    type: "observation_signed",
    eventId: "evt:007",
    claimId: claim.id,
    nodeId: "witness-availability",
    signature: "sig:test",
    response: { type: "yes_no", value: true }
  },
  {
    ...base,
    type: "gossip_published",
    eventId: "evt:008",
    claimId: claim.id,
    nodeId: "witness-availability",
    messageHash: "hash:gossip",
    messageKind: "observation"
  },
  {
    ...base,
    type: "proposal_created",
    eventId: "evt:009",
    claimId: claim.id,
    response: { type: "yes_no", value: true },
    support: ["sig:test"],
    expiresAt: "2026-01-01T00:02:00.000Z"
  },
  {
    ...base,
    type: "work_receipt_created",
    eventId: "evt:010",
    claimId: claim.id,
    nodeId: "witness-availability",
    workReceiptId: "work:test",
    asset: "OUSD",
    amountAtomic: "1000000",
    payoutAddress: "mock-wallet:witness-availability"
  },
  {
    ...base,
    type: "balance_changed",
    eventId: "evt:011",
    accountId: "witness-availability",
    asset: "OUSD",
    deltaAtomic: "1000000",
    balanceAtomic: "1000000",
    reason: "work_receipt",
    claimId: claim.id
  },
  {
    ...base,
    type: "run_finished",
    eventId: "evt:012",
    claimCount: 1,
    observationCount: 1,
    asset: "OUSD",
    payoutAtomic: "1000000"
  }
];

describe("harness event ordering", () => {
  test("accepts a valid local witness run", () => {
    expect(validateHarnessEventOrder(happyPath)).toEqual([]);
    expect(() => assertValidHarnessEventOrder(happyPath)).not.toThrow();
  });

  test("rejects receipt before signed observation", () => {
    const invalid = [
      happyPath[0]!,
      happyPath[1]!,
      happyPath[2]!,
      happyPath[9]!,
      happyPath[6]!,
      happyPath[11]!
    ];
    expect(validateHarnessEventOrder(invalid)).toContain(
      "work_receipt_created for claim:ousd:availability:001/witness-availability before observation_signed"
    );
  });

  test("rejects run finish before witness completion", () => {
    const invalid = [happyPath[0]!, happyPath[1]!, happyPath[2]!, happyPath[11]!];
    expect(validateHarnessEventOrder(invalid)).toContain(
      "run_finished before witness witness-availability completed claim:ousd:availability:001"
    );
  });

  test("allows a failed run after useful context", () => {
    const failed: HarnessEvent[] = [
      happyPath[0]!,
      happyPath[1]!,
      happyPath[2]!,
      {
        ...base,
        type: "run_failed",
        eventId: "evt:failed",
        error: "DeepSeek timed out while drafting the observation"
      }
    ];
    expect(validateHarnessEventOrder(failed)).toEqual([]);
  });
});
