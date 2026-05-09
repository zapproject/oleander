import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import type { Observation } from "../domain.js";
import { writeRunArtifact, x402WorkRunArtifact } from "./run-artifact.js";
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
          stablecoinAtomic: "1000000",
          zapAtomic: "1000000000000000000"
        }
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
