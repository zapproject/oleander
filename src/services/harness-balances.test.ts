import { describe, expect, test } from "bun:test";
import type { HarnessEvent } from "./harness-events.js";
import { reduceHarnessBalances } from "./harness-balances.js";

const base = {
  runId: "run:test",
  emittedAt: "2026-01-01T00:00:00.000Z"
} as const;

const events: HarnessEvent[] = [
  {
    ...base,
    type: "balance_changed",
    eventId: "evt:funded",
    accountId: "sponsor:ousd:mock",
    asset: "OUSD",
    deltaAtomic: "5000000",
    balanceAtomic: "5000000",
    reason: "sponsor_funded"
  },
  {
    ...base,
    type: "work_receipt_created",
    eventId: "evt:receipt",
    claimId: "claim:ousd:availability:001",
    nodeId: "witness-availability",
    workReceiptId: "work:001",
    asset: "OUSD",
    amountAtomic: "1000000",
    payoutAddress: "mock-wallet:witness-availability"
  },
  {
    ...base,
    type: "balance_changed",
    eventId: "evt:paid",
    accountId: "witness-availability",
    asset: "OUSD",
    deltaAtomic: "1000000",
    balanceAtomic: "1000000",
    reason: "work_receipt",
    claimId: "claim:ousd:availability:001"
  }
];

describe("harness OUSD balances", () => {
  test("reduces sponsor funding, committed payout, and settled witness earnings", () => {
    const state = reduceHarnessBalances(events);
    expect(state).toMatchObject({
      asset: "OUSD",
      sponsorFundedAtomic: "5000000",
      committedPayoutAtomic: "1000000",
      paidPayoutAtomic: "1000000"
    });
    expect(state.accounts["sponsor:ousd:mock"]).toMatchObject({
      accountId: "sponsor:ousd:mock",
      balanceAtomic: "5000000"
    });
    expect(state.accounts["witness-availability"]).toMatchObject({
      accountId: "witness-availability",
      pendingAtomic: "0",
      settledAtomic: "1000000",
      balanceAtomic: "1000000",
      claimIds: ["claim:ousd:availability:001"]
    });
  });

  test("does not double-count duplicate receipt ids or duplicate balance events", () => {
    const state = reduceHarnessBalances([
      ...events,
      { ...events[1]!, eventId: "evt:duplicate-receipt" },
      events[2]!
    ]);
    expect(state.committedPayoutAtomic).toBe("1000000");
    expect(state.paidPayoutAtomic).toBe("1000000");
    expect(state.accounts["witness-availability"]?.settledAtomic).toBe("1000000");
  });

  test("keeps unpaid receipts pending", () => {
    const state = reduceHarnessBalances([events[1]!]);
    expect(state.committedPayoutAtomic).toBe("1000000");
    expect(state.paidPayoutAtomic).toBe("0");
    expect(state.accounts["witness-availability"]).toMatchObject({
      pendingAtomic: "1000000",
      settledAtomic: "0"
    });
  });
});
