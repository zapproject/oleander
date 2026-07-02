import { describe, expect, test } from "bun:test";
import type { ClaimSpec } from "../domain.js";
import {
  HarnessEventTypes,
  parseHarnessEvent,
  serializeHarnessEvent,
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

describe("harness event schema", () => {
  test("exports the initial event contract", () => {
    expect(HarnessEventTypes).toEqual([
      "run_started",
      "claim_loaded",
      "witness_started",
      "tool_call_started",
      "tool_call_finished",
      "evidence_collected",
      "observation_signed",
      "gossip_published",
      "proposal_created",
      "dispute_created",
      "settlement_created",
      "work_receipt_created",
      "balance_changed",
      "run_finished",
      "run_failed"
    ]);
  });

  test("serializes and parses representative events", () => {
    const events: HarnessEvent[] = [
      {
        type: "run_started",
        eventId: "evt:001",
        runId: "run:test",
        emittedAt: "2026-01-01T00:00:00.000Z",
        claimCount: 1
      },
      {
        type: "claim_loaded",
        eventId: "evt:002",
        runId: "run:test",
        emittedAt: "2026-01-01T00:00:01.000Z",
        claim
      },
      {
        type: "witness_started",
        eventId: "evt:003",
        runId: "run:test",
        emittedAt: "2026-01-01T00:00:02.000Z",
        claimId: claim.id,
        nodeId: "witness-availability",
        witnessRole: "research"
      },
      {
        type: "tool_call_started",
        eventId: "evt:004",
        runId: "run:test",
        emittedAt: "2026-01-01T00:00:03.000Z",
        claimId: claim.id,
        nodeId: "witness-availability",
        callId: "call:evidence",
        toolName: "local-evidence"
      },
      {
        type: "tool_call_finished",
        eventId: "evt:005",
        runId: "run:test",
        emittedAt: "2026-01-01T00:00:04.000Z",
        claimId: claim.id,
        nodeId: "witness-availability",
        callId: "call:evidence",
        toolName: "local-evidence",
        ok: true,
        outputSummary: "1 local evidence record"
      },
      {
        type: "evidence_collected",
        eventId: "evt:006",
        runId: "run:test",
        emittedAt: "2026-01-01T00:00:05.000Z",
        claimId: claim.id,
        nodeId: "witness-availability",
        evidence: [
          {
            uri: "local-evidence://availability/ousd-feed",
            ok: true,
            hash: "abc123",
            adapter: "http"
          }
        ]
      },
      {
        type: "observation_signed",
        eventId: "evt:007",
        runId: "run:test",
        emittedAt: "2026-01-01T00:00:06.000Z",
        claimId: claim.id,
        nodeId: "witness-availability",
        signature: "sig:test",
        response: { type: "yes_no", value: true }
      },
      {
        type: "gossip_published",
        eventId: "evt:008",
        runId: "run:test",
        emittedAt: "2026-01-01T00:00:07.000Z",
        claimId: claim.id,
        nodeId: "witness-availability",
        messageHash: "hash:gossip",
        messageKind: "observation"
      },
      {
        type: "proposal_created",
        eventId: "evt:009",
        runId: "run:test",
        emittedAt: "2026-01-01T00:00:08.000Z",
        claimId: claim.id,
        response: { type: "yes_no", value: true },
        support: ["sig:test"],
        expiresAt: "2026-01-01T00:02:06.000Z"
      },
      {
        type: "dispute_created",
        eventId: "evt:010",
        runId: "run:test",
        emittedAt: "2026-01-01T00:00:09.000Z",
        claimId: claim.id,
        reason: "conflicting_observations"
      },
      {
        type: "settlement_created",
        eventId: "evt:011",
        runId: "run:test",
        emittedAt: "2026-01-01T00:02:07.000Z",
        claimId: claim.id,
        response: { type: "yes_no", value: true }
      },
      {
        type: "work_receipt_created",
        eventId: "evt:012",
        runId: "run:test",
        emittedAt: "2026-01-01T00:02:08.000Z",
        claimId: claim.id,
        nodeId: "witness-availability",
        workReceiptId: "work:test",
        asset: "OUSD",
        amountAtomic: "1000000",
        payoutAddress: "mock-wallet:witness-availability"
      },
      {
        type: "balance_changed",
        eventId: "evt:013",
        runId: "run:test",
        emittedAt: "2026-01-01T00:02:09.000Z",
        accountId: "witness-availability",
        asset: "OUSD",
        deltaAtomic: "1000000",
        balanceAtomic: "1000000",
        reason: "work_receipt",
        claimId: claim.id
      },
      {
        type: "run_finished",
        eventId: "evt:014",
        runId: "run:test",
        emittedAt: "2026-01-01T00:02:10.000Z",
        claimCount: 1,
        observationCount: 1,
        asset: "OUSD",
        payoutAtomic: "1000000"
      },
      {
        type: "run_failed",
        eventId: "evt:015",
        runId: "run:test",
        emittedAt: "2026-01-01T00:02:11.000Z",
        error: "model timeout"
      }
    ];

    for (const event of events) {
      expect(parseHarnessEvent(serializeHarnessEvent(event))).toEqual(event);
    }
  });

  test("rejects unknown event types", () => {
    expect(() =>
      parseHarnessEvent(JSON.stringify({
        type: "not_real",
        eventId: "evt:bad",
        runId: "run:test",
        emittedAt: "2026-01-01T00:00:00.000Z"
      }))
    ).toThrow("Unknown harness event type");
  });

  test("rejects malformed required fields", () => {
    expect(() =>
      parseHarnessEvent(JSON.stringify({
        type: "claim_loaded",
        eventId: "evt:bad",
        runId: "run:test",
        emittedAt: "2026-01-01T00:00:00.000Z"
      }))
    ).toThrow("claim_loaded.claim is required");
  });
});
