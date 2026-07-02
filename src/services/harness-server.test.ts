import { describe, expect, test } from "bun:test";
import type { ClaimSpec } from "../domain.js";
import {
  buildHarnessEvents,
  claimsForHarnessRegime,
  oracleForHarnessClaim
} from "./harness-server.js";

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
});
