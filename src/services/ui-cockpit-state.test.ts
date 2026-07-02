import { describe, expect, test } from "bun:test";
import type { ClaimSpec } from "../domain.js";
import type { HarnessEvent } from "./harness-events.js";
import {
  initialUiCockpitState,
  reduceUiCockpitState,
  selectUiCockpitClaim,
  selectUiCockpitWitness
} from "./ui-cockpit-state.js";

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

const events: HarnessEvent[] = [
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

describe("UI cockpit state", () => {
  test("reduces harness events into claims, witnesses, proposal state, balances, and event log", () => {
    const state = reduceUiCockpitState(events);
    expect(state.runStatus).toBe("finished");
    expect(state.runId).toBe("run:test");
    expect(state.claimOrder).toEqual([claim.id]);
    expect(state.claims[claim.id]).toMatchObject({
      id: claim.id,
      kind: "yes_no",
      domain: "availability",
      statement: claim.statement,
      status: "proposed",
      proposal: {
        support: ["sig:fake"],
        expiresAt: "2026-01-01T00:02:00.000Z"
      }
    });
    expect(state.witnessOrder).toEqual(["witness-availability"]);
    expect(state.witnesses["witness-availability"]).toMatchObject({
      nodeId: "witness-availability",
      witnessRole: "research",
      status: "paid",
      activeClaimId: claim.id,
      observationCount: 0,
      earnedAtomic: "1000000"
    });
    expect(state.balances.sponsorFundedAtomic).toBe("2000000");
    expect(state.balances.availableBudgetAtomic).toBe("1000000");
    expect(state.balances.unpaidPayoutAtomic).toBe("0");
    expect(state.balances.paidPayoutAtomic).toBe("1000000");
    expect(state.balances.accounts["sponsor:local"]).toMatchObject({
      balanceAtomic: "1000000"
    });
    expect(state.eventLog.map((entry) => entry.type)).toEqual(events.map((event) => event.type));
  });

  test("updates selected claim and witness without changing run state", () => {
    const state = reduceUiCockpitState(events);
    const selectedClaim = selectUiCockpitClaim(state, claim.id);
    const selectedWitness = selectUiCockpitWitness(selectedClaim, "witness-availability");

    expect(selectedClaim.runStatus).toBe("finished");
    expect(selectedClaim.selected).toEqual({ type: "claim", id: claim.id });
    expect(selectedWitness.runStatus).toBe("finished");
    expect(selectedWitness.selected).toEqual({ type: "witness", id: "witness-availability" });
  });

  test("captures failed run state with useful context", () => {
    const state = reduceUiCockpitState([
      events[0]!,
      events[1]!,
      events[2]!,
      events[3]!,
      {
        ...base,
        type: "run_failed",
        eventId: "evt:failed",
        error: "model timeout"
      }
    ]);

    expect(state.runStatus).toBe("failed");
    expect(state.error).toBe("model timeout");
    expect(state.claims[claim.id]?.status).toBe("loaded");
    expect(state.witnesses["witness-availability"]?.status).toBe("failed");
    expect(state.eventLog.at(-1)).toMatchObject({
      eventId: "evt:failed",
      label: "run failed: model timeout"
    });
  });

  test("starts from an idle empty state", () => {
    expect(initialUiCockpitState()).toMatchObject({
      runStatus: "idle",
      claimOrder: [],
      witnessOrder: [],
      selected: { type: undefined, id: undefined },
      balances: {
        asset: "OUSD",
        sponsorFundedAtomic: "0",
        availableBudgetAtomic: "0",
        committedPayoutAtomic: "0",
        unpaidPayoutAtomic: "0",
        paidPayoutAtomic: "0"
      }
    });
  });
});
