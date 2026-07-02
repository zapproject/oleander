import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import type { Observation } from "../domain.js";
import type { HarnessEvent } from "./harness-events.js";
import {
  harnessEventsRunArtifact,
  parseHarnessEventsFromRunArtifact,
  verifyRunArtifact,
  writeRunArtifact,
  x402WorkRunArtifact
} from "./run-artifact.js";
import { x402WorkReportFromObservations } from "./x402-work.js";

const observation = (claimId: string): Observation => ({
  claimId,
  witnessRole: "research",
  nodeId: "oracle-a",
  response: { type: "no_answer_possible", reason: "mock run" },
  confidence: 0.2,
  evidence: [{ uri: `local-evidence://${claimId}`, note: "http ok sha256:a" }],
  rationale: "mock",
  observedAt: "2026-01-01T00:00:00.000Z",
  signature: `sig:${claimId}`
});

describe("run artifacts", () => {
  test("writes a stable x402 work artifact", () => {
    const dir = mkdtempSync(join(tmpdir(), "oleander-artifact-"));
    try {
      const report = x402WorkReportFromObservations([observation("claim:a")]);
      const artifact = x402WorkRunArtifact(report, {
        claimFeedPath: "claims/x402-mock.json",
        now: new Date("2026-01-01T00:00:00.000Z")
      });
      const filePath = writeRunArtifact(artifact, { outputDir: dir });
      const parsed = JSON.parse(readFileSync(filePath, "utf8")) as typeof artifact;
      expect(parsed).toMatchObject({
        schemaVersion: 1,
        runId: "x402-work-oracle-a-2026-01-01t00-00-00-000z",
        command: "x402 work --once",
        claimFeedPath: "claims/x402-mock.json",
        summary: {
          oracleNodeId: "oracle-a",
          observations: 1,
          paymentAsset: "OUSD",
          stablecoinAtomic: "1000000",
          zapAtomic: "1000000000000000000"
        }
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("creates a summary artifact from harness events", () => {
    const events: HarnessEvent[] = [
      {
        type: "run_started",
        eventId: "evt:1",
        runId: "run:harness:test",
        emittedAt: "2026-01-01T00:00:00.000Z",
        claimCount: 1
      },
      {
        type: "balance_changed",
        eventId: "evt:funded",
        runId: "run:harness:test",
        emittedAt: "2026-01-01T00:00:00.000Z",
        accountId: "sponsor:local",
        asset: "OUSD",
        deltaAtomic: "2000000",
        balanceAtomic: "2000000",
        reason: "sponsor_funded"
      },
      {
        type: "work_receipt_created",
        eventId: "evt:2",
        runId: "run:harness:test",
        emittedAt: "2026-01-01T00:00:01.000Z",
        claimId: "claim:ousd:test",
        nodeId: "witness-a",
        workReceiptId: "work:test",
        asset: "OUSD",
        amountAtomic: "1000000",
        payoutAddress: "mock-wallet:witness-a"
      },
      {
        type: "balance_changed",
        eventId: "evt:settlement",
        runId: "run:harness:test",
        emittedAt: "2026-01-01T00:00:01.000Z",
        accountId: "sponsor:local",
        asset: "OUSD",
        deltaAtomic: "-1000000",
        balanceAtomic: "1000000",
        reason: "settlement",
        claimId: "claim:ousd:test"
      },
      {
        type: "balance_changed",
        eventId: "evt:paid",
        runId: "run:harness:test",
        emittedAt: "2026-01-01T00:00:01.000Z",
        accountId: "witness-a",
        asset: "OUSD",
        deltaAtomic: "1000000",
        balanceAtomic: "1000000",
        reason: "work_receipt",
        claimId: "claim:ousd:test"
      },
      {
        type: "run_finished",
        eventId: "evt:3",
        runId: "run:harness:test",
        emittedAt: "2026-01-01T00:00:02.000Z",
        claimCount: 1,
        observationCount: 1,
        asset: "OUSD",
        payoutAtomic: "1000000"
      }
    ];

    expect(harnessEventsRunArtifact(events, {
      claimFeedPath: "claims/demo.json",
      now: new Date("2026-01-01T00:00:03.000Z")
    })).toMatchObject({
      schemaVersion: 1,
      runId: "run-harness-test",
      command: "headless run --once",
      claimFeedPath: "claims/demo.json",
      summary: {
        eventCount: 6,
        claimCount: 1,
        observationCount: 1,
        paymentAsset: "OUSD",
        sponsorFundedAtomic: "2000000",
        availableBudgetAtomic: "1000000",
        committedPayoutAtomic: "1000000",
        unpaidPayoutAtomic: "0",
        paidPayoutAtomic: "1000000",
        payoutAtomic: "1000000",
        failed: false
      },
      payload: { events }
    });
  });

  test("verifies harness event artifacts", () => {
    const artifact = harnessEventsRunArtifact([
      {
        type: "run_started",
        eventId: "evt:1",
        runId: "run:harness:test",
        emittedAt: "2026-01-01T00:00:00.000Z",
        claimCount: 0
      },
      {
        type: "run_finished",
        eventId: "evt:2",
        runId: "run:harness:test",
        emittedAt: "2026-01-01T00:00:01.000Z",
        claimCount: 0,
        observationCount: 0,
        asset: "OUSD",
        payoutAtomic: "0"
      }
    ]);

    expect(verifyRunArtifact(artifact)).toEqual({ ok: true, errors: [] });
  });

  test("parses harness events from a saved run artifact", () => {
    const artifact = harnessEventsRunArtifact([
      {
        type: "run_started",
        eventId: "evt:1",
        runId: "run:harness:test",
        emittedAt: "2026-01-01T00:00:00.000Z",
        claimCount: 0
      },
      {
        type: "run_finished",
        eventId: "evt:2",
        runId: "run:harness:test",
        emittedAt: "2026-01-01T00:00:01.000Z",
        claimCount: 0,
        observationCount: 0,
        asset: "OUSD",
        payoutAtomic: "0"
      }
    ]);

    expect(parseHarnessEventsFromRunArtifact(artifact).map((event) => event.type)).toEqual([
      "run_started",
      "run_finished"
    ]);
  });

  test("rejects replay for non-harness artifacts", () => {
    const report = x402WorkReportFromObservations([observation("claim:a")]);
    expect(() => parseHarnessEventsFromRunArtifact(x402WorkRunArtifact(report))).toThrow(
      "artifact payload.events must be an array"
    );
  });

  test("reports harness artifact event-order failures", () => {
    const artifact = harnessEventsRunArtifact([
      {
        type: "run_started",
        eventId: "evt:1",
        runId: "run:harness:test",
        emittedAt: "2026-01-01T00:00:00.000Z",
        claimCount: 1
      },
      {
        type: "run_finished",
        eventId: "evt:2",
        runId: "run:harness:test",
        emittedAt: "2026-01-01T00:00:01.000Z",
        claimCount: 1,
        observationCount: 0,
        asset: "OUSD",
        payoutAtomic: "0"
      }
    ]);

    expect(verifyRunArtifact(artifact)).toEqual({
      ok: false,
      errors: ["run_finished claimCount 1 does not match 0 claim_loaded events"]
    });
  });
});
