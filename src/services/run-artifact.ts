import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { HarnessState } from "./tui-harness-core.js";
import { activeRegime } from "./tui-harness-core.js";
import type { X402WorkReport } from "./x402-work.js";

export interface RunArtifact {
  readonly schemaVersion: 1;
  readonly runId: string;
  readonly command: string;
  readonly createdAt: string;
  readonly claimFeedPath?: string;
  readonly regime?: string;
  readonly summary: Record<string, unknown>;
  readonly payload: unknown;
  readonly errors?: ReadonlyArray<string>;
}

export interface WriteRunArtifactOptions {
  readonly outputDir?: string;
  readonly now?: Date;
}

const safeSegment = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "run";

export const createRunId = (prefix: string, now = new Date()): string =>
  safeSegment(`${prefix}-${now.toISOString().replace(/[:.]/g, "-")}`);

export const defaultRunArtifactDir = (): string =>
  process.env.ZAP_RUN_ARTIFACT_DIR ?? "runs";

export const writeRunArtifact = (
  artifact: RunArtifact,
  options: WriteRunArtifactOptions = {}
): string => {
  const outputDir = resolve(process.cwd(), options.outputDir ?? defaultRunArtifactDir());
  mkdirSync(outputDir, { recursive: true });
  const filePath = resolve(outputDir, `${safeSegment(artifact.runId)}.json`);
  writeFileSync(filePath, `${JSON.stringify(artifact, (_key, value) => {
    if (typeof value === "bigint") return value.toString();
    return value;
  }, 2)}\n`);
  return filePath;
};

export const x402WorkRunArtifact = (
  report: X402WorkReport,
  options: { readonly claimFeedPath?: string; readonly now?: Date } = {}
): RunArtifact => {
  const createdAt = (options.now ?? new Date()).toISOString();
  return {
    schemaVersion: 1,
    runId: createRunId(`x402-work-${report.oracle.nodeId}`, options.now),
    command: "x402 work --once",
    createdAt,
    claimFeedPath: options.claimFeedPath,
    summary: {
      oracleNodeId: report.oracle.nodeId,
      observations: report.totals.observations,
      stablecoinAtomic: report.totals.stablecoinAtomic,
      zapAtomic: report.totals.zapAtomic
    },
    payload: report
  };
};

export const tuiRunArtifact = (
  state: HarnessState,
  options: { readonly claimFeedPath?: string; readonly now?: Date; readonly errors?: ReadonlyArray<string> } = {}
): RunArtifact => {
  const createdAt = (options.now ?? new Date()).toISOString();
  const totalObservations = state.reports.reduce((sum, report) => sum + report.observationCount, 0);
  const stablecoinAtomic = state.reports.reduce((sum, report) => sum + BigInt(report.stablecoinAtomic), 0n).toString();
  const zapAtomic = state.reports.reduce((sum, report) => sum + BigInt(report.zapAtomic), 0n).toString();

  return {
    schemaVersion: 1,
    runId: createRunId(`tui-${activeRegime(state).id}-${state.runCount}`, options.now),
    command: "tui",
    createdAt,
    claimFeedPath: options.claimFeedPath,
    regime: activeRegime(state).id,
    summary: {
      runCount: state.runCount,
      claims: state.claims.length,
      oracleReports: state.reports.length,
      observations: totalObservations,
      stablecoinAtomic,
      zapAtomic,
      failedSteps: state.steps.filter((step) => step.status === "failed").map((step) => step.id)
    },
    payload: {
      steps: state.steps,
      claims: state.claims,
      reports: state.reports,
      logs: state.logs,
      verboseLogs: state.verboseLogs
    },
    errors: options.errors
  };
};
