import { describe, expect, test } from "bun:test";
import type { ClaimSpec } from "../domain.js";
import {
  buildHarnessEvents,
  collectEngineHarnessEventsForRegime,
  claimsForHarnessRegime,
  oracleForHarnessClaim,
  streamEngineHarnessEventsForRegime
} from "./harness-server.js";
import { validateHarnessEventOrder } from "./harness-events.js";

const claims: ClaimSpec[] = [
  {
    id: "claim:x402:50:ousd-peg-001",
    kind: "yes_no",
    domain: "stablecoins",
    statement: "OUSD stayed in band.",
    sources: ["local-evidence://stablecoins/ousd"],
    livenessSeconds: 120
  },
  {
    id: "claim:x402:50:merkle-attestation-001",
    kind: "hash_attestation",
    domain: "stablecoins",
    statement: "The sponsor feed hash matched.",
    sources: ["local-evidence://stablecoins/hash"],
    livenessSeconds: 120
  },
  {
    id: "claim:x402:50:resource-availability-001",
    kind: "yes_no",
    domain: "availability",
    statement: "The resource endpoint was available.",
    sources: ["local-evidence://availability/resource"],
    livenessSeconds: 120
  }
];

describe("browser harness server", () => {
  test("routes claims to the expected oracle node", () => {
    expect(claims.map(oracleForHarnessClaim)).toEqual([
      "witness-peg",
      "witness-attestation",
      "witness-availability"
    ]);
  });

  test("filters claims by visual harness regime", () => {
    expect(claimsForHarnessRegime(claims, "sponsor")).toHaveLength(0);
    expect(claimsForHarnessRegime(claims, "peg").map((claim) => claim.id)).toEqual(["claim:x402:50:ousd-peg-001"]);
    expect(claimsForHarnessRegime(claims, "stablecoins")).toHaveLength(2);
    expect(claimsForHarnessRegime(claims, "full")).toHaveLength(3);
  });

  test("builds a full typed lifecycle with payouts and rewards", () => {
    const events = buildHarnessEvents(claims, "full", "run:test");
    expect(events[0]?.type).toBe("run_started");
    expect(events.at(-1)).toMatchObject({
      type: "run_finished",
      totalObservations: 3,
      stablecoinAtomic: "3000000",
      zapAtomic: "3000000000000000000"
    });
    expect(events.filter((event) => event.type === "observation_signed")).toHaveLength(3);
    expect(events.filter((event) => event.type === "work_receipt_created")).toHaveLength(3);
    expect(events.filter((event) => event.type === "bounty_created")).toHaveLength(3);
    expect(events.filter((event) => event.type === "zap_reward_created")).toHaveLength(3);
  });

  test("builds engine-backed harness events for a visual regime", async () => {
    const events = await collectEngineHarnessEventsForRegime(claims, "peg", {
      runId: "run:engine-server",
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
    expect(events.find((event) => event.type === "claim_loaded")?.claim.id).toBe("claim:x402:50:ousd-peg-001");
    expect(events.find((event) => event.type === "balance_changed" && event.reason === "sponsor_funded")).toMatchObject({
      accountId: "sponsor:browser-harness",
      asset: "OUSD",
      deltaAtomic: "1000000"
    });
    expect(events.find((event) => event.type === "work_receipt_created")).toMatchObject({
      asset: "OUSD",
      amountAtomic: "1000000",
      nodeId: "witness-peg"
    });
  });

  test("streams engine-backed full network events across routed witness nodes", async () => {
    const events = [];
    for await (const event of streamEngineHarnessEventsForRegime(claims, "full", {
      runId: "run:engine-full",
      now: () => "2026-01-01T00:00:00.000Z"
    })) {
      events.push(event);
    }

    expect(validateHarnessEventOrder(events)).toEqual([]);
    expect(events.filter((event) => event.type === "witness_started").map((event) => event.nodeId)).toEqual([
      "witness-peg",
      "witness-attestation",
      "witness-availability"
    ]);
    expect(events.at(-1)).toMatchObject({
      type: "run_finished",
      claimCount: 3,
      observationCount: 3,
      payoutAtomic: "3000000"
    });
  });
});
