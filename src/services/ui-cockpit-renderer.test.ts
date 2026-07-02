import { describe, expect, test } from "bun:test";
import type { ClaimSpec } from "../domain.js";
import type { HarnessEvent } from "./harness-events.js";
import { reduceUiCockpitState } from "./ui-cockpit-state.js";
import { renderUiCockpit } from "./ui-cockpit-renderer.js";

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

const finishedEvents: HarnessEvent[] = [
  { ...base, type: "run_started", eventId: "evt:001", claimCount: 1 },
  {
    ...base,
    type: "balance_changed",
    eventId: "evt:002",
    accountId: "sponsor:local",
    asset: "OUSD",
    deltaAtomic: "2000000",
    balanceAtomic: "2000000",
    reason: "sponsor_funded"
  },
  { ...base, type: "claim_loaded", eventId: "evt:003", claim },
  {
    ...base,
    type: "witness_started",
    eventId: "evt:004",
    claimId: claim.id,
    nodeId: "witness-availability",
    witnessRole: "research"
  },
  {
    ...base,
    type: "proposal_created",
    eventId: "evt:005",
    claimId: claim.id,
    response: { type: "yes_no", value: true },
    support: ["sig:fake"],
    expiresAt: "2026-01-01T00:02:00.000Z"
  },
  {
    ...base,
    type: "work_receipt_created",
    eventId: "evt:006",
    claimId: claim.id,
    nodeId: "witness-availability",
    workReceiptId: "work:001",
    asset: "OUSD",
    amountAtomic: "1000000",
    payoutAddress: "mock-wallet:witness-availability"
  },
  {
    ...base,
    type: "balance_changed",
    eventId: "evt:007",
    accountId: "sponsor:local",
    asset: "OUSD",
    deltaAtomic: "-1000000",
    balanceAtomic: "1000000",
    reason: "settlement",
    claimId: claim.id
  },
  {
    ...base,
    type: "balance_changed",
    eventId: "evt:008",
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
    eventId: "evt:009",
    claimCount: 1,
    observationCount: 1,
    asset: "OUSD",
    payoutAtomic: "1000000"
  }
];

describe("UI cockpit renderer", () => {
  test("renders claims, witnesses, proposals, OUSD balances, and events", () => {
    const output = renderUiCockpit(reduceUiCockpitState(finishedEvents));
    expect(output).toContain("OLEANDER NETWORK COCKPIT");
    expect(output).toContain("Run: run:test [finished]");
    expect(output).toContain("Claims: 1");
    expect(output).toContain("Witnesses: 1");
    expect(output).toContain("OUSD funded: 2000000");
    expect(output).toContain("OUSD available: 1000000");
    expect(output).toContain("OUSD unpaid: 0");
    expect(output).toContain("OUSD paid: 1000000");
    expect(output).toContain("claim:ousd:availability:001");
    expect(output).toContain("status=proposed");
    expect(output).toContain("witness-availability");
    expect(output).toContain("earned=1000000 OUSD");
    expect(output).toContain("proposal created: claim:ousd:availability:001");
  });

  test("renders failed run context", () => {
    const output = renderUiCockpit(reduceUiCockpitState([
      finishedEvents[0]!,
      finishedEvents[1]!,
      finishedEvents[2]!,
      finishedEvents[3]!,
      { ...base, type: "run_failed", eventId: "evt:failed", error: "model timeout" }
    ]));
    expect(output).toContain("Run: run:test [failed]");
    expect(output).toContain("Error: model timeout");
    expect(output).toContain("witness-availability");
    expect(output).toContain("status=failed");
  });
});
