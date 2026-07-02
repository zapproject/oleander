import { describe, expect, test } from "bun:test";
import {
  addEventItem,
  applyOusdBalanceEvent,
  claimCategory,
  createOusdBalanceState,
  createOracleStats,
  createVerboseReceipt,
  isEngineHarnessEvent,
  liveEventLabel,
  liveEventTypes,
  oracleForClaim,
  regimes,
  resetOusdBalanceState,
  resetOracleStats,
  summarizeOusdBalances,
  type EngineHarnessEvent,
  type ClaimSpec
} from "./harness-model.js";

const claim = (overrides: Partial<ClaimSpec>): ClaimSpec => ({
  id: "claim:x402:50:ousd-peg-001",
  kind: "yes_no",
  domain: "stablecoins",
  statement: "OUSD held its peg.",
  sources: ["https://example.com"],
  livenessSeconds: 60,
  ...overrides
});

const balanceEvent = (overrides: Partial<Extract<EngineHarnessEvent, { type: "balance_changed" }>> = {}): Extract<EngineHarnessEvent, { type: "balance_changed" }> => ({
  type: "balance_changed",
  eventId: "evt:balance",
  runId: "run:test",
  accountId: "sponsor:browser-harness",
  asset: "OUSD",
  deltaAtomic: "2000000",
  balanceAtomic: "2000000",
  reason: "sponsor_funded",
  emittedAt: "2026-01-01T00:00:00.000Z",
  ...overrides
});

describe("browser harness model", () => {
  test("routes claims to the expected oracle", () => {
    expect(oracleForClaim(claim({ domain: "availability" }))).toBe("witness-availability");
    expect(oracleForClaim(claim({ kind: "hash_attestation" }))).toBe("witness-attestation");
    expect(oracleForClaim(claim({ kind: "yes_no" }))).toBe("witness-peg");
  });

  test("categorizes claim work", () => {
    expect(claimCategory(claim({ domain: "availability" }))).toBe("availability");
    expect(claimCategory(claim({ kind: "hash_attestation" }))).toBe("attestation");
    expect(claimCategory(claim({ kind: "yes_no" }))).toBe("peg");
  });

  test("defines the visual regimes", () => {
    expect(regimes.map((regime) => regime.id)).toEqual([
      "full",
      "sponsor",
      "availability",
      "attestation",
      "peg",
      "stablecoins"
    ]);
  });

  test("resets oracle counters", () => {
    const stats = createOracleStats();
    stats["witness-peg"]!.claimIds.push("claim:a");
    stats["witness-peg"]!.observations = 1;
    stats["witness-peg"]!.ousdAtomic = 1n;
    stats["witness-peg"]!.zapAtomic = 1n;
    resetOracleStats(stats);
    expect(stats["witness-peg"]).toMatchObject({ claimIds: [], observations: 0, ousdAtomic: 0n, zapAtomic: 0n });
  });

  test("reduces OUSD balance events", () => {
    const state = createOusdBalanceState();
    applyOusdBalanceEvent(state, balanceEvent());
    applyOusdBalanceEvent(state, balanceEvent());
    applyOusdBalanceEvent(state, balanceEvent({
      eventId: "evt:settlement",
      deltaAtomic: "-1000000",
      balanceAtomic: "1000000",
      reason: "settlement",
      claimId: "claim:x402:50:ousd-peg-001"
    }));
    applyOusdBalanceEvent(state, balanceEvent({
      eventId: "evt:witness",
      accountId: "witness-peg",
      deltaAtomic: "1000000",
      balanceAtomic: "1000000",
      reason: "work_receipt",
      claimId: "claim:x402:50:ousd-peg-001"
    }));

    expect(summarizeOusdBalances(state)).toEqual({
      sponsorFundedAtomic: 2_000_000n,
      sponsorBalanceAtomic: 1_000_000n,
      sponsorSpentAtomic: 1_000_000n,
      witnessEarnedAtomic: 1_000_000n
    });
    expect(state.accounts["witness-peg"]?.earnedAtomic).toBe(1_000_000n);

    resetOusdBalanceState(state);
    expect(summarizeOusdBalances(state).sponsorFundedAtomic).toBe(0n);
    expect(state.appliedEventIds.size).toBe(0);
  });

  test("prepends bounded event items", () => {
    const events = addEventItem(addEventItem([], "first"), "second");
    expect(events).toEqual([
      { tick: 2, label: "second" },
      { tick: 1, label: "first" }
    ]);
  });

  test("creates fallback simulation receipts", () => {
    expect(createVerboseReceipt(claim({}), "witness-peg")).toMatchObject({
      type: "x402_oracle_work",
      sponsor: "sponsor:x402:mock",
      oracle: "witness-peg",
      stablecoinBounty: { stablecoin: "OUSD", amountAtomic: "1000000" }
    });
  });

  test("subscribes to legacy and engine event names", () => {
    expect(liveEventTypes).toContain("sponsor_claims_loaded");
    expect(liveEventTypes).toContain("claim_loaded");
    expect(liveEventTypes).toContain("balance_changed");
    expect(liveEventTypes).toContain("run_failed");
  });

  test("formats legacy live event labels", () => {
    expect(liveEventLabel({
      type: "bounty_created",
      runId: "run:test",
      claimId: "claim:x402:50:ousd-peg-001",
      nodeId: "witness-peg",
      stablecoin: "OUSD",
      amountAtomic: "1000000",
      payoutAddress: "mock-wallet:witness-peg",
      emittedAt: "2026-01-01T00:00:00.000Z"
    })).toBe("witness-peg earned 1000000 OUSD atomic");
  });

  test("formats engine event labels", () => {
    const loaded: EngineHarnessEvent = {
      type: "claim_loaded",
      eventId: "evt:1",
      runId: "run:test",
      claim: claim({}),
      emittedAt: "2026-01-01T00:00:00.000Z"
    };
    expect(isEngineHarnessEvent(loaded)).toBe(true);
    expect(liveEventLabel(loaded)).toBe("Loaded ousd-peg-001");
    expect(liveEventLabel({
      type: "work_receipt_created",
      eventId: "evt:2",
      runId: "run:test",
      claimId: "claim:x402:50:ousd-peg-001",
      nodeId: "witness-peg",
      workReceiptId: "receipt:1",
      asset: "OUSD",
      amountAtomic: "1000000",
      payoutAddress: "mock-wallet:witness-peg",
      emittedAt: "2026-01-01T00:00:00.000Z"
    })).toBe("witness-peg earned 1000000 OUSD atomic");
    expect(liveEventLabel({
      type: "balance_changed",
      eventId: "evt:3",
      runId: "run:test",
      accountId: "witness-peg",
      asset: "OUSD",
      deltaAtomic: "1000000",
      balanceAtomic: "2000000",
      reason: "work_receipt",
      claimId: "claim:x402:50:ousd-peg-001",
      emittedAt: "2026-01-01T00:00:00.000Z"
    })).toBe("witness-peg balance 2000000 OUSD atomic");
    expect(liveEventLabel({
      type: "run_finished",
      eventId: "evt:4",
      runId: "run:test",
      claimCount: 2,
      observationCount: 2,
      asset: "OUSD",
      payoutAtomic: "2000000",
      emittedAt: "2026-01-01T00:00:00.000Z"
    })).toBe("Run settled: 2 observations");
  });
});
